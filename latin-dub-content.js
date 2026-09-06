let isDubbing = false;
let lastCaption = "";
let captionObserver = null;

function getCaptionContainer() {
  return (
    document.querySelector(".ytp-caption-segment")?.closest(".ytp-caption-window-container") ||
    document.querySelector(".ytp-caption-window-container") ||
    document.querySelector("#movie_player .ytp-caption-window-container")
  );
}

function getCurrentCaptions() {
  const segments = Array.from(document.querySelectorAll(".ytp-caption-segment"));
  return segments.map((s) => s.textContent.trim()).filter(Boolean).join(" ");
}

function emitCaption(text) {
  if (!text || text === lastCaption) return;
  lastCaption = text;
  chrome.runtime.sendMessage({ type: "LATIN_DUB_CAPTION", text, url: location.href }).catch(() => {});
}

function startObserving() {
  if (captionObserver) return;

  const check = () => {
    if (!isDubbing) return;
    const text = getCurrentCaptions();
    emitCaption(text);
  };

  check();
  captionObserver = new MutationObserver(() => {
    if (!isDubbing) return;
    check();
  });

  const container = getCaptionContainer() || document.body;
  captionObserver.observe(container, { childList: true, subtree: true, characterData: true });

  document.addEventListener("click", () => {
    setTimeout(check, 300);
  }, { once: false });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "LATIN_DUB_ENABLE") {
    isDubbing = true;
    lastCaption = "";
    startObserving();
    return false;
  }

  if (message?.type === "LATIN_DUB_DISABLE") {
    isDubbing = false;
    lastCaption = "";
    return false;
  }

  return false;
});
