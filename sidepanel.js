import {
  DEFAULT_TARGET_LANGUAGE_CODE,
  DEFAULT_TOKEN_ENDPOINT,
  SUPPORTED_TRANSLATION_LANGUAGES
} from "./config.js";
const targetLanguageInput = document.querySelector("#targetLanguage");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const statusMessage = document.querySelector("#statusMessage");
const phaseBadge = document.querySelector("#phaseBadge");
const translatedPaneTitle = document.querySelector("#translatedPaneTitle");
const originalTranscriptOutput = document.querySelector("#originalTranscriptOutput");
const translatedTranscriptOutput = document.querySelector("#translatedTranscriptOutput");
const tokenEndpointInput = document.querySelector("#tokenEndpoint");
const tokenSecretInput = document.querySelector("#tokenSecret");
const checkAuthButton = document.querySelector("#checkAuthButton");
const authMessage = document.querySelector("#authMessage");
const themeToggleButton = document.querySelector("#themeToggleButton");
let sessionPollId = null;
let translatedSegments = [];
let pendingTranslatedAudioMs = 0;
let activeHighlightTimeoutId = null;
let lastStartedTargetLanguage = null;
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

startButton.addEventListener("click", async () => {
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
    passThroughOriginalAudio: false,
    targetLanguage: selectedTargetLanguage
  });

  setBusy(false);

  if (!response?.ok) {
    if ((response?.error || "").includes("already starting")) {
      updateStatus("starting", "A translation session is already starting. Please wait a moment.");
      await syncSessionState();
      return;
    }

    updateStatus("error", response?.error ?? "Unable to start translation.");
    return;
  }

  lastStartedTargetLanguage = selectedTargetLanguage;
  updateStatus("running", `Session started on tab ${response.tabId}.`);
});

stopButton.addEventListener("click", async () => {
  setBusy(true);
  const response = await chrome.runtime.sendMessage({ type: "STOP_TRANSLATION" });
  setBusy(false);

  if (!response?.ok) {
    updateStatus("error", response?.error ?? "Unable to stop translation.");
    return;
  }

  lastStartedTargetLanguage = null;
  resetTranscriptOutputs();
  updateStatus("idle", "Translation stopped.");
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "SESSION_EVENT") {
    return;
  }

  if (message.event === "status") {
    updateStatus(message.payload.phase, message.payload.message);
  }

  if (message.event === "transcript") {
    appendTranscript(message.payload);
  }

  if (message.event === "audio_timing") {
    applyTranslatedAudioTiming(message.payload);
  }
});

function setBusy(isBusy) {
  startButton.disabled = isBusy;
  stopButton.disabled = !isBusy;
}

function updateStatus(phase, message) {
  phaseBadge.textContent = phase;
  statusMessage.textContent = message;
  if (phase === "idle") {
    lastStartedTargetLanguage = null;
  }
  syncButtonsForPhase(phase);
  syncPollingForPhase(phase);
}

async function initialize() {
  const { authConfig = {}, panelTheme = DEFAULT_THEME, translationPrefs = {} } = await chrome.storage.local.get([
    "authConfig",
    "panelTheme",
    "translationPrefs"
  ]);
  tokenEndpointInput.value = authConfig.tokenEndpoint || DEFAULT_TOKEN_ENDPOINT;
  tokenSecretInput.value = authConfig.tokenSecret || "";
  applyTheme(panelTheme);
  renderTargetLanguageOptions();
  targetLanguageInput.value = normalizeTargetLanguageCode(translationPrefs.targetLanguage);
  updateTargetLanguagePresentation(targetLanguageInput.value);

  tokenEndpointInput.addEventListener("change", () => {
    void persistAuthConfig();
  });

  tokenSecretInput.addEventListener("change", () => {
    void persistAuthConfig();
  });

  targetLanguageInput.addEventListener("change", () => {
    updateTargetLanguagePresentation(getSelectedTargetLanguageCode());
    resetTranscriptOutputs();
    void persistTranslationPrefs();
  });

  updateAuthMessage("Not checked yet.");
  resetTranscriptOutputs();
  await syncSessionState();
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
      passThroughOriginalAudio: false,
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

function resetTranscriptOutputs() {
  originalTranscriptOutput.textContent = "Original transcript will appear here as speech is detected.";
  translatedTranscriptOutput.textContent = `${getSelectedTargetLanguageLabel()} translation will appear here as Gemini returns audio/text events.`;
  translatedTranscriptOutput.className = "translated-transcript-empty";
  translatedSegments = [];
  pendingTranslatedAudioMs = 0;
  if (activeHighlightTimeoutId) {
    clearTimeout(activeHighlightTimeoutId);
    activeHighlightTimeoutId = null;
  }
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

  originalTranscriptOutput.scrollTop = originalTranscriptOutput.scrollHeight;
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
  return text === "Original transcript will appear here as speech is detected.";
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

function renderTargetLanguageOptions() {
  const optionsMarkup = SUPPORTED_TRANSLATION_LANGUAGES.map(
    ({ code, label }) => `<option value="${code}">${label}</option>`
  ).join("");
  targetLanguageInput.innerHTML = optionsMarkup;
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
  if (translatedTranscriptOutput.classList.contains("translated-transcript-empty")) {
    translatedTranscriptOutput.textContent = `${label} translation will appear here as Gemini returns audio/text events.`;
  }
}

async function syncSessionState() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SESSION_STATE" });
  if (!response?.ok) {
    return;
  }

  updateStatus(response.phase || "idle", response.statusMessage || "Ready to start a translation session.");
}

function syncButtonsForPhase(phase) {
  const isStarting =
    phase === "starting" ||
    phase === "connecting" ||
    phase === "auth" ||
    phase === "reconnecting" ||
    phase === "stopping";
  const isRunning = phase === "running";

  startButton.disabled = isStarting || isRunning;
  stopButton.disabled = !(isStarting || isRunning);
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
