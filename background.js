import { DEFAULT_TARGET_LANGUAGE_CODE, DEFAULT_TOKEN_ENDPOINT } from "./config.js";

const OFFSCREEN_PATH = "offscreen.html";
const CONTEXT_MENU_ID = "translate-tab-audio";
const DEFAULT_STATUS_MESSAGE = "Manual start only. Play tab audio first, then press Start in the side panel.";
const sessions = new Map();
const startingTabs = new Set();
const stoppingTabs = new Set();

chrome.runtime.onInstalled.addListener(async () => {
  console.info("[polyglot-live/background] installed");
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  console.info("[polyglot-live/background] startup");
  void createContextMenu();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void stopTranslation(tabId, { suppressStatusBroadcast: true }).finally(() => {
    sessions.delete(tabId);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) {
    return;
  }

  chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
    console.error("Unable to open side panel from context menu.", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "START_TRANSLATION") {
    startTranslation(message, sender)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_TRANSLATION") {
    stopTranslation(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CLEAR_TRANSCRIPTS") {
    clearSessionTranscripts(resolveTabIdFromMessage(message, sender));
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "START_REPLAY_RECORDING") {
    const tabId = resolveTabIdFromMessage(message, sender);
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_START", tabId })
      .then((payload) => {
        updateReplayState(tabId, payload);
        sendResponse(payload);
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_REPLAY_RECORDING") {
    const tabId = resolveTabIdFromMessage(message, sender);
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_STOP", tabId })
      .then((payload) => {
        updateReplayState(tabId, payload);
        sendResponse(payload);
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "EXPORT_REPLAY_RECORDING") {
    const tabId = resolveTabIdFromMessage(message, sender);
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_EXPORT", tabId })
      .then((payload) => {
        updateReplayState(tabId, { ...payload, hasReplay: true, isRecording: false });
        sendResponse(payload);
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_REPLAY_RECORDING_STATE") {
    const tabId = resolveTabIdFromMessage(message, sender);
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_STATE", tabId })
      .then((payload) => {
        updateReplayState(tabId, payload);
        sendResponse(payload);
      })
      .catch(() => sendResponse({ ok: true, hasReplay: false, isRecording: false }));
    return true;
  }

  if (message.type === "GET_SESSION_STATE") {
    const tabId = resolveTabIdFromMessage(message, sender);
    sendResponse({
      ok: true,
      ...buildSessionSnapshot(getSession(tabId))
    });
    return false;
  }

  if (message.type === "SESSION_EVENT") {
    handleSessionEvent(message);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SESSION_DEBUG") {
    console.info(
      "[polyglot-live/offscreen->background]",
      message.payload?.message,
      message.payload?.details || "",
      message.tabId ? { tabId: message.tabId } : ""
    );
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function startTranslation(message, sender) {
  console.info("[polyglot-live/background] start requested", {
    targetLanguage: message.targetLanguage,
    passThroughOriginalAudio: message.passThroughOriginalAudio,
    tabId: message.tabId
  });
  const tabId = await resolveTabIdForStart(message, sender);
  return startTranslationFromTab(tabId, {
    passThroughOriginalAudio: message.passThroughOriginalAudio,
    targetLanguage: message.targetLanguage
  });
}

async function getAuthConfig() {
  const { authConfig = {} } = await chrome.storage.local.get("authConfig");
  return {
    tokenEndpoint: authConfig.tokenEndpoint || DEFAULT_TOKEN_ENDPOINT,
    tokenSecret: authConfig.tokenSecret || ""
  };
}

async function getTranslationPreferences() {
  const { translationPrefs = {} } = await chrome.storage.local.get("translationPrefs");
  return {
    passThroughOriginalAudio: Boolean(translationPrefs.passThroughOriginalAudio),
    targetLanguage: translationPrefs.targetLanguage || DEFAULT_TARGET_LANGUAGE_CODE
  };
}

async function startTranslationFromTab(tabId, requestedOptions = null) {
  if (!tabId) {
    throw new Error("No active tab is available for capture.");
  }

  if (startingTabs.has(tabId)) {
    throw new Error("A translation session is already starting on this tab. Please wait a moment.");
  }

  if (stoppingTabs.has(tabId)) {
    throw new Error("A translation session is stopping on this tab. Please wait a moment.");
  }

  startingTabs.add(tabId);
  console.info("[polyglot-live/background] preparing translation session", { requestedOptions, tabId });

  try {
    const translationPrefs = requestedOptions || (await getTranslationPreferences());
    const sessionState = getSession(tabId);
    resetSessionTranscripts(sessionState);
    updateSessionState(tabId, "starting", `Starting translation for ${translationPrefs.targetLanguage}...`);

    if (sessionState.activeSession) {
      console.info("[polyglot-live/background] restarting existing session", {
        tabId,
        previousTargetLanguage: sessionState.targetLanguage
      });
      await stopTranslation(tabId, { suppressStatusBroadcast: true });
      updateSessionState(tabId, "starting", `Restarting translation for ${translationPrefs.targetLanguage}...`);
    }

    await ensureOffscreenDocument();

    const authConfig = await getAuthConfig();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    console.info("[polyglot-live/background] tab capture stream acquired", {
      tabId,
      targetLanguage: translationPrefs.targetLanguage
    });

    sessionState.activeSession = true;
    sessionState.authConfig = authConfig;
    sessionState.awaitingTranslatedAudioStart = false;
    sessionState.didPauseSourceMedia = false;
    sessionState.startedAt = Date.now();
    sessionState.tabId = tabId;
    sessionState.targetLanguage = translationPrefs.targetLanguage;

    const pauseResult = await pauseTabMedia(tabId);
    sessionState.didPauseSourceMedia = pauseResult.didPausePlayback;
    sessionState.awaitingTranslatedAudioStart = pauseResult.didPausePlayback;
    console.info("[polyglot-live/background] source media pause result", { tabId, ...pauseResult });

    const offscreenResponse = await chrome.runtime.sendMessage({
      type: "OFFSCREEN_START",
      payload: {
        passThroughOriginalAudio: translationPrefs.passThroughOriginalAudio,
        streamId,
        tabId,
        tokenEndpoint: authConfig.tokenEndpoint,
        tokenSecret: authConfig.tokenSecret,
        targetLanguage: translationPrefs.targetLanguage
      }
    });

    if (!offscreenResponse?.ok) {
      if (sessionState.didPauseSourceMedia) {
        await resumePausedTabMedia(tabId);
      }
      clearSessionRuntime(sessionState);
      console.error("[polyglot-live/background] offscreen start failed", offscreenResponse);
      throw new Error(offscreenResponse?.error || "Offscreen pipeline failed to start.");
    }

    updateSessionState(tabId, "starting", `Capturing tab audio for ${translationPrefs.targetLanguage}.`);
    return { tabId };
  } catch (error) {
    updateSessionState(tabId, "error", error.message);
    throw error;
  } finally {
    startingTabs.delete(tabId);
  }
}

async function stopTranslation(tabId, { suppressStatusBroadcast = false } = {}) {
  if (!tabId) {
    return;
  }

  const sessionState = getSession(tabId);
  console.info("[polyglot-live/background] stop requested", { tabId });

  if (stoppingTabs.has(tabId)) {
    updateSessionState(tabId, "stopping", "Translation is already stopping...");
    return;
  }

  stoppingTabs.add(tabId);
  updateSessionState(tabId, "stopping", "Stopping translation...");

  await ensureOffscreenDocument();
  try {
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP", tabId }).catch((error) => {
      console.warn("[polyglot-live/background] offscreen stop failed", { tabId, error });
      return { ok: false };
    });
  } finally {
    await resumePausedTabMedia(tabId);
    clearSessionRuntime(sessionState);
    stoppingTabs.delete(tabId);
  }

  if (!suppressStatusBroadcast) {
    updateSessionState(tabId, "idle", "Translation stopped.");
  }
}

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });

  if (existingContexts.length > 0) {
    console.info("[polyglot-live/background] offscreen document already active");
    return;
  }

  console.info("[polyglot-live/background] creating offscreen document");
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
    justification: "Capture tab audio, process PCM, and play translated audio."
  });
}

function broadcastToViews(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    return undefined;
  });
}

function updateSessionState(tabId, phase, message) {
  const sessionState = getSession(tabId);
  sessionState.phase = phase;
  sessionState.statusMessage = message;
  broadcastToViews({
    type: "SESSION_EVENT",
    tabId,
    event: "status",
    payload: {
      phase,
      message
    }
  });
}

async function forwardToOffscreen(message) {
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage(message);
  return response || { ok: false, error: "Offscreen document did not respond." };
}

async function createContextMenu() {
  console.info("[polyglot-live/background] rebuilding context menu");
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    contexts: ["page", "video", "audio"],
    id: CONTEXT_MENU_ID,
    title: "Open polyglot-live for this tab"
  });
}

