import {
  DEFAULT_INPUT_SOURCE,
  DEFAULT_ORIGINAL_AUDIO_MIX_PERCENT,
  DEFAULT_SOURCE_MEDIA_RESUME_DELAY_SECONDS,
  DEFAULT_TARGET_LANGUAGE_CODE,
  DEFAULT_TOKEN_ENDPOINT,
  LIVE_TRANSLATE_ESTIMATED_COST_PER_MINUTE_USD,
  RTL_LANGUAGE_CODES,
  SUPPORTED_INPUT_SOURCES,
  SUPPORTED_TRANSLATION_LANGUAGES
} from "./config.js";
const inputSourceInput = document.querySelector("#inputSource");
const targetLanguageInput = document.querySelector("#targetLanguage");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const summaryStartButton = document.querySelector("#summaryStartButton");
const summaryStopButton = document.querySelector("#summaryStopButton");
const sourceResumeDelaySecondsInput = document.querySelector("#sourceResumeDelaySeconds");
const originalAudioMixPercentInput = document.querySelector("#originalAudioMixPercent");
const originalAudioMixPercentValue = document.querySelector("#originalAudioMixPercentValue");
const microphoneAccessControls = document.querySelector("#microphoneAccessControls");
const grantMicrophoneAccessButton = document.querySelector("#grantMicrophoneAccessButton");
const microphoneAccessMessage = document.querySelector("#microphoneAccessMessage");
const startRecordingButton = document.querySelector("#startRecordingButton");
const stopRecordingButton = document.querySelector("#stopRecordingButton");
const replayRecordingButton = document.querySelector("#replayRecordingButton");
const saveReplayButton = document.querySelector("#saveReplayButton");
const replayPreviewAudio = document.querySelector("#replayPreviewAudio");
const recordingMessage = document.querySelector("#recordingMessage");
const recordingIndicator = document.querySelector("#recordingIndicator");
const recordingLabel = document.querySelector(".recording-label");
const statusMessage = document.querySelector("#statusMessage");
const phaseBadge = document.querySelector("#phaseBadge");
const translatedPaneTitle = document.querySelector("#translatedPaneTitle");
const comparisonPaneTitle = document.querySelector("#comparisonPaneTitle");
const liveTabButton = document.querySelector("#liveTabButton");
const comparisonTabButton = document.querySelector("#comparisonTabButton");
const metricsTabButton = document.querySelector("#metricsTabButton");
const liveTabPanel = document.querySelector("#liveTabPanel");
const comparisonTabPanel = document.querySelector("#comparisonTabPanel");
const metricsTabPanel = document.querySelector("#metricsTabPanel");
const originalTranscriptOutput = document.querySelector("#originalTranscriptOutput");
const comparisonOriginalTranscriptOutput = document.querySelector("#comparisonOriginalTranscriptOutput");
const translatedTranscriptOutput = document.querySelector("#translatedTranscriptOutput");
const comparisonTranscriptOutput = document.querySelector("#comparisonTranscriptOutput");
const comparisonStatusRow = document.querySelector("#comparisonStatusRow");
const comparisonStatusMessage = document.querySelector("#comparisonStatusMessage");
const metricsSpinner = document.querySelector("#metricsSpinner");
const metricsStatusMessage = document.querySelector("#metricsStatusMessage");
const exportMetricsButton = document.querySelector("#exportMetricsButton");
const metricsOverallScore = document.querySelector("#metricsOverallScore");
const metricsOverallBand = document.querySelector("#metricsOverallBand");
const metricsOverallMeter = document.querySelector("#metricsOverallMeter");
const metricsOverallNote = document.querySelector("#metricsOverallNote");
const metricsIntentScore = document.querySelector("#metricsIntentScore");
const metricsIntentBand = document.querySelector("#metricsIntentBand");
const metricsIntentMeter = document.querySelector("#metricsIntentMeter");
const metricsIntentNote = document.querySelector("#metricsIntentNote");
const metricsFluencyScore = document.querySelector("#metricsFluencyScore");
const metricsFluencyBand = document.querySelector("#metricsFluencyBand");
const metricsFluencyMeter = document.querySelector("#metricsFluencyMeter");
const metricsFluencyNote = document.querySelector("#metricsFluencyNote");
const metricsFluencyFlag = document.querySelector("#metricsFluencyFlag");
const metricsToneScore = document.querySelector("#metricsToneScore");
const metricsToneBand = document.querySelector("#metricsToneBand");
const metricsToneMeter = document.querySelector("#metricsToneMeter");
const metricsToneNote = document.querySelector("#metricsToneNote");
const metricsNumericScore = document.querySelector("#metricsNumericScore");
const metricsNumericBand = document.querySelector("#metricsNumericBand");
const metricsNumericMeter = document.querySelector("#metricsNumericMeter");
const metricsNumericNote = document.querySelector("#metricsNumericNote");
const metricsEntityScore = document.querySelector("#metricsEntityScore");
const metricsEntityBand = document.querySelector("#metricsEntityBand");
const metricsEntityMeter = document.querySelector("#metricsEntityMeter");
const metricsEntityNote = document.querySelector("#metricsEntityNote");
const metricsOmissionScore = document.querySelector("#metricsOmissionScore");
const metricsOmissionBand = document.querySelector("#metricsOmissionBand");
const metricsOmissionMeter = document.querySelector("#metricsOmissionMeter");
const metricsOmissionNote = document.querySelector("#metricsOmissionNote");
const metricsSummaryOutput = document.querySelector("#metricsSummaryOutput");
const metricsStrengthsList = document.querySelector("#metricsStrengthsList");
const metricsConcernsList = document.querySelector("#metricsConcernsList");
const metricsActionsList = document.querySelector("#metricsActionsList");
const clearTranscriptButton = document.querySelector("#clearTranscriptButton");
const saveTranscriptButton = document.querySelector("#saveTranscriptButton");
const tokenEndpointInput = document.querySelector("#tokenEndpoint");
const tokenSecretInput = document.querySelector("#tokenSecret");
const checkAuthButton = document.querySelector("#checkAuthButton");
const authMessage = document.querySelector("#authMessage");
const themeToggleButton = document.querySelector("#themeToggleButton");
const costBanner = document.querySelector(".cost-banner");
const sessionCostValue = document.querySelector("#sessionCostValue");
const sessionCostMeta = document.querySelector("#sessionCostMeta");
const buildVersion = document.querySelector("#buildVersion");
const micIndicator = document.querySelector("#micIndicator");
const originalPlaceholder = "Original transcript will appear here as speech is detected.";
const comparisonPlaceholder = "Browser-AI comparison will appear here when back-translation is available.";
const metricsIdleMessage = "Use local AI after the session to score the translation against the original and back-translation.";
const metricsWaitingForComparisonMessage = "Start comparison and let it finish before generating local-AI metrics.";
const COMPARISON_REFRESH_DEBOUNCE_MS = 2200;
const COMPARISON_MIN_DELTA_CHARS = 48;
const COMPARISON_READY_TIMEOUT_MS = 15000;
const COMPARISON_TRANSLATE_TIMEOUT_MS = 20000;
const COMPARISON_TRANSLATE_CHUNK_CHARS = 700;
const BROWSER_TRANSLATOR_SUPPORTED_CODES = new Set([
  "ar", "bg", "bn", "cs", "da", "de", "el", "en", "es", "fi", "fr", "hi", "hr", "hu", "id", "it",
  "iw", "ja", "kn", "ko", "lt", "mr", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "ta",
  "te", "th", "tr", "uk", "vi", "zh", "zh-Hant"
]);
let sessionPollId = null;
let sessionCostTimerId = null;
let translatedSegments = [];
let pendingTranslatedAudioMs = 0;
let activeHighlightTimeoutId = null;
let comparisonRefreshTimeoutId = null;
let lastStartedTargetLanguage = null;
let replayHasSavedCapture = false;
let replayIsRecording = false;
let replayIsPlaying = false;
let replayPreviewUrl = null;
let currentTabId = null;
let currentSessionStartedAt = null;
let currentEstimatedCostMs = 0;
let currentSessionInputSource = DEFAULT_INPUT_SOURCE;
let microphonePermissionState = "unknown";
let microphonePermissionWindowId = null;
let comparisonTranslator = null;
let comparisonTranslatorPairKey = null;
let comparisonDetector = null;
let comparisonSourceLanguageCode = null;
let comparisonLastRenderedText = "";
let comparisonGenerationToken = 0;
let comparisonEnabled = false;
let comparisonIsWorking = false;
let comparisonWorkingSince = 0;
let comparisonHideTimeoutId = null;
let metricsLanguageModel = null;
let metricsLanguageModelReady = null;
let metricsHasResults = false;
let metricsIsWorking = false;
let activeWorkflowTab = "live";
const ENABLE_WORD_HIGHLIGHTING = false;
const DEFAULT_THEME = "light";

initialize().catch((error) => {
  updateStatus("error", error.message);
});

checkAuthButton.addEventListener("click", async () => {
  await runReadinessCheck();
});

themeToggleButton.addEventListener("click", async () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  await chrome.storage.local.set({ panelTheme: nextTheme });
});

grantMicrophoneAccessButton.addEventListener("click", async () => {
  await requestMicrophoneAccess();
});

saveTranscriptButton.addEventListener("click", () => {
  exportTranscripts();
});

liveTabButton.addEventListener("click", () => {
  setActiveWorkflowTab("live");
});

comparisonTabButton.addEventListener("click", () => {
  setActiveWorkflowTab("comparison");
  void ensureComparisonModeActive();
});

metricsTabButton.addEventListener("click", () => {
  setActiveWorkflowTab("metrics");
  void ensureMetricsModeActive();
});

exportMetricsButton.addEventListener("click", () => {
  exportMetricsReport();
});

clearTranscriptButton.addEventListener("click", async () => {
  if (currentTabId) {
    await chrome.runtime.sendMessage({ type: "CLEAR_TRANSCRIPTS", tabId: currentTabId });
  }

  resetTranscriptOutputs();

  if (phaseBadge.textContent === "running") {
    updateStatus("running", `Transcript panes cleared. Receiving translated audio for ${getSelectedTargetLanguageCode()}.`);
    return;
  }

  if (phaseBadge.textContent === "idle") {
    updateStatus("idle", "Transcript panes cleared.");
    return;
  }

  statusMessage.textContent = "Transcript panes cleared.";
});

startRecordingButton.addEventListener("click", async () => {
  stopReplayPreview();
  if (!currentTabId) {
    updateRecordingMessage("Choose a source tab before starting replay recording.");
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: "START_REPLAY_RECORDING", tabId: currentTabId });
  if (!response?.ok) {
    updateRecordingMessage(response?.error ?? "Unable to start replay recording.");
    await syncReplayRecordingState();
    return;
  }

  replayIsRecording = true;
  replayHasSavedCapture = false;
  replayIsPlaying = false;
  updateRecordingMessage("Recording translated audio for replay capture...");
  syncRecordingButtonsForState();
});

stopRecordingButton.addEventListener("click", async () => {
  if (!currentTabId) {
    updateRecordingMessage("Choose a source tab before stopping replay recording.");
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: "STOP_REPLAY_RECORDING", tabId: currentTabId });
  if (!response?.ok) {
    updateRecordingMessage(response?.error ?? "Unable to stop replay recording.");
    await syncReplayRecordingState();
    return;
  }

  replayIsRecording = false;
  replayHasSavedCapture = Boolean(response?.hasReplay);
  replayIsPlaying = false;
  updateRecordingMessage(
    replayHasSavedCapture
      ? "Replay captured. Use Replay to listen or Save replay to download MP3."
      : "Recording stopped, but no replay audio was captured."
  );
  syncRecordingButtonsForState();
});

