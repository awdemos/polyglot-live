import {
  CHUNK_DURATION_MS,
  GEMINI_MODEL,
  INPUT_SAMPLE_RATE,
  INPUT_SAMPLES_PER_CHUNK,
  LIVE_URL,
  OUTPUT_SAMPLE_RATE
} from "./config.js";

const pipelines = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OFFSCREEN_START") {
    startPipeline(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_STOP") {
    stopPipeline(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_START") {
    getPipelineOrThrow(message.tabId)
      .startReplayRecording()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_STOP") {
    getPipelineOrThrow(message.tabId)
      .stopReplayRecording()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_EXPORT") {
    getPipelineOrThrow(message.tabId)
      .exportReplayRecording()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_STATE") {
    const pipeline = pipelines.get(message.tabId);
    sendResponse(
      pipeline
        ? pipeline.getReplayRecordingState()
        : {
            ok: true,
            hasReplay: false,
            isRecording: false,
            mimeType: null
          }
    );
    return false;
  }

  return false;
});

async function startPipeline({ streamId, tabId, targetLanguage, passThroughOriginalAudio, tokenEndpoint, tokenSecret }) {
  if (!tabId) {
    throw new Error("A tab id is required to start the offscreen pipeline.");
  }

  emitDebug(tabId, "Starting offscreen pipeline", {
    passThroughOriginalAudio,
    streamId,
    targetLanguage,
    tokenEndpoint
  });
  emitStatus(tabId, "starting", "Initializing offscreen audio pipeline...");

  if (pipelines.has(tabId)) {
    await pipelines.get(tabId).stop();
  }

  const pipeline = new TabAudioPipeline({
    passThroughOriginalAudio,
    streamId,
    tabId,
    targetLanguage,
    tokenEndpoint,
    tokenSecret
  });
  pipelines.set(tabId, pipeline);

  try {
    await pipeline.start();
  } catch (error) {
    await pipeline.stop().catch(() => {
      return undefined;
    });
    pipelines.delete(tabId);
    throw error;
  }
}

async function stopPipeline(tabId) {
  if (!tabId) {
    return;
  }

  const pipeline = pipelines.get(tabId);
  if (!pipeline) {
    return;
  }

  await pipeline.stop();
  pipelines.delete(tabId);
}

function getPipelineOrThrow(tabId) {
  const pipeline = pipelines.get(tabId);
  if (!pipeline) {
    throw new Error("Start translation before using replay recording on this tab.");
  }
  return pipeline;
}

class TabAudioPipeline {
  constructor({ passThroughOriginalAudio, streamId, tabId, targetLanguage, tokenEndpoint, tokenSecret }) {
    this.passThroughOriginalAudio = passThroughOriginalAudio;
    this.streamId = streamId;
    this.tabId = tabId;
    this.targetLanguage = targetLanguage;
    this.tokenEndpoint = tokenEndpoint;
    this.tokenSecret = tokenSecret;
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.passThroughGain = null;
    this.replayCaptureDestination = null;
    this.replayRecorder = null;
    this.replayRecorderChunks = [];
    this.replayRecordingBlob = null;
    this.replayRecordingMimeType = "";
    this.pendingPcm16 = new Int16Array(0);
    this.playbackCursorTime = 0;
    this.session = null;
  }