async function pauseTabMedia(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { allFrames: true, tabId },
      func: pauseMediaElementsForPolyglot
    });
    const pausedCount = results.reduce((sum, frame) => sum + Number(frame.result?.pausedCount || 0), 0);
    const scannedCount = results.reduce((sum, frame) => sum + Number(frame.result?.scannedCount || 0), 0);
    return {
      didPausePlayback: pausedCount > 0,
      pausedCount,
      scannedCount
    };
  } catch (error) {
    console.warn("[polyglot-live/background] unable to pause source media", { tabId, error });
    return {
      didPausePlayback: false,
      pausedCount: 0,
      scannedCount: 0
    };
  }
}

async function resumePausedTabMedia(tabId) {
  const sessionState = getSession(tabId);
  if (!sessionState.activeSession && !sessionState.didPauseSourceMedia) {
    return;
  }

  if (!sessionState.didPauseSourceMedia) {
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { allFrames: true, tabId },
      func: resumeMediaElementsForPolyglot
    });
    const resumedCount = results.reduce((sum, frame) => sum + Number(frame.result?.resumedCount || 0), 0);
    console.info("[polyglot-live/background] source media resume result", { resumedCount, tabId });
  } catch (error) {
    console.warn("[polyglot-live/background] unable to resume source media", { tabId, error });
  } finally {
    sessionState.awaitingTranslatedAudioStart = false;
    sessionState.didPauseSourceMedia = false;
  }
}