replayRecordingButton.addEventListener("click", async () => {
  if (replayIsPlaying) {
    stopReplayPreview();
    updateRecordingMessage("Replay preview stopped.");
    return;
  }

  if (!currentTabId) {
    updateRecordingMessage("Choose a source tab before replaying captured audio.");
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: "PREVIEW_REPLAY_RECORDING", tabId: currentTabId });
  if (!response?.ok) {
    updateRecordingMessage(response?.error ?? "Unable to replay the saved audio.");
    await syncReplayRecordingState();
    return;
  }

  const bytes = new Uint8Array(response.bytes || []);
  const blob = new Blob([bytes], { type: response.mimeType || "audio/webm" });
  replaceReplayPreviewSource(URL.createObjectURL(blob));
  replayPreviewAudio.currentTime = 0;
  try {
    await replayPreviewAudio.play();
    replayIsPlaying = true;
    updateRecordingMessage("Replay preview is playing.");
    syncRecordingButtonsForState();
  } catch (error) {
    stopReplayPreview();
    updateRecordingMessage(`Replay preview failed: ${error?.message || "Unable to play audio."}`);
  }
});

saveReplayButton.addEventListener("click", async () => {
  if (!currentTabId) {
    updateRecordingMessage("Choose a source tab before saving replay audio.");
    return;
  }

  updateRecordingMessage("Converting replay to MP3... please wait...");
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_REPLAY_RECORDING", tabId: currentTabId });
  if (!response?.ok) {
    updateRecordingMessage(response?.error ?? "Unable to save replay.");
    await syncReplayRecordingState();
    return;
  }

  const bytes = new Uint8Array(response.bytes || []);
  const blob = new Blob([bytes], { type: response.mimeType || "audio/webm" });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download =
    response.fileName || `polyglot-live_replay_${buildFileTimestamp(new Date())}.${response.extension || "webm"}`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
  updateRecordingMessage("Replay saved as MP3.");
});

startButton?.addEventListener("click", async () => {
  await startTranslation();
});

summaryStartButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  await startTranslation();
});

stopButton?.addEventListener("click", async () => {
  await stopTranslation();
});

summaryStopButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  await stopTranslation();
});

async function startTranslation() {
  if (!currentTabId) {
    updateStatus("error", "No active browser tab is available for translation.");
    return;
  }

  if (getSelectedInputSource() === "microphone" && microphonePermissionState !== "granted") {
    updateStatus("error", "Grant microphone access in the side panel before starting microphone translation.");
    return;
  }

  const selectedTargetLanguage = getSelectedTargetLanguageCode();
  const shouldResetForFreshStart =
    phaseBadge.textContent === "idle" ||
    lastStartedTargetLanguage === null ||
    lastStartedTargetLanguage !== selectedTargetLanguage;

  if (shouldResetForFreshStart) {
    resetTranscriptOutputs();
  }

  setBusy(true);
  updateStatus("starting", "Starting translation session...");
  await persistAuthConfig();
  await persistTranslationPrefs();

  const isReady = await runReadinessCheck({ suppressSuccessStatus: true });
  if (!isReady) {
    setBusy(false);
    updateStatus("error", "Auth readiness check failed. Fix the auth panel details before starting.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "START_TRANSLATION",
    inputSource: getSelectedInputSource(),
    originalAudioMixPercent: normalizeOriginalAudioMixPercent(originalAudioMixPercentInput.value),
    tabId: currentTabId,
    targetLanguage: selectedTargetLanguage
  });

  setBusy(false);

  if (!response?.ok) {
    if ((response?.error || "").includes("Permission dismissed")) {
      updateStatus("error", "Microphone permission was dismissed. Click Grant microphone access and allow the mic.");
      microphonePermissionState = "denied";
      updateMicrophoneAccessUi();
      return;
    }

    if ((response?.error || "").includes("already starting")) {
      updateStatus("starting", "A translation session is already starting. Please wait a moment.");
      await syncSessionState();
      return;
    }

    updateStatus("error", response?.error ?? "Unable to start translation.");
    return;
  }

  lastStartedTargetLanguage = selectedTargetLanguage;
  currentSessionInputSource = getSelectedInputSource();
  currentSessionStartedAt = typeof response.startedAt === "number" && Number.isFinite(response.startedAt)
    ? response.startedAt
    : Date.now();
  updateStatus("running", `Session started on tab ${response.tabId}.`);
}

async function stopTranslation() {
  if (!currentTabId) {
    updateStatus("error", "No active browser tab is available for translation.");
    return;
  }

  setBusy(true);
  const response = await chrome.runtime.sendMessage({ type: "STOP_TRANSLATION", tabId: currentTabId });
  setBusy(false);

  if (!response?.ok) {
    updateStatus("error", response?.error ?? "Unable to stop translation.");
    return;
  }

  lastStartedTargetLanguage = null;
  updateStatus("idle", "Translation stopped. Session transcript preserved for review.");
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "MIC_PERMISSION_STATE") {
    microphonePermissionState =
      message.state === "granted" ? "granted" : message.state === "denied" ? "denied" : "unknown";
    if (message.windowClosed && microphonePermissionWindowId === message.windowId) {
      microphonePermissionWindowId = null;
    }
    updateMicrophoneAccessUi();
    if (message.state === "granted") {
      updateStatus("ready", "Microphone access granted. Safe to start microphone translation.");
    } else if (message.state === "denied") {
      updateStatus("error", `Microphone access was not granted: ${message.reason || "Permission dismissed"}`);
    }
    return;
  }

  if (message?.type !== "SESSION_EVENT" || message.tabId !== currentTabId) {
    return;
  }

  if (message.event === "status") {
    if (typeof message.payload?.estimatedCostMs === "number" && Number.isFinite(message.payload.estimatedCostMs)) {
      currentEstimatedCostMs = message.payload.estimatedCostMs;
    }
    updateStatus(message.payload.phase, message.payload.message);
  }

  if (message.event === "transcript") {
    appendTranscript(message.payload);
  }

  if (message.event === "audio_timing") {
    applyTranslatedAudioTiming(message.payload);
  }

  if (message.event === "transcripts_cleared") {
    resetTranscriptOutputs();
  }
});

function setBusy(isBusy) {
  if (startButton) {
    startButton.disabled = isBusy;
  }
  summaryStartButton.disabled = isBusy;
  if (stopButton) {
    stopButton.disabled = !isBusy;
  }
  summaryStopButton.disabled = !isBusy;
}

function updateStatus(phase, message) {
  phaseBadge.textContent = phase;
  statusMessage.textContent = message;
  if (phase === "idle") {
    lastStartedTargetLanguage = null;
  }
  updateMicIndicator();
  syncButtonsForPhase(phase);
  syncPollingForPhase(phase);
  syncCostTimerForPhase(phase);
  renderSessionCost();
}

async function initialize() {
  const { authConfig = {}, panelTheme = DEFAULT_THEME, translationPrefs = {} } = await chrome.storage.local.get([
    "authConfig",
    "panelTheme",
    "translationPrefs"
  ]);
  buildVersion.textContent = `v${chrome.runtime.getManifest().version}`;
  tokenEndpointInput.value = authConfig.tokenEndpoint || DEFAULT_TOKEN_ENDPOINT;
  tokenSecretInput.value = authConfig.tokenSecret || "";
  applyTheme(panelTheme);
  await refreshMicrophonePermissionState();
  renderInputSourceOptions();
  renderTargetLanguageOptions();
  inputSourceInput.value = normalizeInputSource(translationPrefs.inputSource);
  targetLanguageInput.value = normalizeTargetLanguageCode(translationPrefs.targetLanguage);
  sourceResumeDelaySecondsInput.value = String(
    normalizeSourceMediaResumeDelaySeconds(translationPrefs.sourceMediaResumeDelaySeconds)
  );
  originalAudioMixPercentInput.value = String(normalizeOriginalAudioMixPercent(translationPrefs.originalAudioMixPercent));
  updateOriginalAudioMixPercentValue();
  updateInputSourcePresentation(inputSourceInput.value);
  updateTargetLanguagePresentation(targetLanguageInput.value);

  tokenEndpointInput.addEventListener("change", () => {
    void persistAuthConfig();
  });

  tokenSecretInput.addEventListener("change", () => {
    void persistAuthConfig();
  });

  inputSourceInput.addEventListener("change", () => {
    updateInputSourcePresentation(getSelectedInputSource());
    void persistTranslationPrefs();
  });

  targetLanguageInput.addEventListener("change", () => {
    updateTargetLanguagePresentation(getSelectedTargetLanguageCode());
    resetTranscriptOutputs();
    void persistTranslationPrefs();
  });

  sourceResumeDelaySecondsInput.addEventListener("change", () => {
    sourceResumeDelaySecondsInput.value = String(
      normalizeSourceMediaResumeDelaySeconds(sourceResumeDelaySecondsInput.value)
    );
    void persistTranslationPrefs();
  });

  originalAudioMixPercentInput.addEventListener("input", () => {
    originalAudioMixPercentInput.value = String(normalizeOriginalAudioMixPercent(originalAudioMixPercentInput.value));
    updateOriginalAudioMixPercentValue();
    void maybeUpdateOriginalAudioMixInSession();
  });

  originalAudioMixPercentInput.addEventListener("change", () => {
    originalAudioMixPercentInput.value = String(normalizeOriginalAudioMixPercent(originalAudioMixPercentInput.value));
    updateOriginalAudioMixPercentValue();
    void persistTranslationPrefs();
    void maybeUpdateOriginalAudioMixInSession();
  });

  updateAuthMessage("Not checked yet.");
  updateRecordingMessage("Replay recording captures translated audio live and exports MP3 for later playback.");
  renderSessionCost();
  resetTranscriptOutputs();
  updateMetricsStatus(metricsIdleMessage);
  chrome.tabs.onActivated.addListener(() => {
    void refreshActiveTabContext();
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === "complete") {
      void refreshActiveTabContext();
    }
  });

  await refreshActiveTabContext();
}

async function persistAuthConfig() {
  await chrome.storage.local.set({
    authConfig: {
      tokenEndpoint: tokenEndpointInput.value.trim() || DEFAULT_TOKEN_ENDPOINT,
      tokenSecret: tokenSecretInput.value
    }
  });
}

async function persistTranslationPrefs() {
  const targetLanguage = getSelectedTargetLanguageCode();
  await chrome.storage.local.set({
    translationPrefs: {
      inputSource: getSelectedInputSource(),
      originalAudioMixPercent: normalizeOriginalAudioMixPercent(originalAudioMixPercentInput.value),
      sourceMediaResumeDelaySeconds: normalizeSourceMediaResumeDelaySeconds(sourceResumeDelaySecondsInput.value),
      targetLanguage
    }
  });
}