  async start() {
    this.session = new GeminiTranslateSession({
      onTranslatedAudio: (base64Audio) => this.playTranslatedAudio(base64Audio),
      tabId: this.tabId,
      targetLanguage: this.targetLanguage,
      tokenEndpoint: this.tokenEndpoint,
      tokenSecret: this.tokenSecret
    });
    await this.session.connect();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: this.streamId
        }
      },
      video: false
    });
    emitDebug(this.tabId, "Tab media stream acquired", {
      audioTrackCount: this.mediaStream.getAudioTracks().length,
      targetLanguage: this.targetLanguage
    });

    this.audioContext = new AudioContext({ sampleRate: 48000 });
    emitDebug(this.tabId, "Audio context created", { sampleRate: this.audioContext.sampleRate });
    await this.audioContext.audioWorklet.addModule("offscreen-audio-processor.js");
    this.replayCaptureDestination = this.audioContext.createMediaStreamDestination();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processorNode = new AudioWorkletNode(this.audioContext, "polyglot-live-capture-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });
    this.passThroughGain = this.audioContext.createGain();
    this.passThroughGain.gain.value = this.passThroughOriginalAudio ? 1 : 0;
    emitDebug(this.tabId, "Audio nodes wired", {
      passThroughGain: this.passThroughGain.gain.value,
      processorType: "AudioWorkletNode"
    });

    this.sourceNode.connect(this.passThroughGain);
    this.passThroughGain.connect(this.audioContext.destination);

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
    this.processorNode.port.onmessage = (event) => {
      const channelData = event.data;
      const pcm16 = float32ToPcm16(downsampleBuffer(channelData, this.audioContext.sampleRate, INPUT_SAMPLE_RATE));
      this.enqueuePcm16(pcm16);
    };

    emitStatus(this.tabId, "streaming", `Streaming tab audio to Gemini for ${this.targetLanguage}. Waiting for translated audio...`);
  }

  async stop() {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.port.onmessage = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.passThroughGain) {
      this.passThroughGain.disconnect();
      this.passThroughGain = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.session) {
      await this.session.close();
      this.session = null;
    }

    if (this.replayRecorder?.state === "recording") {
      await this.stopReplayRecording();
    }

    this.replayRecorder = null;
    this.replayRecorderChunks = [];
    this.replayRecordingBlob = null;
    this.replayRecordingMimeType = "";
    this.replayCaptureDestination = null;
    this.pendingPcm16 = new Int16Array(0);
    this.playbackCursorTime = 0;
  }

  enqueuePcm16(chunk) {
    this.pendingPcm16 = concatInt16Arrays(this.pendingPcm16, chunk);

    while (this.pendingPcm16.length >= INPUT_SAMPLES_PER_CHUNK) {
      const nextChunk = this.pendingPcm16.slice(0, INPUT_SAMPLES_PER_CHUNK);
      this.pendingPcm16 = this.pendingPcm16.slice(INPUT_SAMPLES_PER_CHUNK);
      this.session.sendAudioChunk(nextChunk);
    }
  }

  playTranslatedAudio(base64Audio) {
    if (!this.audioContext) {
      return;
    }

    const pcm16 = base64ToInt16Array(base64Audio);
    const audioBuffer = this.audioContext.createBuffer(1, pcm16.length, OUTPUT_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < pcm16.length; i += 1) {
      channelData[i] = pcm16[i] / 0x8000;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    if (this.replayCaptureDestination) {
      source.connect(this.replayCaptureDestination);
    }

    const startTime = Math.max(this.audioContext.currentTime + 0.02, this.playbackCursorTime);
    source.start(startTime);
    this.playbackCursorTime = startTime + audioBuffer.duration;
  }

  async startReplayRecording() {
    if (!this.audioContext || !this.replayCaptureDestination) {
      throw new Error("Start translation before starting a replay recording.");
    }

    if (this.replayRecorder?.state === "recording") {
      throw new Error("Replay recording is already in progress.");
    }

    this.replayRecordingMimeType = pickReplayRecordingMimeType();
    if (!this.replayRecordingMimeType) {
      throw new Error("This browser does not support WebM audio recording.");
    }

    this.replayRecordingBlob = null;
    this.replayRecorderChunks = [];
    this.replayRecorder = new MediaRecorder(this.replayCaptureDestination.stream, {
      mimeType: this.replayRecordingMimeType
    });
    this.replayRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.replayRecorderChunks.push(event.data);
      }
    };
    this.replayRecorder.start(1000);
    emitDebug(this.tabId, "Replay recording started", { mimeType: this.replayRecordingMimeType });
    return {
      hasReplay: false,
      isRecording: true,
      mimeType: this.replayRecordingMimeType
    };
  }

  async stopReplayRecording() {
    if (!this.replayRecorder || this.replayRecorder.state !== "recording") {
      return {
        hasReplay: Boolean(this.replayRecordingBlob),
        isRecording: false,
        mimeType: this.replayRecordingMimeType || null
      };
    }

    const recorder = this.replayRecorder;
    await new Promise((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          this.replayRecordingBlob = new Blob(this.replayRecorderChunks, {
            type: this.replayRecordingMimeType || "audio/webm"
          });
          this.replayRecorderChunks = [];
          resolve();
        },
        { once: true }
      );
      recorder.stop();
    });
    emitDebug(this.tabId, "Replay recording stopped", {
      byteLength: this.replayRecordingBlob?.size || 0,
      mimeType: this.replayRecordingMimeType || null
    });
    return {
      hasReplay: Boolean(this.replayRecordingBlob && this.replayRecordingBlob.size > 0),
      isRecording: false,
      mimeType: this.replayRecordingMimeType || null
    };
  }

  async exportReplayRecording() {
    if (this.replayRecorder?.state === "recording") {
      throw new Error("Stop recording before saving the replay.");
    }

    if (!this.replayRecordingBlob || this.replayRecordingBlob.size === 0) {
      throw new Error("No replay recording is available yet.");
    }

    const buffer = await this.replayRecordingBlob.arrayBuffer();
    return {
      bytes: Array.from(new Uint8Array(buffer)),
      extension: "webm",
      fileName: `polyglot-live_replay_tab-${this.tabId}_${buildTimestampForFile(new Date())}.webm`,
      hasReplay: true,
      isRecording: false,
      mimeType: this.replayRecordingMimeType || this.replayRecordingBlob.type || "audio/webm"
    };
  }

  getReplayRecordingState() {
    return {
      ok: true,
      hasReplay: Boolean(this.replayRecordingBlob),
      isRecording: this.replayRecorder?.state === "recording",
      mimeType: this.replayRecordingMimeType || null
    };
  }
}

