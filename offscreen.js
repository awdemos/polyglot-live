import {
  CHUNK_DURATION_MS,
  GEMINI_MODEL,
  INPUT_SAMPLE_RATE,
  INPUT_SAMPLES_PER_CHUNK,
  LIVE_URL,
  OUTPUT_SAMPLE_RATE
} from "./config.js";

let audioContext = null;
let mediaStream = null;
let sourceNode = null;
let processorNode = null;
let passThroughGain = null;
let replayCaptureDestination = null;
let replayRecorder = null;
let replayRecorderChunks = [];
let replayRecordingBlob = null;
let replayRecordingMimeType = "";
let session = null;
let pendingPcm16 = new Int16Array(0);
let playbackCursorTime = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OFFSCREEN_START") {
    startPipeline(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_STOP") {
    stopPipeline()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_START") {
    startReplayRecording()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_STOP") {
    stopReplayRecording()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_EXPORT") {
    exportReplayRecording()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OFFSCREEN_RECORD_STATE") {
    sendResponse({
      ok: true,
      hasReplay: Boolean(replayRecordingBlob),
      isRecording: replayRecorder?.state === "recording",
      mimeType: replayRecordingMimeType || null
    });
    return false;
  }

  return false;
});

async function startPipeline({ streamId, targetLanguage, passThroughOriginalAudio, tokenEndpoint, tokenSecret }) {
  console.info("[polyglot-live/offscreen] start pipeline", { streamId, targetLanguage, tokenEndpoint });
  emitDebug("Starting offscreen pipeline", {
    passThroughOriginalAudio,
    streamId,
    targetLanguage,
    tokenEndpoint
  });
  emitStatus("starting", "Initializing offscreen audio pipeline...");
  await stopPipeline();

  session = new GeminiTranslateSession({ targetLanguage, tokenEndpoint, tokenSecret });
  await session.connect();

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });
  emitDebug("Tab media stream acquired", {
    audioTrackCount: mediaStream.getAudioTracks().length,
    targetLanguage
  });

  audioContext = new AudioContext({ sampleRate: 48000 });
  emitDebug("Audio context created", { sampleRate: audioContext.sampleRate });
  await audioContext.audioWorklet.addModule("offscreen-audio-processor.js");
  replayCaptureDestination = audioContext.createMediaStreamDestination();
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  processorNode = new AudioWorkletNode(audioContext, "polyglot-live-capture-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  });
  passThroughGain = audioContext.createGain();
  passThroughGain.gain.value = passThroughOriginalAudio ? 1 : 0;
  emitDebug("Audio nodes wired", {
    passThroughGain: passThroughGain.gain.value,
    processorType: "AudioWorkletNode"
  });

  sourceNode.connect(passThroughGain);
  passThroughGain.connect(audioContext.destination);

  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);
  processorNode.port.onmessage = (event) => {
    const channelData = event.data;
    const pcm16 = float32ToPcm16(downsampleBuffer(channelData, audioContext.sampleRate, INPUT_SAMPLE_RATE));
    enqueuePcm16(pcm16);
  };

  emitStatus("streaming", `Streaming tab audio to Gemini for ${targetLanguage}. Waiting for translated audio...`);
}