async function runReadinessCheck({ suppressSuccessStatus = false } = {}) {
  checkAuthButton.disabled = true;
  updateAuthMessage("Checking local token server and Gemini token provisioning...");

  try {
    await persistAuthConfig();
    const response = await fetch(buildProbeUrl(tokenEndpointInput.value.trim() || DEFAULT_TOKEN_ENDPOINT), {
      method: "POST",
      headers: buildProbeHeaders(),
      body: JSON.stringify({
        model: "gemini-3.5-live-translate-preview",
        tabId: currentTabId,
        targetLanguage: getSelectedTargetLanguageCode()
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error || `HTTP ${response.status}`;
      updateAuthMessage(`Not ready: ${detail}`);
      return false;
    }

    updateAuthMessage("Ready: local token server reachable and Gemini token accepted.");

    if (!suppressSuccessStatus) {
      updateStatus("ready", "Auth check passed. Safe to press Start.");
    }

    return true;
  } catch (error) {
    updateAuthMessage(`Not ready: ${error.message}`);
    return false;
  } finally {
    checkAuthButton.disabled = false;
  }
}

function buildProbeHeaders() {
  const headers = {
    "content-type": "application/json"
  };

  if (tokenSecretInput.value) {
    headers["x-polyglot-live-secret"] = tokenSecretInput.value;
  }

  return headers;
}

function buildProbeUrl(tokenEndpoint) {
  return tokenEndpoint;
}

function applyTheme(theme) {
  const resolvedTheme = theme === "dark" ? "dark" : DEFAULT_THEME;
  document.body.dataset.theme = resolvedTheme;
  themeToggleButton.textContent = resolvedTheme === "dark" ? "Light theme" : "Dark theme";
}

function updateAuthMessage(message) {
  authMessage.textContent = message;
}

function updateRecordingMessage(message) {
  recordingMessage.textContent = message;
}

function updateRecordingIndicator() {
  const isRecording = replayIsRecording;
  recordingIndicator.classList.toggle("is-recording", isRecording);
  recordingLabel.textContent = isRecording ? "recording" : replayHasSavedCapture ? "saved" : "idle";
}

function replaceReplayPreviewSource(nextUrl) {
  if (replayPreviewUrl) {
    URL.revokeObjectURL(replayPreviewUrl);
  }
  replayPreviewUrl = nextUrl;
  replayPreviewAudio.src = nextUrl;
}

function stopReplayPreview() {
  replayPreviewAudio.pause();
  replayPreviewAudio.currentTime = 0;
  replayIsPlaying = false;
  if (replayPreviewUrl) {
    URL.revokeObjectURL(replayPreviewUrl);
    replayPreviewUrl = null;
  }
  replayPreviewAudio.removeAttribute("src");
  replayPreviewAudio.load();
  syncRecordingButtonsForState();
}

function setActiveWorkflowTab(nextTab) {
  activeWorkflowTab = nextTab === "comparison" || nextTab === "metrics" ? nextTab : "live";
  const tabMap = [
    { button: liveTabButton, panel: liveTabPanel, key: "live" },
    { button: comparisonTabButton, panel: comparisonTabPanel, key: "comparison" },
    { button: metricsTabButton, panel: metricsTabPanel, key: "metrics" }
  ];

  tabMap.forEach(({ button, panel, key }) => {
    const isActive = key === activeWorkflowTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function updateMetricsStatus(message) {
  metricsStatusMessage.textContent = message;
}

function updateComparisonStatus(message) {
  comparisonStatusMessage.textContent = message || "Processing comparison... please wait...";
}

function setComparisonWorking(isWorking, reason = "unspecified", message = null) {
  comparisonIsWorking = Boolean(isWorking);

  if (comparisonHideTimeoutId) {
    clearTimeout(comparisonHideTimeoutId);
    comparisonHideTimeoutId = null;
  }

  if (comparisonIsWorking) {
    comparisonWorkingSince = Date.now();
    comparisonStatusRow.hidden = false;
    comparisonStatusRow.style.display = "flex";
    updateComparisonStatus(message);
  } else {
    const elapsedMs = comparisonWorkingSince ? Date.now() - comparisonWorkingSince : 0;
    const minimumVisibleMs = 700;
    const hideRow = () => {
      comparisonStatusRow.hidden = true;
      comparisonStatusRow.style.display = "none";
      comparisonHideTimeoutId = null;
    };

    if (elapsedMs >= minimumVisibleMs) {
      hideRow();
    } else {
      comparisonHideTimeoutId = setTimeout(hideRow, minimumVisibleMs - elapsedMs);
    }
  }

  emitPanelDebug("Comparison working state changed", {
    comparisonIsWorking,
    reason,
    comparisonStatusRowDisplay: comparisonStatusRow.style.display,
    comparisonStatusRowHidden: comparisonStatusRow.hidden,
    comparisonTextLength: comparisonTranscriptOutput.textContent?.length || 0
  });
}

function setMetricsWorking(isWorking) {
  metricsIsWorking = Boolean(isWorking);
  metricsSpinner.hidden = !metricsIsWorking;
}

function resetMetricsOutput() {
  metricsHasResults = false;
  setMetricsWorking(false);
  updateMetricMeter(metricsOverallMeter, 0, "is-na");
  updateMetricMeter(metricsIntentMeter, 0, "is-na");
  updateMetricMeter(metricsFluencyMeter, 0, "is-na");
  updateMetricMeter(metricsToneMeter, 0, "is-na");
  updateMetricMeter(metricsNumericMeter, 0, "is-na");
  updateMetricMeter(metricsEntityMeter, 0, "is-na");
  updateMetricMeter(metricsOmissionMeter, 0, "is-na");
  metricsOverallScore.textContent = "--";
  updateMetricsBand(metricsOverallBand, "Not scored", null);
  metricsOverallNote.textContent = "Local AI score will appear here.";
  metricsIntentScore.textContent = "--";
  updateMetricsBand(metricsIntentBand, "Not scored", null);
  metricsIntentNote.textContent = "Checks whether the meaning stayed intact.";
  metricsFluencyScore.textContent = "--";
  updateMetricsBand(metricsFluencyBand, "Not scored", null);
  metricsFluencyNote.textContent = "Audits grammar and naturalness in the translated text itself.";
  metricsFluencyFlag.textContent = "Fluency flag: not scored";
  metricsToneScore.textContent = "--";
  updateMetricsBand(metricsToneBand, "Not scored", null);
  metricsToneNote.textContent = "Looks at style, emphasis, and delivery.";
  metricsNumericScore.textContent = "--";
  updateMetricsBand(metricsNumericBand, "Not scored", null);
  metricsNumericNote.textContent = "Tracks numbers, scores, percentages, and counts.";
  metricsEntityScore.textContent = "--";
  updateMetricsBand(metricsEntityBand, "Not scored", null);
  metricsEntityNote.textContent = "Checks people, places, teams, brands, and titles.";
  metricsOmissionScore.textContent = "--";
  updateMetricsBand(metricsOmissionBand, "Not scored", null);
  metricsOmissionNote.textContent = "Flags missing or invented content.";
  metricsSummaryOutput.textContent =
    "Metrics will appear here after comparison is ready and you open this tab.";
  renderMetricsList(metricsStrengthsList, ["Nothing scored yet."]);
  renderMetricsList(metricsConcernsList, ["Nothing scored yet."]);
  renderMetricsList(metricsActionsList, ["Nothing scored yet."]);
}

function invalidateMetrics(reason = "Transcript changed. Reopen Metrics after the session is ready.") {
  if (!metricsHasResults) {
    return;
  }

  updateMetricsStatus(reason);
}

function renderMetricsList(listElement, items) {
  listElement.innerHTML = "";
  const nextItems = Array.isArray(items) && items.length > 0 ? items : ["Nothing scored yet."];
  nextItems.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    listElement.appendChild(listItem);
  });
}

function isNotApplicableMetric(note) {
  return /no specific|no relevant|not present|none present|nothing to score|not enough .* to score|no .* to score/i.test(
    note || ""
  );
}

function getMetricsBand(score, note) {
  if (!Number.isFinite(score) || isNotApplicableMetric(note)) {
    return { className: "is-na", label: "N/A" };
  }

  if (score >= 90) {
    return { className: "is-excellent", label: "Excellent" };
  }

  if (score >= 80) {
    return { className: "is-strong", label: "Strong" };
  }

  if (score >= 65) {
    return { className: "is-good", label: "Good" };
  }

  if (score >= 45) {
    return { className: "is-mixed", label: "Mixed" };
  }

  return { className: "is-low", label: "Low" };
}

function updateMetricsBand(bandElement, label, className) {
  bandElement.textContent = label;
  bandElement.className = "metrics-band";
  if (className) {
    bandElement.classList.add(className);
  }
}

function updateMetricMeter(meterElement, score, className, options = {}) {
  if (!meterElement) {
    return;
  }

  const invertScale = Boolean(options.invertScale);
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const renderedPercent = invertScale ? 100 - safeScore : safeScore;
  meterElement.style.width = `${renderedPercent}%`;
  meterElement.className = "metrics-meter-fill";
  if (className) {
    meterElement.classList.add(className);
  }
}

function renderMetricScore(scoreElement, bandElement, meterElement, noteElement, score, note, fallbackNote) {
  const resolvedNote = note || fallbackNote;
  const omissionMode = bandElement === metricsOmissionBand;
  const band = omissionMode ? getOmissionMetricsBand(score, resolvedNote) : getMetricsBand(score, resolvedNote);
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
  const displayedScore = omissionMode && safeScore !== null ? 100 - safeScore : safeScore;
  if (band.label === "N/A") {
    scoreElement.textContent = "N/A";
  } else {
    scoreElement.textContent = displayedScore !== null ? `${displayedScore}/100` : "--";
  }
  updateMetricsBand(bandElement, band.label, band.className);
  updateMetricMeter(meterElement, score, band.className, { invertScale: omissionMode && band.label !== "N/A" });
  noteElement.textContent = resolvedNote;
}

function getOmissionMetricsBand(score, note) {
  if (!Number.isFinite(score) || isNotApplicableMetric(note)) {
    return { className: "is-na", label: "N/A" };
  }

  if (score <= 10) {
    return { className: "is-excellent", label: "Low risk" };
  }

  if (score <= 25) {
    return { className: "is-strong", label: "Minor risk" };
  }

  if (score <= 45) {
    return { className: "is-good", label: "Moderate risk" };
  }

  if (score <= 65) {
    return { className: "is-mixed", label: "Elevated risk" };
  }

  return { className: "is-low", label: "High risk" };
}

function renderMetricsReport(report) {
  metricsHasResults = true;
  renderMetricScore(
    metricsOverallScore,
    metricsOverallBand,
    metricsOverallMeter,
    metricsOverallNote,
    report.overallScore,
    report.overallNote,
    "Overall quality estimate from original vs back-translation."
  );
  renderMetricScore(
    metricsIntentScore,
    metricsIntentBand,
    metricsIntentMeter,
    metricsIntentNote,
    report.intentScore,
    report.intentNote,
    "How well the intended meaning survived translation."
  );
  renderMetricScore(
    metricsFluencyScore,
    metricsFluencyBand,
    metricsFluencyMeter,
    metricsFluencyNote,
    report.fluencyScore,
    report.fluencyNote,
    "How natural and grammatically correct the translated text sounds in the target language."
  );
  metricsFluencyFlag.textContent = `Fluency flag: ${report.fluencyFlag || "Requires human review"}`;
  renderMetricScore(
    metricsToneScore,
    metricsToneBand,
    metricsToneMeter,
    metricsToneNote,
    report.toneScore,
    report.toneNote,
    "How closely the style and emphasis matched."
  );
  renderMetricScore(
    metricsNumericScore,
    metricsNumericBand,
    metricsNumericMeter,
    metricsNumericNote,
    report.numericScore,
    report.numericNote,
    "How accurately numbers and factual quantities were retained."
  );
  renderMetricScore(
    metricsEntityScore,
    metricsEntityBand,
    metricsEntityMeter,
    metricsEntityNote,
    report.entityScore,
    report.entityNote,
    "How accurately names and entities were retained."
  );
  renderMetricScore(
    metricsOmissionScore,
    metricsOmissionBand,
    metricsOmissionMeter,
    metricsOmissionNote,
    report.omissionScore,
    report.omissionNote,
    "Whether content was dropped or invented."
  );
  metricsSummaryOutput.textContent = report.summary || "No summary returned by local AI.";
  renderMetricsList(metricsStrengthsList, report.strengths);
  renderMetricsList(metricsConcernsList, report.concerns);
  renderMetricsList(metricsActionsList, report.recommendedChecks);
}

function exportTranscripts() {
  const targetLanguageLabel = getSelectedTargetLanguageLabel();
  const originalText = normalizeExportText(
    isPlaceholderText(originalTranscriptOutput.textContent) ? "" : originalTranscriptOutput.textContent
  );
  const translatedText = normalizeExportText(
    translatedTranscriptOutput.classList.contains("translated-transcript-empty")
      ? ""
      : translatedTranscriptOutput.textContent
  );
  const comparisonText = normalizeExportText(
    comparisonTranscriptOutput.classList.contains("translated-transcript-empty")
      ? ""
      : comparisonTranscriptOutput.textContent
  );
  const exportedAt = new Date();
  const content = [
    "polyglot-live transcript export",
    `Exported: ${exportedAt.toLocaleString()}`,
    `Target language: ${targetLanguageLabel}`,
    `Status: ${phaseBadge.textContent || "idle"}`,
    "",
    "Original",
    originalText || "(empty)",
    "",
    targetLanguageLabel,
    translatedText || "(empty)",
    "",
    "Comparison",
    comparisonText || "(empty)",
    ""
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download = `polyglot-live_transcripts_${buildFileTimestamp(exportedAt)}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function exportMetricsReport() {
  const exportedAt = new Date();
  const targetLanguageLabel = getSelectedTargetLanguageLabel();
  const reportSections = [
    "polyglot-live metrics export",
    `Exported: ${exportedAt.toLocaleString()}`,
    `Target language: ${targetLanguageLabel}`,
    `Status: ${phaseBadge.textContent || "idle"}`,
    "",
    "Overall fidelity",
    `${metricsOverallScore.textContent} (${metricsOverallBand.textContent})`,
    metricsOverallNote.textContent,
    "",
    "Intent match",
    `${metricsIntentScore.textContent} (${metricsIntentBand.textContent})`,
    metricsIntentNote.textContent,
    "",
    "Target fluency",
    `${metricsFluencyScore.textContent} (${metricsFluencyBand.textContent})`,
    metricsFluencyNote.textContent,
    metricsFluencyFlag.textContent,
    "",
    "Tone match",
    `${metricsToneScore.textContent} (${metricsToneBand.textContent})`,
    metricsToneNote.textContent,
    "",
    "Numeric accuracy",
    `${metricsNumericScore.textContent} (${metricsNumericBand.textContent})`,
    metricsNumericNote.textContent,
    "",
    "Named entities",
    `${metricsEntityScore.textContent} (${metricsEntityBand.textContent})`,
    metricsEntityNote.textContent,
    "",
    "Omissions / additions",
    `${metricsOmissionScore.textContent} (${metricsOmissionBand.textContent})`,
    metricsOmissionNote.textContent,
    "",
    "Summary",
    metricsSummaryOutput.textContent || "(empty)",
    "",
    "Strengths",
    ...collectMetricsListItems(metricsStrengthsList),
    "",
    "Concerns",
    ...collectMetricsListItems(metricsConcernsList),
    "",
    "Recommended checks",
    ...collectMetricsListItems(metricsActionsList),
    ""
  ];

  const blob = new Blob([reportSections.join("\n")], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download = `polyglot-live_metrics_${buildFileTimestamp(exportedAt)}.txt`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function collectMetricsListItems(listElement) {
  const items = Array.from(listElement.querySelectorAll("li"))
    .map((item) => normalizeWhitespace(item.textContent))
    .filter(Boolean);

  if (items.length === 0) {
    return ["(empty)"];
  }

  return items.map((item) => `- ${item}`);
}

function resetTranscriptOutputs() {
  comparisonEnabled = false;
  setComparisonWorking(false, "reset transcript outputs");
  resetComparisonTranslatorState();
  originalTranscriptOutput.textContent = originalPlaceholder;
  comparisonOriginalTranscriptOutput.textContent = originalPlaceholder;
  translatedTranscriptOutput.textContent = `${getSelectedTargetLanguageLabel()} translation will appear here as Gemini returns audio/text events.`;
  translatedTranscriptOutput.className = "translated-transcript-empty";
  applyTranslatedTranscriptDirection(getSelectedTargetLanguageCode());
  resetComparisonOutput("Comparison will begin when translated text is available.");
  translatedSegments = [];
  pendingTranslatedAudioMs = 0;
  if (activeHighlightTimeoutId) {
    clearTimeout(activeHighlightTimeoutId);
    activeHighlightTimeoutId = null;
  }
  if (comparisonRefreshTimeoutId) {
    clearTimeout(comparisonRefreshTimeoutId);
    comparisonRefreshTimeoutId = null;
  }
  comparisonLastRenderedText = "";
  comparisonGenerationToken += 1;
  resetMetricsOutput();
  updateMetricsStatus(metricsIdleMessage);
}

function renderSessionCost() {
  const isActiveSession = Boolean(currentSessionStartedAt) && isCostTrackingPhase(phaseBadge.textContent || "idle");
  costBanner.classList.toggle("is-active", isActiveSession);
  const estimatedUsd = (Math.max(0, currentEstimatedCostMs) / 60000) * LIVE_TRANSLATE_ESTIMATED_COST_PER_MINUTE_USD;
  sessionCostValue.textContent = formatUsd(estimatedUsd);
  sessionCostMeta.textContent = `(Free during "2.5 Live" model preview)`;
}

function appendTranscript(payload) {
  const kind = payload?.kind || inferTranscriptKind(payload?.text || "");
  if (kind !== "input" && kind !== "output") {
    return;
  }

  const text = normalizeTranscriptText(payload?.text || "", kind);
  if (!text) {
    return;
  }

  if (kind === "input") {
    appendOriginalTranscript(text);
    return;
  }

  appendTranslatedTranscript(text);
}

function appendOriginalTranscript(text) {
  const normalizedText = text.trim();
  const existingText = isPlaceholderText(originalTranscriptOutput.textContent)
    ? ""
    : originalTranscriptOutput.textContent.trim();
  const mergedText = mergeTranscriptText(existingText, normalizedText);

  if (!mergedText || mergedText === existingText) {
    return;
  }

  if (isPlaceholderText(originalTranscriptOutput.textContent)) {
    originalTranscriptOutput.textContent = mergedText;
  } else {
    originalTranscriptOutput.textContent = mergedText;
  }

  if (isPlaceholderText(comparisonOriginalTranscriptOutput.textContent)) {
    comparisonOriginalTranscriptOutput.textContent = mergedText;
  } else {
    comparisonOriginalTranscriptOutput.textContent = mergedText;
  }

  originalTranscriptOutput.scrollTop = originalTranscriptOutput.scrollHeight;
  comparisonOriginalTranscriptOutput.scrollTop = comparisonOriginalTranscriptOutput.scrollHeight;
  invalidateMetrics();
  queueComparisonRefresh();
}

function appendTranslatedTranscript(text) {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return;
  }

  if (!ENABLE_WORD_HIGHLIGHTING) {
    appendTranslatedTranscriptPlain(normalizedText);
    return;
  }

  const lastSegment = translatedSegments[translatedSegments.length - 1];
  if (lastSegment?.text === normalizedText) {
    return;
  }

  if (translatedTranscriptOutput.classList.contains("translated-transcript-empty")) {
    translatedTranscriptOutput.textContent = "";
    translatedTranscriptOutput.className = "";
  }

  const segmentElement = document.createElement("div");
  segmentElement.className = "translated-segment";
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordElements = words.map((word) => {
    const wordElement = document.createElement("span");
    wordElement.className = "translated-word";
    wordElement.textContent = word;
    segmentElement.appendChild(wordElement);
    return wordElement;
  });

  translatedTranscriptOutput.appendChild(segmentElement);
  translatedTranscriptOutput.appendChild(document.createTextNode(" "));
  translatedTranscriptOutput.scrollTop = translatedTranscriptOutput.scrollHeight;

  translatedSegments.push({
    text: normalizedText,
    words,
    wordElements,
    spokenWordCount: 0,
    audioMsAssigned: 0
  });

  if (pendingTranslatedAudioMs > 0) {
    assignAudioMsToSegments(pendingTranslatedAudioMs);
    pendingTranslatedAudioMs = 0;
  }

  scheduleTranslatedHighlightProgress();
}

function appendTranslatedTranscriptPlain(text) {
  const existingText = translatedTranscriptOutput.classList.contains("translated-transcript-empty")
    ? ""
    : translatedTranscriptOutput.textContent.trim();
  const mergedText = mergeTranscriptText(existingText, text);

  if (!mergedText || mergedText === existingText) {
    return;
  }

  if (translatedTranscriptOutput.classList.contains("translated-transcript-empty")) {
    translatedTranscriptOutput.textContent = mergedText;
    translatedTranscriptOutput.className = "";
  } else {
    translatedTranscriptOutput.textContent = mergedText;
  }

  translatedTranscriptOutput.scrollTop = translatedTranscriptOutput.scrollHeight;
  invalidateMetrics();
  queueComparisonRefresh();
}

function applyTranslatedAudioTiming(payload) {
  if (!ENABLE_WORD_HIGHLIGHTING) {
    return;
  }

  const durationMs = Math.max(0, Number(payload?.durationMs || 0));
  if (!durationMs) {
    return;
  }

  if (translatedSegments.length === 0) {
    pendingTranslatedAudioMs += durationMs;
    return;
  }

  assignAudioMsToSegments(durationMs);
  scheduleTranslatedHighlightProgress();
}

function assignAudioMsToSegments(durationMs) {
  let remainingMs = durationMs;

  for (const segment of translatedSegments) {
    if (remainingMs <= 0) {
      break;
    }

    if (segment.spokenWordCount >= segment.words.length) {
      continue;
    }

    segment.audioMsAssigned += remainingMs;
    remainingMs = 0;
  }
}

function scheduleTranslatedHighlightProgress() {
  if (!ENABLE_WORD_HIGHLIGHTING) {
    return;
  }

  if (activeHighlightTimeoutId) {
    return;
  }

  const nextStep = getNextHighlightStep();
  if (!nextStep) {
    return;
  }

  renderTranslatedHighlightState(nextStep.segmentIndex, nextStep.wordIndex);
  const segment = translatedSegments[nextStep.segmentIndex];
  segment.spokenWordCount += 1;
  segment.audioMsAssigned = Math.max(0, segment.audioMsAssigned - nextStep.stepMs);
  activeHighlightTimeoutId = setTimeout(() => {
    activeHighlightTimeoutId = null;
    scheduleTranslatedHighlightProgress();
  }, nextStep.stepMs);
}

function getNextHighlightStep() {
  for (let segmentIndex = 0; segmentIndex < translatedSegments.length; segmentIndex += 1) {
    const segment = translatedSegments[segmentIndex];
    const remainingWords = segment.words.length - segment.spokenWordCount;
    if (remainingWords <= 0 || segment.audioMsAssigned <= 0) {
      continue;
    }

    const stepMs = Math.max(40, Math.round(segment.audioMsAssigned / remainingWords / 3));
    return {
      segmentIndex,
      stepMs,
      wordIndex: segment.spokenWordCount
    };
  }

  return null;
}

function renderTranslatedHighlightState(activeSegmentIndex, activeWordIndex) {
  translatedSegments.forEach((segment, segmentIndex) => {
    segment.wordElements.forEach((wordElement, wordIndex) => {
      const isActive = segmentIndex === activeSegmentIndex && wordIndex === activeWordIndex;
      wordElement.classList.toggle("is-active", isActive);
    });
  });
}

function inferTranscriptKind(text) {
  if (text.startsWith("Input:")) {
    return "input";
  }

  if (text.startsWith("Output:")) {
    return "output";
  }

  return "system";
}

function normalizeTranscriptText(text, kind) {
  if (kind === "input" && text.startsWith("Input:")) {
    return text.slice("Input:".length).trim();
  }

  if (kind === "output" && text.startsWith("Output:")) {
    return text.slice("Output:".length).trim();
  }

  return text;
}

function isPlaceholderText(text) {
  return text === originalPlaceholder;
}

function getLastTranscriptLine(text) {
  if (isPlaceholderText(text)) {
    return "";
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines[lines.length - 1] : "";
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

function normalizeExportText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildFileTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

function renderTargetLanguageOptions() {
  const optionsMarkup = SUPPORTED_TRANSLATION_LANGUAGES.map(
    ({ code, label }) => `<option value="${code}">${label}</option>`
  ).join("");
  targetLanguageInput.innerHTML = optionsMarkup;
}

function renderInputSourceOptions() {
  const optionsMarkup = SUPPORTED_INPUT_SOURCES.map(
    ({ value, label }) => `<option value="${value}">${label}</option>`
  ).join("");
  inputSourceInput.innerHTML = optionsMarkup;
}

function normalizeInputSource(value) {
  return SUPPORTED_INPUT_SOURCES.some((source) => source.value === value) ? value : DEFAULT_INPUT_SOURCE;
}

function getSelectedInputSource() {
  return normalizeInputSource(inputSourceInput.value);
}

function updateInputSourcePresentation(inputSource) {
  const isMicrophone = normalizeInputSource(inputSource) === "microphone";
  originalAudioMixPercentInput.disabled = false;
  microphoneAccessControls.hidden = !isMicrophone;
  updateMicrophoneAccessUi();
  updateMicIndicator();
}

function normalizeTargetLanguageCode(code) {
  return SUPPORTED_TRANSLATION_LANGUAGES.some((language) => language.code === code)
    ? code
    : DEFAULT_TARGET_LANGUAGE_CODE;
}

function getSelectedTargetLanguageCode() {
  return normalizeTargetLanguageCode(targetLanguageInput.value);
}

function getSelectedTargetLanguageLabel() {
  return (
    SUPPORTED_TRANSLATION_LANGUAGES.find((language) => language.code === getSelectedTargetLanguageCode())
      ?.label ||
    "Translated"
  );
}

function updateTargetLanguagePresentation(targetLanguageCode) {
  const normalizedCode = normalizeTargetLanguageCode(targetLanguageCode);
  const label =
    SUPPORTED_TRANSLATION_LANGUAGES.find((language) => language.code === normalizedCode)?.label ||
    "Translated";
  translatedPaneTitle.textContent = label;
  applyTranslatedTranscriptDirection(normalizedCode);
  if (translatedTranscriptOutput.classList.contains("translated-transcript-empty")) {
    translatedTranscriptOutput.textContent = `${label} translation will appear here as Gemini returns audio/text events.`;
  }
  resetComparisonTranslatorState();
  resetComparisonOutput();
}

async function syncSessionState() {
  if (!currentTabId) {
    currentEstimatedCostMs = 0;
    currentSessionInputSource = getSelectedInputSource();
    updateStatus("idle", "No active browser tab is available for translation.");
    resetTranscriptOutputs();
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: "GET_SESSION_STATE", tabId: currentTabId });
  if (!response?.ok) {
    return;
  }

  if (response.targetLanguage) {
    targetLanguageInput.value = normalizeTargetLanguageCode(response.targetLanguage);
    updateTargetLanguagePresentation(targetLanguageInput.value);
  }

  if (response.inputSource) {
    inputSourceInput.value = normalizeInputSource(response.inputSource);
    updateInputSourcePresentation(inputSourceInput.value);
  }
  currentSessionInputSource = normalizeInputSource(response.inputSource || inputSourceInput.value);

  if (response.sourceMediaResumeDelaySeconds !== undefined) {
    sourceResumeDelaySecondsInput.value = String(
      normalizeSourceMediaResumeDelaySeconds(response.sourceMediaResumeDelaySeconds)
    );
  }

  if (response.originalAudioMixPercent !== undefined) {
    originalAudioMixPercentInput.value = String(normalizeOriginalAudioMixPercent(response.originalAudioMixPercent));
    updateOriginalAudioMixPercentValue();
  }

  if (typeof response.estimatedCostMs === "number" && Number.isFinite(response.estimatedCostMs)) {
    currentEstimatedCostMs = response.estimatedCostMs;
  }

  currentSessionStartedAt =
    typeof response.startedAt === "number" && Number.isFinite(response.startedAt) ? response.startedAt : null;
  applyTranscriptSnapshot(response.transcripts);
  updateStatus(response.phase || "idle", response.statusMessage || "Ready to start a translation session.");
}

async function syncReplayRecordingState() {
  if (!currentTabId) {
    stopReplayPreview();
    replayIsRecording = false;
    replayHasSavedCapture = false;
    updateRecordingIndicator();
    syncRecordingButtonsForState();
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: "GET_REPLAY_RECORDING_STATE", tabId: currentTabId });
  if (!response?.ok) {
    stopReplayPreview();
    replayIsRecording = false;
    replayHasSavedCapture = false;
    updateRecordingIndicator();
    syncRecordingButtonsForState();
    return;
  }

  replayIsRecording = Boolean(response.isRecording);
  replayHasSavedCapture = Boolean(response.hasReplay);
  updateRecordingIndicator();
  syncRecordingButtonsForState();
}

function syncButtonsForPhase(phase) {
  const isStarting =
    phase === "starting" ||
    phase === "connecting" ||
    phase === "auth" ||
    phase === "reconnecting" ||
    phase === "stopping";
  const isRunning = phase === "running";

  if (startButton) {
    startButton.disabled = isStarting || isRunning;
  }
  summaryStartButton.disabled = isStarting || isRunning;
  if (stopButton) {
    stopButton.disabled = !(isStarting || isRunning);
  }
  summaryStopButton.disabled = !(isStarting || isRunning);
  syncRecordingButtonsForState();
}

function syncRecordingButtonsForState() {
  const phase = phaseBadge.textContent || "idle";
  const canStartReplayRecording =
    !replayIsRecording &&
    (phase === "running" || phase === "streaming" || phase === "connecting" || phase === "starting");
  startRecordingButton.disabled = !canStartReplayRecording;
  stopRecordingButton.disabled = !replayIsRecording;
  replayRecordingButton.disabled = replayIsPlaying ? false : replayIsRecording || !replayHasSavedCapture;
  replayRecordingButton.textContent = replayIsPlaying ? "Stop replay" : "Replay";
  saveReplayButton.disabled = replayIsRecording || !replayHasSavedCapture;
  updateRecordingIndicator();
}

async function refreshActiveTabContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const nextTabId = tab?.id || null;

  if (nextTabId === currentTabId) {
    await syncSessionState();
    await syncReplayRecordingState();
    return;
  }

  currentTabId = nextTabId;
  stopReplayPreview();
  lastStartedTargetLanguage = null;
  currentSessionStartedAt = null;
  currentSessionInputSource = getSelectedInputSource();
  resetTranscriptOutputs();

  if (!currentTabId) {
    currentEstimatedCostMs = 0;
    updateStatus("idle", "No active browser tab is available for translation.");
    replayIsRecording = false;
    replayHasSavedCapture = false;
    syncRecordingButtonsForState();
    return;
  }

  await syncSessionState();
  await syncReplayRecordingState();
}

replayPreviewAudio.addEventListener("ended", () => {
  stopReplayPreview();
  updateRecordingMessage("Replay preview finished.");
});

replayPreviewAudio.addEventListener("pause", () => {
  if (!replayPreviewAudio.ended && replayIsPlaying && replayPreviewAudio.currentTime > 0) {
    replayIsPlaying = false;
    syncRecordingButtonsForState();
  }
});

function applyTranscriptSnapshot(transcripts = {}) {
  const originalText = normalizeWhitespace(transcripts.input || "");
  const translatedText = normalizeWhitespace(transcripts.output || "");
  const currentTranslatedText = getTranslatedTranscriptText();
  invalidateMetrics();
  translatedSegments = [];
  pendingTranslatedAudioMs = 0;
  if (activeHighlightTimeoutId) {
    clearTimeout(activeHighlightTimeoutId);
    activeHighlightTimeoutId = null;
  }

  originalTranscriptOutput.textContent = originalText || originalPlaceholder;
  comparisonOriginalTranscriptOutput.textContent = originalText || originalPlaceholder;
  applyTranslatedTranscriptDirection(getSelectedTargetLanguageCode());

  if (translatedText) {
    translatedTranscriptOutput.textContent = translatedText;
    translatedTranscriptOutput.className = "";
    translatedTranscriptOutput.scrollTop = translatedTranscriptOutput.scrollHeight;
  } else {
    translatedTranscriptOutput.textContent = `${getSelectedTargetLanguageLabel()} translation will appear here as Gemini returns audio/text events.`;
    translatedTranscriptOutput.className = "translated-transcript-empty";
  }

  if (!translatedText) {
    resetComparisonOutput("Comparison will begin when translated text is available.");
    comparisonLastRenderedText = "";
    return;
  }

  if (translatedText !== currentTranslatedText || comparisonTranscriptOutput.classList.contains("translated-transcript-empty")) {
    queueComparisonRefresh();
  }
}

function applyTranslatedTranscriptDirection(targetLanguageCode) {
  const isRtlLanguage = RTL_LANGUAGE_CODES.includes(normalizeTargetLanguageCode(targetLanguageCode));
  translatedTranscriptOutput.classList.toggle("is-rtl", isRtlLanguage);
  translatedTranscriptOutput.dir = isRtlLanguage ? "rtl" : "ltr";
}

function applyComparisonTranscriptDirection(languageCode) {
  const normalizedCode = normalizeTargetLanguageCode(languageCode || DEFAULT_TARGET_LANGUAGE_CODE);
  const isRtlLanguage =
    RTL_LANGUAGE_CODES.includes(normalizedCode) || normalizeBrowserLanguageCode(languageCode) === "iw";
  comparisonTranscriptOutput.classList.toggle("is-rtl", isRtlLanguage);
  comparisonTranscriptOutput.dir = isRtlLanguage ? "rtl" : "ltr";
}

function resetComparisonOutput(
  message = comparisonEnabled
    ? comparisonPlaceholder
    : "Comparison will begin when translated text is available."
) {
  comparisonPaneTitle.textContent = "Comparison";
  comparisonTranscriptOutput.textContent = message;
  comparisonTranscriptOutput.className = "translated-transcript-empty";
  applyComparisonTranscriptDirection(DEFAULT_TARGET_LANGUAGE_CODE);
}

function resetComparisonTranslatorState() {
  comparisonTranslator = null;
  comparisonTranslatorPairKey = null;
  comparisonSourceLanguageCode = null;
}

function getOriginalTranscriptText() {
  return normalizeWhitespace(
    isPlaceholderText(originalTranscriptOutput.textContent) ? "" : originalTranscriptOutput.textContent
  );
}

function getTranslatedTranscriptText() {
  return normalizeWhitespace(
    translatedTranscriptOutput.classList.contains("translated-transcript-empty")
      ? ""
      : translatedTranscriptOutput.textContent
  );
}

function queueComparisonRefresh() {
  return queueComparisonRefreshInternal({ force: false });
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function splitTextIntoTranslationChunks(text, maxChars = COMPARISON_TRANSLATE_CHUNK_CHARS) {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText) {
    return [];
  }

  if (normalizedText.length <= maxChars) {
    return [normalizedText];
  }

  const sentenceLikeParts = normalizedText.match(/[^.!?\n]+(?:[.!?\n]+|$)/g) || [normalizedText];
  const chunks = [];
  let currentChunk = "";

  for (const rawPart of sentenceLikeParts) {
    const part = normalizeWhitespace(rawPart);
    if (!part) {
      continue;
    }

    if (part.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      let remaining = part;
      while (remaining.length > maxChars) {
        let splitIndex = remaining.lastIndexOf(" ", maxChars);
        if (splitIndex < Math.floor(maxChars * 0.5)) {
          splitIndex = maxChars;
        }
        chunks.push(remaining.slice(0, splitIndex).trim());
        remaining = remaining.slice(splitIndex).trim();
      }
      if (remaining) {
        currentChunk = remaining;
      }
      continue;
    }

    const candidate = currentChunk ? `${currentChunk} ${part}` : part;
    if (candidate.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = part;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter(Boolean);
}

async function translateComparisonInChunks(translator, translatedText, generationToken) {
  const chunks = splitTextIntoTranslationChunks(translatedText);
  const translatedChunks = [];

  emitPanelDebug("Browser comparison chunk plan prepared", {
    chunkCount: chunks.length,
    translatedLength: translatedText.length
  });

  for (let index = 0; index < chunks.length; index += 1) {
    if (generationToken !== comparisonGenerationToken) {
      throw new Error("Comparison request superseded by a newer update.");
    }

    const chunkNumber = index + 1;
    const chunk = chunks[index];
    updateComparisonStatus(
      chunks.length > 1
        ? `Processing comparison... please wait... ${chunkNumber}/${chunks.length}`
        : "Processing comparison... please wait..."
    );
    emitPanelDebug("Browser comparison chunk translation started", {
      chunkNumber,
      chunkCount: chunks.length,
      chunkLength: chunk.length
    });
    const translatedChunk = await withTimeout(
      translator.translate(chunk),
      COMPARISON_TRANSLATE_TIMEOUT_MS,
      `Browser comparison chunk ${chunkNumber}`
    );
    translatedChunks.push(normalizeWhitespace(translatedChunk));
  }

  return normalizeWhitespace(translatedChunks.join(" "));
}

function queueComparisonRefreshInternal({ force = false } = {}) {
  if (!comparisonEnabled && !force) {
    return;
  }

  const translatedText = getTranslatedTranscriptText();
  if (!force && !shouldRefreshComparisonForText(translatedText)) {
    return;
  }

  if (comparisonRefreshTimeoutId) {
    clearTimeout(comparisonRefreshTimeoutId);
  }

  comparisonRefreshTimeoutId = setTimeout(() => {
    comparisonRefreshTimeoutId = null;
    void refreshComparisonTranscript();
  }, COMPARISON_REFRESH_DEBOUNCE_MS);
}

function shouldRefreshComparisonForText(translatedText) {
  if (!translatedText) {
    return false;
  }

  if (!comparisonLastRenderedText) {
    return true;
  }

  if (translatedText === comparisonLastRenderedText) {
    return false;
  }

  if (!translatedText.startsWith(comparisonLastRenderedText)) {
    return true;
  }

  const deltaText = translatedText.slice(comparisonLastRenderedText.length).trim();
  if (!deltaText) {
    return false;
  }

  if (deltaText.length >= COMPARISON_MIN_DELTA_CHARS) {
    return true;
  }

  return /[.!?。！？]\s*$/.test(translatedText);
}

async function primeComparisonSupportForCurrentSelection() {
  if (!("Translator" in globalThis)) {
    setComparisonWorking(false, "translator api unavailable during priming");
    resetComparisonOutput("Browser Translator API is not available in this Chrome build.");
    return;
  }

  if (getSelectedInputSource() !== "tab") {
    setComparisonWorking(false, "comparison waiting for transcript source detection");
    resetComparisonOutput("Comparison will initialize after the source language is detected from transcript text.");
    return;
  }

  if (!currentTabId || !chrome.tabs?.detectLanguage) {
    setComparisonWorking(false, "source tab language unavailable for comparison");
    resetComparisonOutput("Unable to detect the source tab language for browser-AI comparison.");
    return;
  }

  try {
    updateComparisonStatus("Checking browser-AI comparison availability...");
    const tabLanguageCode = await chrome.tabs.detectLanguage(currentTabId);
    const sourceLanguageCode = normalizeBrowserLanguageCode(tabLanguageCode);
    const targetLanguageCode = normalizeBrowserLanguageCode(getSelectedTargetLanguageCode());

    if (!sourceLanguageCode) {
      setComparisonWorking(false, "source tab language not detected");
      resetComparisonOutput("Source tab language could not be detected for comparison.");
      return;
    }

    comparisonSourceLanguageCode = sourceLanguageCode;
    const translator = await ensureComparisonTranslator(targetLanguageCode, sourceLanguageCode, {
      requireUserActivation: true
    });

    if (!translator) {
      return;
    }

    comparisonPaneTitle.textContent = `Comparison (${getLanguageLabelFromCode(sourceLanguageCode)})`;
  } catch (error) {
    emitPanelDebug("Comparison priming failed during user activation", {
      message: error?.message || String(error),
      name: error?.name || null
    });
    setComparisonWorking(false, "comparison priming failed");
    resetComparisonOutput(`Browser comparison setup failed: ${error?.message || "Unknown error"}`);
  }
}

async function ensureComparisonModeActive() {
  emitPanelDebug("Comparison tab activated", {
    comparisonEnabled,
    currentTabId,
    inputSource: getSelectedInputSource(),
    targetLanguage: getSelectedTargetLanguageCode()
  });
  const originalText = getOriginalTranscriptText();
  const translatedText = getTranslatedTranscriptText();
  const existingComparisonText = getComparisonTranscriptText();
  if (existingComparisonText) {
    comparisonEnabled = true;
    setComparisonWorking(false, "comparison already exists");
    return;
  }

  if (!originalText || !translatedText) {
    comparisonEnabled = true;
    setComparisonWorking(false, "missing original or translated transcript");
    resetComparisonOutput("Browser-AI comparison will appear here when back-translation is available.");
    return;
  }

  comparisonEnabled = true;
  setComparisonWorking(true, "comparison tab activated", "Checking browser-AI comparison availability...");
  await primeComparisonSupportForCurrentSelection();
  if (getComparisonTranscriptText()) {
    setComparisonWorking(false, "comparison text became available during priming");
    return;
  }
  queueComparisonRefreshInternal({ force: true });
}

async function refreshComparisonTranscript() {
  if (!comparisonEnabled) {
    setComparisonWorking(false, "comparison disabled");
    return;
  }

  const translatedText = getTranslatedTranscriptText();
  if (!translatedText) {
    setComparisonWorking(false, "no translated text");
    resetComparisonOutput();
    comparisonLastRenderedText = "";
    return;
  }

  if (!("Translator" in globalThis)) {
    setComparisonWorking(false, "translator api unavailable");
    resetComparisonOutput("Browser-native comparison is not available in this Chrome build.");
    return;
  }

  const sourceLanguageCode = await resolveComparisonSourceLanguage();
  if (!sourceLanguageCode) {
    setComparisonWorking(false, "source language unresolved");
    resetComparisonOutput("Waiting for enough original transcript to detect the source language for comparison.");
    return;
  }

  const browserSourceLanguageCode = normalizeBrowserLanguageCode(sourceLanguageCode);
  const browserTargetLanguageCode = normalizeBrowserLanguageCode(getSelectedTargetLanguageCode());
  if (
    !browserSourceLanguageCode ||
    !browserTargetLanguageCode ||
    !BROWSER_TRANSLATOR_SUPPORTED_CODES.has(browserSourceLanguageCode) ||
    !BROWSER_TRANSLATOR_SUPPORTED_CODES.has(browserTargetLanguageCode)
  ) {
    setComparisonWorking(false, "unsupported language pair");
    resetComparisonOutput("Browser-native comparison is not available for this language pair.");
    return;
  }

  const translator = await ensureComparisonTranslator(browserTargetLanguageCode, browserSourceLanguageCode);
  if (!translator) {
    setComparisonWorking(false, "translator unavailable after ensure");
    return;
  }

  const currentToken = ++comparisonGenerationToken;

  try {
    if (comparisonLastRenderedText === translatedText) {
      setComparisonWorking(false, "translated text already rendered");
      return;
    }

    setComparisonWorking(true, "comparison translation in progress", "Processing comparison... please wait...");

    emitPanelDebug("Browser comparison translation started", {
      sourceLanguageCode,
      translatedLength: translatedText.length
    });
    const backTranslatedText = await translateComparisonInChunks(translator, translatedText, currentToken);
    if (currentToken !== comparisonGenerationToken) {
      setComparisonWorking(false, "stale comparison generation token");
      return;
    }

    const sourceLanguageLabel = getLanguageLabelFromCode(sourceLanguageCode);
    comparisonPaneTitle.textContent = `Comparison (${sourceLanguageLabel})`;
    applyComparisonTranscriptDirection(sourceLanguageCode);
    invalidateMetrics("Comparison changed. Reopen Metrics when the review text is ready.");
    comparisonTranscriptOutput.textContent = backTranslatedText || "No browser-AI comparison text returned yet.";
    comparisonTranscriptOutput.className = "";
    comparisonTranscriptOutput.scrollTop = comparisonTranscriptOutput.scrollHeight;
    comparisonLastRenderedText = translatedText;
    emitPanelDebug("Browser comparison translation completed", {
      outputLength: backTranslatedText.length
    });
    setComparisonWorking(false, "comparison translation complete");
  } catch (error) {
    emitPanelDebug("Browser comparison translation failed", {
      message: error?.message || String(error),
      name: error?.name || null
    });
    setComparisonWorking(false, `comparison translation failed: ${error?.message || "unknown error"}`);
    resetComparisonOutput(`Browser comparison unavailable: ${error?.message || "Translation failed"}`);
  }
}

async function resolveComparisonSourceLanguage() {
  if (comparisonSourceLanguageCode) {
    return comparisonSourceLanguageCode;
  }

  const originalText = getOriginalTranscriptText();
  if (originalText.length < 24) {
    return null;
  }

  const detectorLanguageCode = await detectSourceLanguageFromBrowserAi(originalText);
  if (detectorLanguageCode) {
    comparisonSourceLanguageCode = detectorLanguageCode;
    return comparisonSourceLanguageCode;
  }

  if (currentTabId && currentSessionInputSource === "tab" && chrome.tabs?.detectLanguage) {
    try {
      const tabLanguageCode = await chrome.tabs.detectLanguage(currentTabId);
      const normalizedTabLanguageCode = normalizeBrowserLanguageCode(tabLanguageCode);
      if (normalizedTabLanguageCode) {
        comparisonSourceLanguageCode = normalizedTabLanguageCode;
        return comparisonSourceLanguageCode;
      }
    } catch (error) {
      emitPanelDebug("Tab language detection failed for comparison pane", {
        message: error?.message || String(error),
        name: error?.name || null
      });
    }
  }

  return null;
}

async function detectSourceLanguageFromBrowserAi(text) {
  if (!("LanguageDetector" in globalThis)) {
    return null;
  }

  try {
    comparisonDetector ||= await globalThis.LanguageDetector.create();
    const detectionResults = await comparisonDetector.detect(text);
    if (!Array.isArray(detectionResults) || detectionResults.length === 0) {
      return null;
    }

    const detectedLanguageCode =
      detectionResults[0]?.detectedLanguage ||
      detectionResults[0]?.language ||
      detectionResults[0]?.code ||
      null;
    return normalizeBrowserLanguageCode(detectedLanguageCode);
  } catch (error) {
    emitPanelDebug("Browser language detection failed for comparison pane", {
      message: error?.message || String(error),
      name: error?.name || null
    });
    return null;
  }
}

async function ensureComparisonTranslator(sourceLanguage, targetLanguage, { requireUserActivation = false } = {}) {
  const pairKey = `${sourceLanguage}->${targetLanguage}`;
  if (comparisonTranslator && comparisonTranslatorPairKey === pairKey) {
    return comparisonTranslator;
  }

  try {
    const availability = await globalThis.Translator.availability({
      sourceLanguage,
      targetLanguage
    });

    emitPanelDebug("Browser comparison availability checked", {
      availability,
      sourceLanguage,
      targetLanguage
    });

    if (availability === "downloadable" || availability === "downloading") {
      updateComparisonStatus("Preparing browser-AI comparison... please wait...");
    }

    if (!["available", "downloadable", "downloading"].includes(availability)) {
      resetComparisonOutput("Browser-native comparison is not available for this language pair.");
      return null;
    }

    comparisonTranslator = await globalThis.Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor(monitorHandle) {
        monitorHandle.addEventListener("downloadprogress", (event) => {
          const progressPercent = Number.isFinite(event?.loaded) ? Math.round(event.loaded * 100) : null;
          updateComparisonStatus(
            progressPercent === null
              ? "Preparing browser-AI comparison... please wait..."
              : `Preparing browser-AI comparison... please wait... ${progressPercent}%`
          );
        });
      }
    });
    comparisonTranslatorPairKey = pairKey;
    if (comparisonTranslator?.ready) {
      updateComparisonStatus(
        requireUserActivation
          ? "Finalizing browser-AI comparison setup..."
          : "Preparing browser-AI comparison... please wait..."
      );
      try {
        await withTimeout(comparisonTranslator.ready, COMPARISON_READY_TIMEOUT_MS, "Browser comparison setup");
      } catch (error) {
        emitPanelDebug("Browser comparison ready wait timed out; proceeding with translator anyway", {
          message: error?.message || String(error),
          sourceLanguage,
          targetLanguage
        });
        updateComparisonStatus("Browser-AI comparison is taking longer than expected. Attempting translation...");
      }
    }
    return comparisonTranslator;
  } catch (error) {
    emitPanelDebug("Browser comparison translator failed to initialize", {
      message: error?.message || String(error),
      name: error?.name || null,
      sourceLanguage,
      targetLanguage
    });
    const errorMessage = error?.message || "Translator setup failed";
    resetComparisonOutput(
      /activation|gesture/i.test(errorMessage)
        ? "Browser comparison needs a user click to initialize. Press Start again after transcript is visible."
        : `Browser comparison unavailable: ${errorMessage}`
    );
    return null;
  }
}

function getComparisonTranscriptText() {
  return normalizeWhitespace(
    comparisonTranscriptOutput.classList.contains("translated-transcript-empty")
      ? ""
      : comparisonTranscriptOutput.textContent
  );
}

function buildMetricsPrompt({ originalText, translatedText, comparisonText, targetLanguageLabel, sourceLanguageLabel }) {
  return [
    "You are an objective translation quality evaluator.",
    "Compare the original transcript against the back-translated transcript.",
    "Use the direct translated transcript as a primary fluency audit target and supporting context for the rest.",
    "Return strict JSON only with this exact shape:",
    '{"overallScore":0,"overallNote":"","intentScore":0,"intentNote":"","fluencyScore":0,"fluencyNote":"","fluencyFlag":"","toneScore":0,"toneNote":"","numericScore":0,"numericNote":"","entityScore":0,"entityNote":"","omissionScore":0,"omissionNote":"","summary":"","strengths":[""],"concerns":[""],"recommendedChecks":[""]}',
    "Use double quotes for every key and every string value.",
    "Escape any quote characters that appear inside string values.",
    "Do not include trailing commas.",
    "Do not include markdown fences or commentary.",
    "Scoring rules:",
    "- Scores are integers from 0 to 100.",
    "- Be conservative and practical, not flattering.",
    "- Focus on meaning preservation, target-language fluency, tone preservation, numeric accuracy, named entities, and omissions/additions.",
    "- Perform a harsh grammar audit on the translated text itself, not just the back-translation.",
    "- Penalize broken grammar, doubled articles, agreement errors, robotic literal phrasing, or obviously unnatural target-language syntax.",
    '- Set "fluencyFlag" to exactly one of: "PASS", "FAIL - <brief reason>", or "Requires human review".',
    "- If there are no important numbers or named entities, still provide a score and explain briefly.",
    "- Keep each note to one short sentence.",
    "- Keep summary to 2-4 sentences.",
    "- Keep list items short and actionable.",
    "",
    `Source language label: ${sourceLanguageLabel || "Original"}`,
    `Target language label: ${targetLanguageLabel}`,
    "",
    "Original transcript:",
    originalText,
    "",
    `${targetLanguageLabel} transcript:`,
    translatedText,
    "",
    "Back-translated transcript:",
    comparisonText
  ].join("\n");
}

function extractFirstJsonObject(text) {
  const rawText = String(text || "").trim();
  if (!rawText) {
    return null;
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidateText = fencedMatch?.[1]?.trim() || rawText;
  const firstBraceIndex = candidateText.indexOf("{");
  if (firstBraceIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = firstBraceIndex; index < candidateText.length; index += 1) {
    const character = candidateText[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return candidateText.slice(firstBraceIndex, index + 1);
      }
    }
  }

  return null;
}

function normalizeMetricsScore(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function normalizeMetricsNote(value, fallback) {
  const note = normalizeWhitespace(value);
  return note || fallback;
}

function normalizeMetricsList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .slice(0, 5);
}

function parseMetricsReport(responseText) {
  const jsonText = extractFirstJsonObject(responseText);
  if (!jsonText) {
    throw new Error("Local AI did not return valid JSON for metrics.");
  }

  const parsed = parseMetricsJsonWithFallback(jsonText);
  return {
    overallScore: normalizeMetricsScore(parsed.overallScore),
    overallNote: normalizeMetricsNote(parsed.overallNote, "Overall quality estimate from original vs back-translation."),
    intentScore: normalizeMetricsScore(parsed.intentScore),
    intentNote: normalizeMetricsNote(parsed.intentNote, "How well the intended meaning survived translation."),
    fluencyScore: normalizeMetricsScore(parsed.fluencyScore),
    fluencyNote: normalizeMetricsNote(parsed.fluencyNote, "How natural and grammatically correct the translated text sounds in the target language."),
    fluencyFlag: normalizeMetricsNote(parsed.fluencyFlag, "Requires human review"),
    toneScore: normalizeMetricsScore(parsed.toneScore),
    toneNote: normalizeMetricsNote(parsed.toneNote, "How closely the style and emphasis matched."),
    numericScore: normalizeMetricsScore(parsed.numericScore),
    numericNote: normalizeMetricsNote(parsed.numericNote, "How accurately numbers and factual quantities were retained."),
    entityScore: normalizeMetricsScore(parsed.entityScore),
    entityNote: normalizeMetricsNote(parsed.entityNote, "How accurately names and entities were retained."),
    omissionScore: normalizeMetricsScore(parsed.omissionScore),
    omissionNote: normalizeMetricsNote(parsed.omissionNote, "Whether content was dropped or invented."),
    summary: normalizeMetricsNote(parsed.summary, "No metrics summary returned."),
    strengths: normalizeMetricsList(parsed.strengths),
    concerns: normalizeMetricsList(parsed.concerns),
    recommendedChecks: normalizeMetricsList(parsed.recommendedChecks)
  };
}

function parseMetricsJsonWithFallback(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    emitPanelDebug("Metrics JSON parse failed, attempting schema salvage", {
      message: error?.message || String(error)
    });
  }

  return {
    overallScore: extractNumericField(jsonText, "overallScore"),
    overallNote: extractStringField(jsonText, "overallNote"),
    intentScore: extractNumericField(jsonText, "intentScore"),
    intentNote: extractStringField(jsonText, "intentNote"),
    fluencyScore: extractNumericField(jsonText, "fluencyScore"),
    fluencyNote: extractStringField(jsonText, "fluencyNote"),
    fluencyFlag: extractStringField(jsonText, "fluencyFlag"),
    toneScore: extractNumericField(jsonText, "toneScore"),
    toneNote: extractStringField(jsonText, "toneNote"),
    numericScore: extractNumericField(jsonText, "numericScore"),
    numericNote: extractStringField(jsonText, "numericNote"),
    entityScore: extractNumericField(jsonText, "entityScore"),
    entityNote: extractStringField(jsonText, "entityNote"),
    omissionScore: extractNumericField(jsonText, "omissionScore"),
    omissionNote: extractStringField(jsonText, "omissionNote"),
    summary: extractStringField(jsonText, "summary"),
    strengths: extractArrayField(jsonText, "strengths"),
    concerns: extractArrayField(jsonText, "concerns"),
    recommendedChecks: extractArrayField(jsonText, "recommendedChecks")
  };
}

function extractNumericField(jsonText, key) {
  const match = jsonText.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i"));
  if (!match) {
    return null;
  }

  const numericValue = Number(match[1]);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function extractStringField(jsonText, key) {
  const marker = `"${key}"`;
  const keyIndex = jsonText.indexOf(marker);
  if (keyIndex === -1) {
    return "";
  }

  const colonIndex = jsonText.indexOf(":", keyIndex + marker.length);
  if (colonIndex === -1) {
    return "";
  }

  const firstQuoteIndex = jsonText.indexOf("\"", colonIndex + 1);
  if (firstQuoteIndex === -1) {
    return "";
  }

  let isEscaped = false;
  let value = "";

  for (let index = firstQuoteIndex + 1; index < jsonText.length; index += 1) {
    const character = jsonText[index];
    if (isEscaped) {
      value += character;
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      continue;
    }

    if (character === "\"") {
      return value;
    }

    value += character;
  }

  return value;
}

function extractArrayField(jsonText, key) {
  const marker = `"${key}"`;
  const keyIndex = jsonText.indexOf(marker);
  if (keyIndex === -1) {
    return [];
  }

  const colonIndex = jsonText.indexOf(":", keyIndex + marker.length);
  if (colonIndex === -1) {
    return [];
  }

  const openingBracketIndex = jsonText.indexOf("[", colonIndex + 1);
  if (openingBracketIndex === -1) {
    return [];
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = openingBracketIndex; index < jsonText.length; index += 1) {
    const character = jsonText[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "[") {
      depth += 1;
      continue;
    }

    if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        const arrayBody = jsonText.slice(openingBracketIndex + 1, index);
        const items = [];
        const stringPattern = /"((?:\\.|[^"\\])*)"/g;
        let match;
        while ((match = stringPattern.exec(arrayBody)) !== null) {
          items.push(match[1]);
        }
        return items;
      }
    }
  }

  return [];
}

async function ensureMetricsLanguageModel({ requireUserActivation = false } = {}) {
  if (!("LanguageModel" in globalThis)) {
    throw new Error("Chrome local Prompt API is not available in this build.");
  }

  if (metricsLanguageModel && metricsLanguageModelReady) {
    await metricsLanguageModelReady;
    return metricsLanguageModel;
  }

  const metricsLanguageModelOptions = {
    expectedOutputs: [
      {
        languages: ["en"],
        type: "text"
      }
    ]
  };

  const availability = await globalThis.LanguageModel.availability(metricsLanguageModelOptions);
  emitPanelDebug("Metrics LanguageModel availability checked", {
    availability
  });

  if (!["available", "downloadable", "downloading"].includes(availability)) {
    throw new Error("Chrome local AI metrics are unavailable on this device.");
  }

  if (availability === "downloadable" || availability === "downloading" || requireUserActivation) {
    updateMetricsStatus("Processing metrics... please wait...");
  }

  metricsLanguageModel = await globalThis.LanguageModel.create({
      ...metricsLanguageModelOptions,
      monitor(monitorHandle) {
        monitorHandle.addEventListener("downloadprogress", (event) => {
          updateMetricsStatus("Processing metrics... please wait...");
        });
      }
    });

  metricsLanguageModelReady = Promise.resolve(metricsLanguageModel?.ready).catch((error) => {
    metricsLanguageModel = null;
    metricsLanguageModelReady = null;
    throw error;
  });

  await metricsLanguageModelReady;
  return metricsLanguageModel;
}

async function generateMetricsReport() {
  const originalText = getOriginalTranscriptText();
  const translatedText = getTranslatedTranscriptText();
  const comparisonText = getComparisonTranscriptText();

  if (!originalText || !translatedText) {
    updateMetricsStatus("Run a translation session first so local AI has transcript material to score.");
    return;
  }

  if (!comparisonText) {
    updateMetricsStatus(metricsWaitingForComparisonMessage);
    setActiveWorkflowTab("comparison");
    return;
  }

  setMetricsWorking(true);
  updateMetricsStatus("Processing Metrics please wait....");

  try {
    const session = await ensureMetricsLanguageModel({ requireUserActivation: true });
    const sourceLanguageCode = await resolveComparisonSourceLanguage();
    const sourceLanguageLabel = getLanguageLabelFromCode(sourceLanguageCode || "en");
    const targetLanguageLabel = getSelectedTargetLanguageLabel();
    const prompt = buildMetricsPrompt({
      comparisonText,
      originalText,
      sourceLanguageLabel,
      targetLanguageLabel,
      translatedText
    });
    const responseText = await session.prompt(prompt);
    const report = parseMetricsReport(responseText);
    renderMetricsReport(report);
    updateMetricsStatus("Metrics generated with Chrome local AI. Review the scores and notes below.");
    emitPanelDebug("Metrics generated successfully", {
      overallScore: report.overallScore,
      targetLanguage: getSelectedTargetLanguageCode()
    });
  } catch (error) {
    emitPanelDebug("Metrics generation failed", {
      message: error?.message || String(error),
      name: error?.name || null
    });
    updateMetricsStatus(`Metrics unavailable: ${error?.message || "Unknown local AI error"}`);
  } finally {
    setMetricsWorking(false);
  }
}

async function ensureMetricsModeActive() {
  if (metricsHasResults) {
    return;
  }

  if (metricsStatusMessage.textContent === "Generating local AI metrics from the saved session...") {
    return;
  }

  await generateMetricsReport();
}

function syncPollingForPhase(phase) {
  const shouldPoll =
    phase === "starting" ||
    phase === "connecting" ||
    phase === "auth" ||
    phase === "reconnecting" ||
    phase === "stopping";

  if (!shouldPoll && sessionPollId) {
    clearInterval(sessionPollId);
    sessionPollId = null;
    return;
  }

  if (shouldPoll && !sessionPollId) {
    sessionPollId = setInterval(() => {
      void syncSessionState();
    }, 1000);
  }
}

function syncCostTimerForPhase(phase) {
  const shouldTick = isCostTrackingPhase(phase) && Boolean(currentSessionStartedAt) && Boolean(currentTabId);

  if (!shouldTick && sessionCostTimerId) {
    clearInterval(sessionCostTimerId);
    sessionCostTimerId = null;
    return;
  }

  if (shouldTick && !sessionCostTimerId) {
    sessionCostTimerId = setInterval(() => {
      void syncSessionState();
    }, 1000);
  }
}

function isCostTrackingPhase(phase) {
  return phase === "starting" || phase === "connecting" || phase === "running" || phase === "streaming" || phase === "reconnecting";
}

function updateMicIndicator() {
  const phase = phaseBadge.textContent || "idle";
  const micIsActive = currentSessionInputSource === "microphone" && isCostTrackingPhase(phase);
  micIndicator.hidden = !micIsActive;
}

function updateMicrophoneAccessUi() {
  if (microphoneAccessControls.hidden) {
    return;
  }

  if (microphonePermissionState === "granted") {
    microphoneAccessMessage.textContent = "Microphone ready. You can start live translated commentary.";
    grantMicrophoneAccessButton.textContent = "Re-check microphone access";
    return;
  }

  if (microphonePermissionState === "denied") {
    microphoneAccessMessage.textContent = "Microphone permission is not active. Click again and allow access when the browser prompts.";
    grantMicrophoneAccessButton.textContent = "Grant microphone access";
    return;
  }

  microphoneAccessMessage.textContent = "Microphone mode needs one-time browser permission from this panel.";
  grantMicrophoneAccessButton.textContent = "Grant microphone access";
}

async function refreshMicrophonePermissionState() {
  try {
    if (!navigator.permissions?.query) {
      emitPanelDebug("Permissions API is unavailable for microphone preflight", {
        hasPermissionsApi: Boolean(navigator.permissions)
      });
      microphonePermissionState = "unknown";
      updateMicrophoneAccessUi();
      return;
    }

    const permissionStatus = await navigator.permissions.query({ name: "microphone" });
    emitPanelDebug("Microphone permission state refreshed", {
      state: permissionStatus.state
    });
    microphonePermissionState = permissionStatus.state === "granted" ? "granted" : permissionStatus.state === "denied" ? "denied" : "unknown";
    permissionStatus.onchange = () => {
      microphonePermissionState =
        permissionStatus.state === "granted" ? "granted" : permissionStatus.state === "denied" ? "denied" : "unknown";
      emitPanelDebug("Microphone permission state changed", {
        state: permissionStatus.state
      });
      updateMicrophoneAccessUi();
    };
  } catch (error) {
    emitPanelDebug("Unable to query microphone permission state", {
      message: error?.message || String(error),
      name: error?.name || null
    });
    microphonePermissionState = "unknown";
  }

  updateMicrophoneAccessUi();
}

async function requestMicrophoneAccess() {
  grantMicrophoneAccessButton.disabled = true;
  microphoneAccessMessage.textContent = "Opening microphone permission window...";

  try {
    emitPanelDebug("Opening microphone permission window", {
      inputSource: getSelectedInputSource(),
      location: location.href
    });
    microphonePermissionState = "unknown";
    updateMicrophoneAccessUi();

    const permissionPageUrl = chrome.runtime.getURL("mic-permission.html");
    const permissionWindow = await chrome.windows.create({
      focused: true,
      height: 520,
      type: "popup",
      url: permissionPageUrl,
      width: 420
    });
    microphonePermissionWindowId = permissionWindow.id ?? null;
    microphoneAccessMessage.textContent = "Microphone permission window opened. Complete the prompt there.";
    emitPanelDebug("Microphone permission window opened", {
      url: permissionPageUrl,
      windowId: microphonePermissionWindowId
    });
  } catch (error) {
    emitPanelDebug("Microphone permission window failed to open", {
      message: error?.message || String(error),
      name: error?.name || null
    });
    microphonePermissionState = "denied";
    updateMicrophoneAccessUi();
    updateStatus("error", `Unable to open microphone permission window: ${error?.message || "Unknown error"}`);
  } finally {
    emitPanelDebug("Microphone access request completed", {
      permissionState: microphonePermissionState
    });
    grantMicrophoneAccessButton.disabled = false;
  }
}

function emitPanelDebug(message, details = undefined) {
  console.info("[polyglot-live/sidepanel]", message, details || "");
  chrome.runtime.sendMessage({
    type: "SESSION_DEBUG",
    payload: {
      details,
      message,
      source: "sidepanel"
    },
    tabId: currentTabId
  }).catch(() => {
    return undefined;
  });
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function normalizeSourceMediaResumeDelaySeconds(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SOURCE_MEDIA_RESUME_DELAY_SECONDS;
  }

  return Math.min(30, Math.max(0, Math.round(numericValue)));
}

function normalizeOriginalAudioMixPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ORIGINAL_AUDIO_MIX_PERCENT;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function updateOriginalAudioMixPercentValue() {
  originalAudioMixPercentValue.textContent = `${normalizeOriginalAudioMixPercent(originalAudioMixPercentInput.value)}%`;
}

async function maybeUpdateOriginalAudioMixInSession() {
  if (!currentTabId) {
    return;
  }

  const phase = phaseBadge.textContent || "idle";
  if (phase !== "running" && phase !== "streaming" && phase !== "connecting" && phase !== "starting") {
    return;
  }

  await chrome.runtime.sendMessage({
    type: "UPDATE_ORIGINAL_AUDIO_MIX",
    tabId: currentTabId,
    originalAudioMixPercent: normalizeOriginalAudioMixPercent(originalAudioMixPercentInput.value)
  }).catch(() => {
    return undefined;
  });
}

function normalizeBrowserLanguageCode(code) {
  if (!code) {
    return null;
  }

  const normalizedCode = String(code).trim();
  const browserAliases = {
    he: "iw",
    "pt-BR": "pt",
    "pt-PT": "pt",
    "zh-Hans": "zh",
    "zh-CN": "zh",
    "zh-SG": "zh",
    "zh-Hant": "zh-Hant",
    "zh-TW": "zh-Hant",
    "zh-HK": "zh-Hant"
  };

  if (browserAliases[normalizedCode]) {
    return browserAliases[normalizedCode];
  }

  if (BROWSER_TRANSLATOR_SUPPORTED_CODES.has(normalizedCode)) {
    return normalizedCode;
  }

  const primaryLanguage = normalizedCode.split("-")[0];
  if (browserAliases[primaryLanguage]) {
    return browserAliases[primaryLanguage];
  }

  return BROWSER_TRANSLATOR_SUPPORTED_CODES.has(primaryLanguage) ? primaryLanguage : null;
}

function getLanguageLabelFromCode(code) {
  if (!code) {
    return "Original";
  }

  const manifestLanguage =
    SUPPORTED_TRANSLATION_LANGUAGES.find((language) => language.code === code) ||
    SUPPORTED_TRANSLATION_LANGUAGES.find((language) => normalizeBrowserLanguageCode(language.code) === code);
  if (manifestLanguage) {
    return manifestLanguage.label;
  }

  if (code === "iw") {
    return "Hebrew";
  }

  if (code === "pt") {
    return "Portuguese";
  }

  if (code === "zh") {
    return "Chinese";
  }

  return code;
}