function pauseMediaElementsForPolyglot() {
  const mediaElements = Array.from(document.querySelectorAll("audio, video"));
  let pausedCount = 0;

  for (const element of mediaElements) {
    if (!element.paused && !element.ended) {
      element.dataset.polyglotLiveResume = "1";
      element.pause();
      pausedCount += 1;
      continue;
    }

    delete element.dataset.polyglotLiveResume;
  }

  return {
    pausedCount,
    scannedCount: mediaElements.length
  };
}

function resumeMediaElementsForPolyglot() {
  const mediaElements = Array.from(document.querySelectorAll("audio, video"));
  let resumedCount = 0;

  for (const element of mediaElements) {
    if (element.dataset.polyglotLiveResume === "1") {
      delete element.dataset.polyglotLiveResume;
      const playAttempt = element.play?.();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => {
          return undefined;
        });
      }
      resumedCount += 1;
    }
  }

  return {
    resumedCount
  };
}

function resolveTabIdFromMessage(message, sender) {
  return message?.tabId || sender?.tab?.id || null;
}

async function resolveTabIdForStart(message, sender) {
  const explicitTabId = resolveTabIdFromMessage(message, sender);
  if (explicitTabId) {
    return explicitTabId;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id || null;
}

function getSession(tabId) {
  if (!sessions.has(tabId)) {
    sessions.set(tabId, createSessionState(tabId));
  }
  return sessions.get(tabId);
}

function createSessionState(tabId) {
  return {
    activeSession: false,
    authConfig: null,
    awaitingTranslatedAudioStart: false,
    didPauseSourceMedia: false,
    phase: "idle",
    replay: {
      hasReplay: false,
      isRecording: false
    },
    startedAt: null,
    statusMessage: DEFAULT_STATUS_MESSAGE,
    tabId,
    targetLanguage: DEFAULT_TARGET_LANGUAGE_CODE,
    transcripts: {
      input: "",
      output: ""
    }
  };
}

function clearSessionRuntime(sessionState) {
  sessionState.activeSession = false;
  sessionState.awaitingTranslatedAudioStart = false;
  sessionState.didPauseSourceMedia = false;
  sessionState.startedAt = null;
  sessionState.replay = {
    hasReplay: false,
    isRecording: false
  };
}

function resetSessionTranscripts(sessionState) {
  sessionState.transcripts.input = "";
  sessionState.transcripts.output = "";
}

function clearSessionTranscripts(tabId) {
  if (!tabId) {
    return;
  }

  const sessionState = getSession(tabId);
  resetSessionTranscripts(sessionState);
  broadcastToViews({
    type: "SESSION_EVENT",
    tabId,
    event: "transcripts_cleared",
    payload: {}
  });
}

function buildSessionSnapshot(sessionState) {
  return {
    activeSession: sessionState.activeSession,
    isStarting: startingTabs.has(sessionState.tabId),
    isStopping: stoppingTabs.has(sessionState.tabId),
    phase: sessionState.phase,
    replay: { ...sessionState.replay },
    statusMessage: sessionState.statusMessage,
    tabId: sessionState.tabId,
    targetLanguage: sessionState.targetLanguage,
    transcripts: { ...sessionState.transcripts }
  };
}

function handleSessionEvent(message) {
  const tabId = message.tabId;
  if (!tabId) {
    return;
  }

  const sessionState = getSession(tabId);
  if (message.event === "status" && message.payload) {
    sessionState.phase = message.payload.phase || sessionState.phase;
    sessionState.statusMessage = message.payload.message || sessionState.statusMessage;
  }

  if (message.event === "transcript" && message.payload) {
    const transcriptKind = message.payload.kind === "input" ? "input" : message.payload.kind === "output" ? "output" : null;
    if (transcriptKind) {
      const normalizedText = normalizeTranscriptText(message.payload.text || "", transcriptKind);
      if (normalizedText) {
        sessionState.transcripts[transcriptKind] = mergeTranscriptText(
          sessionState.transcripts[transcriptKind],
          normalizedText
        );
      }
    }
  }

  if (message.event === "translated_audio_started") {
    void resumePausedTabMedia(tabId);
  }

  broadcastToViews(message);
}

function updateReplayState(tabId, payload) {
  if (!tabId) {
    return;
  }

  const sessionState = getSession(tabId);
  sessionState.replay = {
    hasReplay: Boolean(payload?.hasReplay),
    isRecording: Boolean(payload?.isRecording)
  };
}

function normalizeTranscriptText(text, kind) {
  if (kind === "input" && text.startsWith("Input:")) {
    return text.slice("Input:".length).trim();
  }

  if (kind === "output" && text.startsWith("Output:")) {
    return text.slice("Output:".length).trim();
  }

  return text.trim();
}

function mergeTranscriptText(existingText, incomingText) {
  const normalizedExisting = normalizeWhitespace(existingText);
  const normalizedIncoming = normalizeWhitespace(incomingText);

  if (!normalizedExisting) {
    return normalizedIncoming;
  }

  if (!normalizedIncoming || normalizedExisting === normalizedIncoming) {
    return normalizedExisting;
  }

  if (normalizedExisting.endsWith(normalizedIncoming)) {
    return normalizedExisting;
  }

  if (normalizedIncoming.startsWith(normalizedExisting)) {
    return normalizedIncoming;
  }

  const existingWords = normalizedExisting.split(" ");
  const incomingWords = normalizedIncoming.split(" ");
  const maxOverlap = Math.min(existingWords.length, incomingWords.length);

  for (let overlapLength = maxOverlap; overlapLength > 0; overlapLength -= 1) {
    const existingTail = existingWords.slice(-overlapLength).join(" ");
    const incomingHead = incomingWords.slice(0, overlapLength).join(" ");
    if (existingTail === incomingHead) {
      return `${normalizedExisting} ${incomingWords.slice(overlapLength).join(" ")}`.trim();
    }
  }

  return `${normalizedExisting} ${normalizedIncoming}`.trim();
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}