class GeminiTranslateSession {
  constructor({ onTranslatedAudio, tabId, targetLanguage, tokenEndpoint, tokenSecret }) {
    this.onTranslatedAudio = onTranslatedAudio;
    this.tabId = tabId;
    this.targetLanguage = targetLanguage;
    this.tokenEndpoint = tokenEndpoint;
    this.tokenSecret = tokenSecret;
    this.chunksSent = 0;
    this.closedByClient = false;
    this.isReady = false;
    this.isConnecting = false;
    this.pendingAudioChunks = [];
    this.resumptionHandle = null;
    this.liveSession = null;
    this.websocket = null;
    this.lastAudioReceiveAt = 0;
    this.audioWatchdogId = null;
    this.rawChunksObserved = 0;
    this.didCompleteSetup = false;
    this.setupTimeoutId = null;
    this.hasEmittedTranslatedAudioStart = false;
  }

  async connect() {
    this.closedByClient = false;
    this.isConnecting = true;
    this.didCompleteSetup = false;
    emitDebug(this.tabId, "Requesting ephemeral token", {
      targetLanguage: this.targetLanguage,
      tokenEndpoint: this.tokenEndpoint
    });
    emitStatus(this.tabId, "auth", "Requesting ephemeral token...");

    const token = await this.fetchEphemeralToken();
    await this.openLiveSession(token);
  }

