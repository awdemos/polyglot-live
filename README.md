# polyglot-live

`polyglot-live` is a Chrome Manifest V3 extension for real-time tab-audio translation with:

- a side panel for controls and live status
- a readiness check that verifies local token provisioning before live start
- a right-click context menu entry for opening the side panel on the current page
- a service worker for orchestration
- an offscreen document for audio capture and playback
- a real Gemini Live Translate WebSocket client
- a local ephemeral-token server powered by Google's official `@google/genai` SDK

## Current status

This repo now includes a real Live Translate WebSocket transport and a working local token provisioning server. It is still a developer build, so you will need to run the token server locally and provide a Gemini API key through environment variables.

The current build matches the documented Gemini Live Translate contract more closely and is working as a local developer build:

- model: `gemini-3.5-live-translate-preview`
- input audio: raw 16-bit PCM, 16kHz, mono, little-endian
- output audio: raw 16-bit PCM, 24kHz, mono, little-endian
- send cadence: 100ms audio chunks
- translation target is selectable in the side panel and persists across sessions
- ephemeral tokens must use the `v1alpha` constrained WebSocket endpoint

Current UI capabilities:

- manual start only: nothing auto-starts
- `Start` begins translated-only audio playback
- target language is selected from a sticky dropdown and restored on reload
- the dropdown is populated from the current Gemini Live Translate supported-language list
- `Original` and translated live text panes are collapsible
- both text panes are stacked vertically, full width, and resizable
- live text panes show dialogue-only transcript content
- translated text uses an approximate active-word highlight driven by translated audio timing
- translated voice rendering should be treated as best-effort, especially for multi-speaker audio

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
4. The project dependency installed from the repo root:

```powershell
cd <repo-root>
npm install
```

If you already ran setup in this folder, `@google/genai` should already be present under `node_modules`.

## Local auth setup

Open PowerShell in the repo root:

```powershell
cd <repo-root>
```

## Start the local token server

Use this exact startup sequence in PowerShell:

```powershell
cd <repo-root>
$env:GEMINI_API_KEY="your-real-gemini-api-key"
$env:POLYGLOT_LIVE_SHARED_SECRET="your-local-secret"
node .\server\token-server.mjs
```

Expected server output:

```text
polyglot-live token server listening at http://127.0.0.1:8787/token
polyglot-live readiness probe available at http://127.0.0.1:8787/status
```

Then use these same values in the side panel:

- `Token endpoint`: `http://127.0.0.1:8787/token`
- `Shared secret`: the exact same value you used in `POLYGLOT_LIVE_SHARED_SECRET`

Notes:

- `GEMINI_API_KEY` is your real Google AI Studio API key
- `POLYGLOT_LIVE_SHARED_SECRET` is just a local secret you choose yourself
- the shared secret is not registered with Gemini; it only protects your local token server

## API key safety

Use your Gemini API key only on the local token server side.

Safe practices for this repo:

- do keep `GEMINI_API_KEY` in an environment variable
- do keep the key out of `README.md`, source files, screenshots, and chat messages
- do keep the key out of the Chrome side panel; the extension should talk only to your local token server
- do keep `node_modules/` and other local-only files out of git; `.gitignore` already excludes them
- do rotate the key in Google AI Studio if you think it was pasted somewhere unsafe
- do use a temporary PowerShell session variable when possible

Do not:

- do not hard-code the key in `background.js`, `offscreen.js`, `config.js`, or any extension file
- do not commit the key to git, even in a private repo
- do not store the real key in Chrome extension storage
- do not share the real key in screenshots or copied terminal history

Recommended local pattern for a single PowerShell session:

```powershell
$env:GEMINI_API_KEY="your-real-gemini-api-key"
$env:POLYGLOT_LIVE_SHARED_SECRET="optional-local-secret"
node .\server\token-server.mjs
```

That keeps the key in the current shell session only. Closing that shell drops the value.

If you want a persistent Windows environment variable, use `setx`, but treat that as less private because it stays on the machine after the shell closes:

```powershell
setx GEMINI_API_KEY "your-real-gemini-api-key"
```

After using `setx`, open a new PowerShell window before starting the token server.

Then set your environment variables before starting the token server:

```powershell
$env:GEMINI_API_KEY="your-real-gemini-api-key"
$env:POLYGLOT_LIVE_SHARED_SECRET="optional-local-secret"
node .\server\token-server.mjs
```

If you want a fast local test, you can skip the shared secret and run:

```powershell
cd <repo-root>
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
4. Select this repo checkout folder.
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

Important current behavior:

- the side panel does not auto-start translation
- the right-click menu opens the side panel but does not start translation
- the side panel remembers the last selected target language
- the extension currently plays translated audio only
- `Stop` shuts down the current offscreen Gemini session before restart

Recommended flow:

1. Start the local token server
2. Reload the unpacked extension
3. Start the source audio
4. Open the side panel
5. Click `Check readiness`
6. Press `Start` only after the panel reports readiness

The token server validates the selected language against the shared supported-language list before provisioning the ephemeral token.

## Voice behavior limits

Gemini Live Translate currently handles translated voices on a best-effort basis.

Important current limits from the Google documentation:

- voice replication can shift after long pauses
- the model can assign the wrong gender based on how speech begins
- rapid multi-speaker conversations can collapse onto a single translated voice

So while a male/female two-speaker source may sometimes sound distinct in the translated output, this should not be treated as a guaranteed feature of the current Live Translate pipeline.

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
- `[polyglot-live/background] stop requested`

Current offscreen logs include messages such as:

- `[polyglot-live/offscreen] requesting ephemeral token`
- `[polyglot-live/offscreen] ephemeral token accepted`
- `[polyglot-live/offscreen] websocket open`
- `[polyglot-live/offscreen] setup complete`
- translated audio packet receipts and active session close messages

## Next build steps

1. Improve approximate translated-word timing so the highlight tracks speech more naturally.
2. Add richer reconnect and session-resumption handling around `goAway` and websocket churn.
3. Consider a searchable language picker now that the dropdown includes the full supported list.
4. Move the shared-secret check to a stronger user auth scheme if this leaves local-only development.
5. Add packaging, logging controls, and extension options UX.