async function stopPipeline() {
  console.info("[polyglot-live/offscreen] stop pipeline");
  if (processorNode) {
    processorNode.disconnect();
    processorNode.port.onmessage = null;
    processorNode = null;
  }

  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  if (passThroughGain) {
    passThroughGain.disconnect();
    passThroughGain = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  if (session) {
    await session.close();
    session = null;
  }

  if (replayRecorder?.state === "recording") {
    await stopReplayRecording();
  }

  replayRecorder = null;
  replayRecorderChunks = [];
  replayRecordingBlob = null;
  replayRecordingMimeType = "";
  replayCaptureDestination = null;

  pendingPcm16 = new Int16Array(0);
  playbackCursorTime = 0;
}

function emitStatus(phase, message) {
  chrome.runtime.sendMessage({
    type: "SESSION_EVENT",
    event: "status",
    payload: { phase, message }
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

function enqueuePcm16(chunk) {
  pendingPcm16 = concatInt16Arrays(pendingPcm16, chunk);

  while (pendingPcm16.length >= INPUT_SAMPLES_PER_CHUNK) {
    const nextChunk = pendingPcm16.slice(0, INPUT_SAMPLES_PER_CHUNK);
    pendingPcm16 = pendingPcm16.slice(INPUT_SAMPLES_PER_CHUNK);
    session.sendAudioChunk(nextChunk);
  }
}

function concatInt16Arrays(left, right) {
  const result = new Int16Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

class GeminiTranslateSession {
  constructor({ targetLanguage, tokenEndpoint, tokenSecret }) {
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
    console.info("[polyglot-live/offscreen] requesting ephemeral token", {
      targetLanguage: this.targetLanguage,
      tokenEndpoint: this.tokenEndpoint
    });
    emitDebug("Requesting ephemeral token", {
      targetLanguage: this.targetLanguage,
      tokenEndpoint: this.tokenEndpoint
    });
    emitStatus("auth", "Requesting ephemeral token...");

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
      emitDebug("First PCM16 chunk sent", {
        bytes: chunk.byteLength,
        chunkSamples: chunk.length,
        chunkDurationMs: CHUNK_DURATION_MS
      });
      emitStatus("streaming", `Sent first audio chunk to Gemini for ${this.targetLanguage}.`);
      this.startAudioWatchdog();
    }

    if (this.chunksSent % 10 === 0) {
      emitDebug("PCM16 traffic milestone", {
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
    emitDebug("Closing Gemini session", {
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

    emitStatus("idle", "Gemini session closed.");
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

    console.info("[polyglot-live/offscreen] ephemeral token accepted");
    emitDebug("Ephemeral token accepted", {
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

        console.error("[polyglot-live/offscreen] setup timed out");
        emitDebug("Setup timed out waiting for setupComplete");
        emitStatus("error", "Timed out waiting for Gemini setup confirmation.");
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

          console.info("[polyglot-live/offscreen] websocket open");
          emitDebug("Gemini websocket opened");
          emitStatus("connecting", "Gemini Live websocket connected. Sending setup...");
          this.websocket.send(JSON.stringify(setup));
          emitDebug("Setup payload sent", setup);

          // The public raw WebSocket docs do not require an explicit setupComplete
          // event before the client starts streaming audio, so proceed if the socket
          // stays open and no schema error is returned immediately.
          optimisticReadyTimeoutId = setTimeout(() => {
            if (settled || this.isReady || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
              return;
            }

            console.info("[polyglot-live/offscreen] no explicit setupComplete; proceeding");
            this.isConnecting = false;
            this.isReady = true;
            this.didCompleteSetup = false;
            if (this.setupTimeoutId) {
              clearTimeout(this.setupTimeoutId);
              this.setupTimeoutId = null;
            }
            emitDebug("No explicit setupComplete received; proceeding with audio stream");
            emitStatus("running", `Translating live audio to ${this.targetLanguage}.`);
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
            emitDebug("Gemini websocket non-text frame received", {
              constructorName: rawPayload?.constructor?.name || typeof rawPayload
            });
            return;
          }

          let message;
          try {
            message = JSON.parse(rawPayload);
          } catch (error) {
            emitDebug("Gemini websocket non-JSON text frame received", {
              preview: rawPayload.slice(0, 200)
            });
            return;
          }

          emitDebug("Gemini websocket message received", message);
          this.handleServerMessage(message);

          if (message.setupComplete) {
            console.info("[polyglot-live/offscreen] setup complete");
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
            emitStatus("running", `Translating live audio to ${this.targetLanguage}.`);
            emitDebug("Setup complete acknowledged by Gemini");
            this.flushPendingAudio();
            if (!settled) {
              settled = true;
              resolve();
            }
          }
        };

        this.websocket.onerror = () => {
          console.error("[polyglot-live/offscreen] websocket error");
          emitDebug("Gemini websocket error event");
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
          console.info("[polyglot-live/offscreen] websocket closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          emitDebug("Gemini websocket closed", {
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
      emitDebug("Received session resumption handle", {
        handleSuffix: String(this.resumptionHandle).slice(-12)
      });
    }

    if (response.goAway) {
      emitStatus("reconnecting", "Gemini sent a go-away notice. Waiting to resume...");
    }

    if (response.serverContent?.inputTranscription?.text) {
      chrome.runtime.sendMessage({
        type: "SESSION_EVENT",
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
        emitDebug("Translated audio packet received", {
          durationMs: audioDurationMs,
          base64Length: part.inlineData.data.length,
          mimeType: part.inlineData.mimeType || null
        });
        if (!this.hasEmittedTranslatedAudioStart) {
          this.hasEmittedTranslatedAudioStart = true;
          chrome.runtime.sendMessage({
            type: "SESSION_EVENT",
            event: "translated_audio_started",
            payload: {
              targetLanguage: this.targetLanguage
            }
          });
          emitDebug("First translated audio packet received");
        }
        chrome.runtime.sendMessage({
          type: "SESSION_EVENT",
          event: "audio_timing",
          payload: {
            durationMs: audioDurationMs,
            kind: "output_audio"
          }
        });
        emitStatus("running", `Receiving translated audio for ${this.targetLanguage}.`);
        playTranslatedAudio(part.inlineData.data);
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
    emitDebug("Flushed queued audio chunks", {
      chunksSent: this.chunksSent
    });
  }

  async reconnect() {
    emitStatus("error", "Automatic reconnect is disabled during handshake debugging.");
  }

  startAudioWatchdog() {
    this.stopAudioWatchdog();
    this.audioWatchdogId = setInterval(() => {
      if (!this.isReady || this.closedByClient) {
        return;
      }

      if (this.lastAudioReceiveAt === 0 && this.chunksSent >= 10) {
        emitDebug("No translated audio returned yet", {
          chunksSent: this.chunksSent,
          targetLanguage: this.targetLanguage
        });
        emitStatus(
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

function playTranslatedAudio(base64Audio) {
  if (!audioContext) {
    return;
  }

  const pcm16 = base64ToInt16Array(base64Audio);
  const audioBuffer = audioContext.createBuffer(1, pcm16.length, OUTPUT_SAMPLE_RATE);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < pcm16.length; i += 1) {
    channelData[i] = pcm16[i] / 0x8000;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  if (replayCaptureDestination) {
    source.connect(replayCaptureDestination);
  }

  const startTime = Math.max(audioContext.currentTime + 0.02, playbackCursorTime);
  source.start(startTime);
  playbackCursorTime = startTime + audioBuffer.duration;
}

async function startReplayRecording() {
  if (!audioContext || !replayCaptureDestination) {
    throw new Error("Start translation before starting a replay recording.");
  }

  if (replayRecorder?.state === "recording") {
    throw new Error("Replay recording is already in progress.");
  }

  replayRecordingMimeType = pickReplayRecordingMimeType();
  if (!replayRecordingMimeType) {
    throw new Error("This browser does not support WebM audio recording.");
  }

  replayRecordingBlob = null;
  replayRecorderChunks = [];
  replayRecorder = new MediaRecorder(replayCaptureDestination.stream, {
    mimeType: replayRecordingMimeType
  });
  replayRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      replayRecorderChunks.push(event.data);
    }
  };
  replayRecorder.start(1000);
  emitDebug("Replay recording started", { mimeType: replayRecordingMimeType });
  return {
    hasReplay: false,
    isRecording: true,
    mimeType: replayRecordingMimeType
  };
}

async function stopReplayRecording() {
  if (!replayRecorder || replayRecorder.state !== "recording") {
    return {
      hasReplay: Boolean(replayRecordingBlob),
      isRecording: false,
      mimeType: replayRecordingMimeType || null
    };
  }

  const recorder = replayRecorder;
  await new Promise((resolve) => {
    recorder.addEventListener(
      "stop",
      () => {
        replayRecordingBlob = new Blob(replayRecorderChunks, {
          type: replayRecordingMimeType || "audio/webm"
        });
        replayRecorderChunks = [];
        resolve();
      },
      { once: true }
    );
    recorder.stop();
  });
  emitDebug("Replay recording stopped", {
    byteLength: replayRecordingBlob?.size || 0,
    mimeType: replayRecordingMimeType || null
  });
  return {
    hasReplay: Boolean(replayRecordingBlob && replayRecordingBlob.size > 0),
    isRecording: false,
    mimeType: replayRecordingMimeType || null
  };
}

async function exportReplayRecording() {
  if (replayRecorder?.state === "recording") {
    throw new Error("Stop recording before saving the replay.");
  }

  if (!replayRecordingBlob || replayRecordingBlob.size === 0) {
    throw new Error("No replay recording is available yet.");
  }

  const buffer = await replayRecordingBlob.arrayBuffer();
  return {
    bytes: Array.from(new Uint8Array(buffer)),
    extension: "webm",
    fileName: `polyglot-live_replay_${buildTimestampForFile(new Date())}.webm`,
    mimeType: replayRecordingMimeType || replayRecordingBlob.type || "audio/webm"
  };
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

function emitDebug(message, details = undefined) {
  chrome.runtime.sendMessage({
    type: "SESSION_DEBUG",
    payload: {
      message,
      details
    }
  }).catch(() => {
    return undefined;
  });
}