  sendAudioChunk(chunk) {
    this.rawChunksObserved += 1;
    if (!this.isReady || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.pendingAudioChunks.push(chunk);
      return;
    }

    this.chunksSent += 1;
    this.websocket.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: pcm16ToBase64(chunk),
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`
          }
        }
      })
    );

    if (this.chunksSent === 1) {
      emitDebug(this.tabId, "First PCM16 chunk sent", {
        bytes: chunk.byteLength,
        chunkSamples: chunk.length,
        chunkDurationMs: CHUNK_DURATION_MS
      });
      emitStatus(this.tabId, "streaming", `Sent first audio chunk to Gemini for ${this.targetLanguage}.`);
      this.startAudioWatchdog();
    }

    if (this.chunksSent % 10 === 0) {
      emitDebug(this.tabId, "PCM16 traffic milestone", {
        chunksSent: this.chunksSent,
        pendingQueuedChunks: this.pendingAudioChunks.length,
        lastAudioReceiveAt: this.lastAudioReceiveAt || null
      });
    }
  }

  async close() {
    this.closedByClient = true;
    this.isReady = false;
    this.pendingAudioChunks = [];
    this.stopAudioWatchdog();
    emitDebug(this.tabId, "Closing Gemini session", {
      chunksSent: this.chunksSent,
      hadTranslatedAudio: this.lastAudioReceiveAt > 0
    });
    if (this.setupTimeoutId) {
      clearTimeout(this.setupTimeoutId);
      this.setupTimeoutId = null;
    }

    if (this.liveSession) {
      this.liveSession.close();
      this.liveSession = null;
    }

    if (this.websocket) {
      const websocket = this.websocket;
      this.websocket = null;
      await new Promise((resolve) => {
        const finish = () => resolve();
        websocket.addEventListener("close", finish, { once: true });
        if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
          websocket.close(1000, "Client stop");
          setTimeout(resolve, 1000);
          return;
        }
        resolve();
      });
    }

    emitStatus(this.tabId, "idle", "Gemini session closed.");
  }

  async fetchEphemeralToken() {
    const headers = {
      "content-type": "application/json"
    };

    if (this.tokenSecret) {
      headers["x-polyglot-live-secret"] = this.tokenSecret;
    }

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: GEMINI_MODEL,
        targetLanguage: this.targetLanguage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token endpoint failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();

    if (!payload?.token) {
      throw new Error("Token endpoint response did not include a token.");
    }

    emitDebug(this.tabId, "Ephemeral token accepted", {
      tokenNameSuffix: String(payload.token).slice(-12)
    });
    return payload.token;
  }

  async openLiveSession(token) {
    await new Promise((resolve, reject) => {
      let settled = false;
      let optimisticReadyTimeoutId = null;

      this.setupTimeoutId = setTimeout(() => {
        if (settled || this.isReady) {
          return;
        }

        emitDebug(this.tabId, "Setup timed out waiting for setupComplete");
        emitStatus(this.tabId, "error", "Timed out waiting for Gemini setup confirmation.");
        settled = true;
        if (this.websocket) {
          this.websocket.close(1000, "Setup timeout");
          this.websocket = null;
        }
        reject(new Error("Timed out waiting for Gemini setup confirmation."));
      }, 12000);

      try {
        this.websocket = new WebSocket(`${LIVE_URL}?access_token=${encodeURIComponent(token)}`);
        this.liveSession = {
          close: () => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
              this.websocket.close(1000, "Client close");
            }
          }
        };

        this.websocket.onopen = () => {
          const setup = {
            setup: {
              model: `models/${GEMINI_MODEL}`,
              generationConfig: {
                responseModalities: ["AUDIO"]
              }
            }
          };

          emitDebug(this.tabId, "Gemini websocket opened");
          emitStatus(this.tabId, "connecting", "Gemini Live websocket connected. Sending setup...");
          this.websocket.send(JSON.stringify(setup));
          emitDebug(this.tabId, "Setup payload sent", setup);

          optimisticReadyTimeoutId = setTimeout(() => {
            if (settled || this.isReady || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
              return;
            }

            this.isConnecting = false;
            this.isReady = true;
            this.didCompleteSetup = false;
            if (this.setupTimeoutId) {
              clearTimeout(this.setupTimeoutId);
              this.setupTimeoutId = null;
            }
            emitDebug(this.tabId, "No explicit setupComplete received; proceeding with audio stream");
            emitStatus(this.tabId, "running", `Translating live audio to ${this.targetLanguage}.`);
            this.flushPendingAudio();
            if (!settled) {
              settled = true;
              resolve();
            }
          }, 750);
        };

        this.websocket.onmessage = async (event) => {
          let rawPayload = event.data;

          if (rawPayload instanceof Blob) {
            rawPayload = await rawPayload.text();
          }

          if (typeof rawPayload !== "string") {
            emitDebug(this.tabId, "Gemini websocket non-text frame received", {
              constructorName: rawPayload?.constructor?.name || typeof rawPayload
            });
            return;
          }

          let message;
          try {
            message = JSON.parse(rawPayload);
          } catch (error) {
            emitDebug(this.tabId, "Gemini websocket non-JSON text frame received", {
              preview: rawPayload.slice(0, 200)
            });
            return;
          }

          emitDebug(this.tabId, "Gemini websocket message received", message);
          this.handleServerMessage(message);

          if (message.setupComplete) {
            this.isConnecting = false;
            this.isReady = true;
            this.didCompleteSetup = true;
            if (optimisticReadyTimeoutId) {
              clearTimeout(optimisticReadyTimeoutId);
              optimisticReadyTimeoutId = null;
            }
            if (this.setupTimeoutId) {
              clearTimeout(this.setupTimeoutId);
              this.setupTimeoutId = null;
            }
            emitStatus(this.tabId, "running", `Translating live audio to ${this.targetLanguage}.`);
            emitDebug(this.tabId, "Setup complete acknowledged by Gemini");
            this.flushPendingAudio();
            if (!settled) {
              settled = true;
              resolve();
            }
          }
        };

        this.websocket.onerror = () => {
          emitDebug(this.tabId, "Gemini websocket error event");
          if (optimisticReadyTimeoutId) {
            clearTimeout(optimisticReadyTimeoutId);
            optimisticReadyTimeoutId = null;
          }
          if (this.setupTimeoutId) {
            clearTimeout(this.setupTimeoutId);
            this.setupTimeoutId = null;
          }
          if (!settled) {
            settled = true;
            reject(new Error("Gemini Live websocket error."));
          }
        };

        this.websocket.onclose = (event) => {
          emitDebug(this.tabId, "Gemini websocket closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          if (optimisticReadyTimeoutId) {
            clearTimeout(optimisticReadyTimeoutId);
            optimisticReadyTimeoutId = null;
          }
          if (this.setupTimeoutId) {
            clearTimeout(this.setupTimeoutId);
            this.setupTimeoutId = null;
          }
          this.isConnecting = false;
          this.isReady = false;
          this.liveSession = null;
          this.websocket = null;

          if (!settled) {
            settled = true;
            reject(
              new Error(
                `Gemini Live websocket closed before setup completed (code ${event.code}${
                  event.reason ? `, reason: ${event.reason}` : ""
                }).`
              )
            );
          }
        };
      } catch (error) {
        if (this.setupTimeoutId) {
          clearTimeout(this.setupTimeoutId);
          this.setupTimeoutId = null;
        }
        if (!settled) {
          settled = true;
          reject(error);
        }
      }
    });
  }

  handleServerMessage(response) {
    if (response.sessionResumptionUpdate?.resumable && response.sessionResumptionUpdate.newHandle) {
      this.resumptionHandle = response.sessionResumptionUpdate.newHandle;
      emitDebug(this.tabId, "Received session resumption handle", {
        handleSuffix: String(this.resumptionHandle).slice(-12)
      });
    }

    if (response.goAway) {
      emitStatus(this.tabId, "reconnecting", "Gemini sent a go-away notice. Waiting to resume...");
    }

    if (response.serverContent?.inputTranscription?.text) {
      chrome.runtime.sendMessage({
        type: "SESSION_EVENT",
        tabId: this.tabId,
        event: "transcript",
        payload: {
          kind: "input",
          text: `Input: ${response.serverContent.inputTranscription.text}`
        }
      });
    }

    if (response.serverContent?.outputTranscription?.text) {
      chrome.runtime.sendMessage({
        type: "SESSION_EVENT",
        tabId: this.tabId,
        event: "transcript",
        payload: {
          kind: "output",
          text: `Output: ${response.serverContent.outputTranscription.text}`
        }
      });
    }

    const parts = response.serverContent?.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        this.lastAudioReceiveAt = Date.now();
        const audioDurationMs = estimateTranslatedAudioDurationMs(part.inlineData.data);
        emitDebug(this.tabId, "Translated audio packet received", {
          durationMs: audioDurationMs,
          base64Length: part.inlineData.data.length,
          mimeType: part.inlineData.mimeType || null
        });
        if (!this.hasEmittedTranslatedAudioStart) {
          this.hasEmittedTranslatedAudioStart = true;
          chrome.runtime.sendMessage({
            type: "SESSION_EVENT",
            tabId: this.tabId,
            event: "translated_audio_started",
            payload: {
              targetLanguage: this.targetLanguage
            }
          });
          emitDebug(this.tabId, "First translated audio packet received");
        }
        chrome.runtime.sendMessage({
          type: "SESSION_EVENT",
          tabId: this.tabId,
          event: "audio_timing",
          payload: {
            durationMs: audioDurationMs,
            kind: "output_audio"
          }
        });
        emitStatus(this.tabId, "running", `Receiving translated audio for ${this.targetLanguage}.`);
        this.onTranslatedAudio(part.inlineData.data);
      }
    }
  }

  flushPendingAudio() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    for (const chunk of this.pendingAudioChunks) {
      this.chunksSent += 1;
      this.websocket.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: pcm16ToBase64(chunk),
              mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`
            }
          }
        })
      );
    }

    this.pendingAudioChunks = [];
    emitDebug(this.tabId, "Flushed queued audio chunks", {
      chunksSent: this.chunksSent
    });
  }

  startAudioWatchdog() {
    this.stopAudioWatchdog();
    this.audioWatchdogId = setInterval(() => {
      if (!this.isReady || this.closedByClient) {
        return;
      }

      if (this.lastAudioReceiveAt === 0 && this.chunksSent >= 10) {
        emitDebug(this.tabId, "No translated audio returned yet", {
          chunksSent: this.chunksSent,
          targetLanguage: this.targetLanguage
        });
        emitStatus(
          this.tabId,
          "streaming",
          `Audio is being sent to Gemini, but no translated audio has returned yet for ${this.targetLanguage}.`
        );
      }
    }, 3000);
  }

  stopAudioWatchdog() {
    if (this.audioWatchdogId) {
      clearInterval(this.audioWatchdogId);
      this.audioWatchdogId = null;
    }
  }
}

function emitStatus(tabId, phase, message) {
  chrome.runtime.sendMessage({
    type: "SESSION_EVENT",
    tabId,
    event: "status",
    payload: { phase, message }
  });
}

function emitDebug(tabId, message, details = undefined) {
  chrome.runtime
    .sendMessage({
      type: "SESSION_DEBUG",
      tabId,
      payload: {
        message,
        details
      }
    })
    .catch(() => {
      return undefined;
    });
}

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (outputSampleRate >= inputSampleRate) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function float32ToPcm16(float32Buffer) {
  const output = new Int16Array(float32Buffer.length);

  for (let i = 0; i < float32Buffer.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Buffer[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function concatInt16Arrays(left, right) {
  const result = new Int16Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

function pcm16ToBase64(samples) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function base64ToInt16Array(base64Value) {
  const binary = atob(base64Value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Int16Array(bytes.buffer);
}

function pickReplayRecordingMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function buildTimestampForFile(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

function estimateTranslatedAudioDurationMs(base64Audio) {
  const pcm16 = base64ToInt16Array(base64Audio);
  return Math.round((pcm16.length / OUTPUT_SAMPLE_RATE) * 1000);
}
