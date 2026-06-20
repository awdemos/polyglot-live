const statusElement = document.querySelector("#status");

initialize().catch((error) => {
  setStatus(`Microphone access failed: ${error?.message || String(error)}`, "error");
  void sendPermissionState("denied", error?.message || String(error));
});

async function initialize() {
  setStatus("Requesting microphone access...", "");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  setStatus("Microphone access granted. You can close this window.", "ready");
  for (const track of stream.getTracks()) {
    track.stop();
  }

  await sendPermissionState("granted");
  setTimeout(() => {
    window.close();
  }, 600);
}

function setStatus(message, state) {
  statusElement.textContent = message;
  statusElement.classList.remove("is-ready", "is-error");
  if (state === "ready") {
    statusElement.classList.add("is-ready");
  }
  if (state === "error") {
    statusElement.classList.add("is-error");
  }
}

async function sendPermissionState(state, reason = "") {
  let currentWindowId = null;
  try {
    const currentWindow = await chrome.windows.getCurrent();
    currentWindowId = currentWindow.id ?? null;
  } catch {
    currentWindowId = null;
  }

  await chrome.runtime.sendMessage({
    type: "MIC_PERMISSION_STATE",
    reason,
    state,
    windowClosed: true,
    windowId: currentWindowId
  }).catch(() => {
    return undefined;
  });
}
