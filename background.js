import { DEFAULT_TARGET_LANGUAGE_CODE, DEFAULT_TOKEN_ENDPOINT } from "./config.js";

const OFFSCREEN_PATH = "offscreen.html";
const CONTEXT_MENU_ID = "translate-tab-audio";
const state = {
  activeSession: null,
  isStarting: false,
  isStopping: false,
  phase: "idle",
  statusMessage: "Manual start only. Play tab audio first, then press Start in the side panel."
};

chrome.runtime.onInstalled.addListener(async () => {
  console.info("[polyglot-live/background] installed");
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  console.info("[polyglot-live/background] startup");
  void createContextMenu();
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
    startTranslation(message)
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_TRANSLATION") {
    stopTranslation()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "START_REPLAY_RECORDING") {
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_START" })
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_REPLAY_RECORDING") {
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_STOP" })
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "EXPORT_REPLAY_RECORDING") {
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_EXPORT" })
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_REPLAY_RECORDING_STATE") {
    forwardToOffscreen({ type: "OFFSCREEN_RECORD_STATE" })
      .then((payload) => sendResponse(payload))
      .catch((error) => sendResponse({ ok: true, hasReplay: false, isRecording: false }));
    return true;
  }

  if (message.type === "GET_SESSION_STATE") {
    sendResponse({
      ok: true,
      activeSession: state.activeSession,
      isStarting: state.isStarting,
      isStopping: state.isStopping,
      phase: state.phase,
      statusMessage: state.statusMessage
    });
    return false;
  }

  if (message.type === "SESSION_EVENT") {
    if (message.event === "status" && message.payload) {
      state.phase = message.payload.phase || state.phase;
      state.statusMessage = message.payload.message || state.statusMessage;
    }
    if (message.event === "translated_audio_started") {
      void resumePausedTabMedia();
    }
    broadcastToViews(message);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SESSION_DEBUG") {
    console.info("[polyglot-live/offscreen->background]", message.payload?.message, message.payload?.details || "");
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function startTranslation({ targetLanguage, passThroughOriginalAudio = false }) {
  console.info("[polyglot-live/background] start requested", { targetLanguage, passThroughOriginalAudio });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab is available for capture.");
  }

  return startTranslationFromTab(tab.id, {
    passThroughOriginalAudio,
    targetLanguage
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
  if (state.isStarting) {
    throw new Error("A translation session is already starting. Please wait a moment.");
  }
  if (state.isStopping) {
    throw new Error("A translation session is stopping. Please wait a moment.");
  }

  state.isStarting = true;
  console.info("[polyglot-live/background] preparing translation session", { requestedOptions, tabId });
  try {
    const translationPrefs = requestedOptions || (await getTranslationPreferences());
    updateSessionState("starting", `Starting translation for ${translationPrefs.targetLanguage}...`);

    if (state.activeSession) {
      console.info("[polyglot-live/background] restarting existing session", {
        previousTabId: state.activeSession.tabId,
        previousTargetLanguage: state.activeSession.targetLanguage
      });
      await stopTranslation();
    }

    await ensureOffscreenDocument();

    const authConfig = await getAuthConfig();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    console.info("[polyglot-live/background] tab capture stream acquired", {
      tabId,
      targetLanguage: translationPrefs.targetLanguage
    });

    state.activeSession = {
      authConfig,
      awaitingTranslatedAudioStart: false,
      didPauseSourceMedia: false,
      startedAt: Date.now(),
      tabId,
      targetLanguage: translationPrefs.targetLanguage
    };

    const pauseResult = await pauseTabMedia(tabId);
    state.activeSession.didPauseSourceMedia = pauseResult.didPausePlayback;
    state.activeSession.awaitingTranslatedAudioStart = pauseResult.didPausePlayback;
    console.info("[polyglot-live/background] source media pause result", pauseResult);

    const offscreenResponse = await chrome.runtime.sendMessage({
      type: "OFFSCREEN_START",
      payload: {
        passThroughOriginalAudio: translationPrefs.passThroughOriginalAudio,
        streamId,
        tokenEndpoint: authConfig.tokenEndpoint,
        tokenSecret: authConfig.tokenSecret,
        targetLanguage: translationPrefs.targetLanguage
      }
    });

    if (!offscreenResponse?.ok) {
      if (state.activeSession?.didPauseSourceMedia) {
        await resumePausedTabMedia();
      }
      state.activeSession = null;
      console.error("[polyglot-live/background] offscreen start failed", offscreenResponse);
      throw new Error(offscreenResponse?.error || "Offscreen pipeline failed to start.");
    }

    broadcastToViews({
      type: "SESSION_EVENT",
      event: "status",
      payload: {
        message: `Capturing tab audio for ${translationPrefs.targetLanguage}.`,
        phase: "starting"
      }
    });
    updateSessionState("starting", `Capturing tab audio for ${translationPrefs.targetLanguage}.`);

    return { tabId };
  } catch (error) {
    updateSessionState("error", error.message);
    throw error;
  } finally {
    state.isStarting = false;
  }
}

async function stopTranslation() {
  console.info("[polyglot-live/background] stop requested");
  if (state.isStopping) {
    updateSessionState("stopping", "Translation is already stopping...");
    return;
  }

  state.isStopping = true;
  updateSessionState("stopping", "Stopping translation...");

  await ensureOffscreenDocument();
  try {
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" }).catch((error) => {
      console.warn("[polyglot-live/background] offscreen stop failed", error);
      return { ok: false };
    });
  } finally {
    await resumePausedTabMedia();
    state.activeSession = null;
    state.isStopping = false;
  }

  broadcastToViews({
    type: "SESSION_EVENT",
    event: "status",
    payload: {
      message: "Translation stopped.",
      phase: "idle"
    }
  });

  updateSessionState("idle", "Translation stopped.");
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

function updateSessionState(phase, message) {
  state.phase = phase;
  state.statusMessage = message;
  broadcastToViews({
    type: "SESSION_EVENT",
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
    console.warn("[polyglot-live/background] unable to pause source media", error);
    return {
      didPausePlayback: false,
      pausedCount: 0,
      scannedCount: 0
    };
  }
}

async function resumePausedTabMedia() {
  if (!state.activeSession?.tabId || !state.activeSession?.didPauseSourceMedia) {
    return;
  }

  const tabId = state.activeSession.tabId;
  try {
    const results = await chrome.scripting.executeScript({
      target: { allFrames: true, tabId },
      func: resumeMediaElementsForPolyglot
    });
    const resumedCount = results.reduce((sum, frame) => sum + Number(frame.result?.resumedCount || 0), 0);
    console.info("[polyglot-live/background] source media resume result", { resumedCount, tabId });
  } catch (error) {
    console.warn("[polyglot-live/background] unable to resume source media", error);
  } finally {
    if (state.activeSession) {
      state.activeSession.awaitingTranslatedAudioStart = false;
      state.activeSession.didPauseSourceMedia = false;
    }
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
