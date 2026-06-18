# polyglot-live

`polyglot-live` is a Chrome Manifest V3 extension for real-time tab-audio translation with:

- a side panel for controls and live status
- a readiness check that verifies local token provisioning before live start
- a right-click context menu entry for starting translation from the current page
- a service worker for orchestration
- an offscreen document for audio capture and playback
- a real Gemini Live Translate WebSocket client
- a local ephemeral-token server powered by Google's official `@google/genai` SDK

## Current status

This repo now includes a real Live Translate WebSocket transport and a working local token provisioning server. It is still a developer build, so you will need to run the token server locally and provide a Gemini API key through environment variables.

The current Gemini Live Translate docs were last updated on `2026-06-09 UTC`, and this scaffold now matches the documented contract more closely:

- model: `gemini-3.5-live-translate-preview`
- input audio: raw 16-bit PCM, 16kHz, mono, little-endian
- output audio: raw 16-bit PCM, 24kHz, mono, little-endian
- send cadence: 100ms audio chunks
- translation config: `targetLanguageCode` with optional `echoTargetLanguage`
- supported languages include `uz` for Uzbek
- ephemeral tokens must use the `v1alpha` constrained WebSocket endpoint

## Architecture

1. The user opens the side panel on a source tab.
2. The side panel asks the service worker to start a capture session.
3. The service worker creates the offscreen document if needed and requests a tab stream id.
4. The offscreen document converts the captured tab audio into 16kHz PCM chunks and streams them to Gemini Live Translate over WebSocket.
5. The token server provisions short-lived ephemeral tokens from your long-lived Gemini API key.
6. Translated 24kHz PCM audio is played back from the offscreen document and status messages are relayed back to the side panel.

## Files

- `manifest.json`: MV3 config, permissions, side panel, and offscreen setup
- `config.js`: shared model, audio, and endpoint constants
- `background.js`: service worker orchestration
- `sidepanel.html`, `sidepanel.css`, `sidepanel.js`: control surface
- `offscreen.html`, `offscreen.js`: hidden audio pipeline host and Gemini WebSocket client
- `server/token-server.mjs`: local ephemeral-token provisioning server using `@google/genai`
- `package.json`: local Node package metadata and SDK dependency

## Prerequisites

Before using the extension, make sure you have:

1. Chrome with Developer mode available in `chrome://extensions`
2. Node.js installed locally
3. A Gemini API key from Google AI Studio
4. The project dependency installed:

```powershell
cd C:\projects\polyglot-live
npm install
```

If you already ran setup in this folder, `@google/genai` should already be present under `node_modules`.

## Local auth setup

Open PowerShell in the project folder:

```powershell
cd C:\projects\polyglot-live
```

Then set your environment variables before starting the token server:

```powershell
$env:GEMINI_API_KEY="your-real-gemini-api-key"
$env:POLYGLOT_LIVE_SHARED_SECRET="optional-local-secret"
node .\server\token-server.mjs
```

If you want a fast local test, you can skip the shared secret and run:

```powershell
cd C:\projects\polyglot-live
$env:GEMINI_API_KEY="your-real-gemini-api-key"
node .\server\token-server.mjs
```

The side panel defaults to `http://127.0.0.1:8787/token`. The shared secret is something you choose locally; it is not registered with Gemini.

When the server starts successfully, it should print:

```text
polyglot-live token server listening at http://127.0.0.1:8787/token
polyglot-live readiness probe available at http://127.0.0.1:8787/status
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `C:\projects\polyglot-live`.
5. Open the side panel.
6. Leave the token endpoint as `http://127.0.0.1:8787/token` unless you changed the server host or port.
7. If you set `POLYGLOT_LIVE_SHARED_SECRET`, enter that exact same value in the side panel's shared secret field.

## Readiness check

Before pressing `Start`, click `Check readiness` in the `Auth` card.

If everything is healthy, you should see:

- `Ready: local token server reachable and Gemini token accepted.`
- the main status badge move to `READY`

If it fails, the panel should tell you whether the issue is:

- the local token server is not running
- the shared secret does not match
- Gemini token provisioning failed

The readiness check verifies the same token path that the offscreen Live session uses.

## Start translation

You now have two ways to launch translation on a page with embedded audio:

1. Open the side panel and click `Start`.
2. Right-click the page, audio element, or video element and choose `Translate this tab audio`.

The right-click flow uses the target language and pass-through audio preference currently saved in the side panel.

Recommended flow:

1. Start the local token server
2. Reload the unpacked extension
3. Open the side panel
4. Click `Check readiness`
5. Press `Start` only after the panel reports readiness

## Current working location

Use `C:\projects\polyglot-live` as the active project folder going forward. The original copy in `C:\Users\Jim\Documents\polyglot-live` may still exist from the initial scaffold, but the intended working copy is the one in `C:\projects\polyglot-live`.

## Debugging

Useful places to look while testing:

- Side panel console: inspect the side panel window
- Extension service worker console: open it from `chrome://extensions`
- Token server console: the PowerShell window running `node .\server\token-server.mjs`

Current background logs include messages such as:

- `[polyglot-live/background] installed`
- `[polyglot-live/background] rebuilding context menu`
- `[polyglot-live/background] preparing translation session`
- `[polyglot-live/background] tab capture stream acquired`

Current offscreen logs include messages such as:

- `[polyglot-live/offscreen] requesting ephemeral token`
- `[polyglot-live/offscreen] ephemeral token accepted`
- `[polyglot-live/offscreen] websocket open`
- `[polyglot-live/offscreen] setup complete`

## Next build steps

1. Harden transcript rendering so it accumulates conversation history instead of replacing the current line.
2. Add richer reconnect and session-resumption handling around `goAway` and websocket churn.
3. Move the shared-secret check to a stronger user auth scheme if this leaves local-only development.
4. Add packaging, logging controls, and extension options UX.
5. Add a clearer in-panel indicator for live WebSocket connected vs. token ready.
