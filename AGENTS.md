# polyglot-live

## OVERVIEW

Chrome Manifest V3 extension for real-time tab-audio translation. It captures browser-tab or microphone audio in an offscreen document, streams it to Google's Gemini Live Translate WebSocket API, and plays translated audio back through the side panel.

## STRUCTURE

```
manifest.json              Chrome extension manifest
background.js              Service worker / orchestration
sidepanel.html / sidepanel.js / sidepanel.css   Side panel UI
offscreen.html / offscreen.js / offscreen-audio-processor.js   Offscreen audio capture & playback
config.js                  Supported languages, model defaults, constants
server/token-server.mjs    Local Node server that mints Gemini ephemeral tokens
server/latin-dub.mjs       Latin-dub content-script helper (experimental)
latin-dub-content.js      YouTube content script injection
mic-permission.html/js     Microphone permission shim
demo/                      Demo video assets
```

## COMMANDS

```bash
node -c manifest.json       # Verify JSON is valid
node -c background.js     # Syntax-check service worker
node -c sidepanel.js      # Syntax-check side panel
node -c offscreen.js      # Syntax-check offscreen document
node -c server/token-server.mjs  # Syntax-check token server
node server/token-server.mjs     # Start local token server (requires GEMINI_API_KEY)
```

## SETUP

- Requires Node.js.
- Install the extension as an unpacked Chrome extension (`chrome://extensions` → Developer mode → Load unpacked → select this folder).
- Set `GEMINI_API_KEY` and run `node server/token-server.mjs`.
- In the side panel, confirm the token URL (`http://127.0.0.1:8787/token`), enter the shared secret if configured, and click `Check readiness`.
- Select input source (`Tab audio` or `Microphone`) and a target language, then start.

## CODE STYLE

- Vanilla JavaScript, ES modules in the service worker (`"type": "module"`).
- Keep manifest permissions minimal; new host permissions require extension reload.
- Audio format contract with Gemini: raw 16-bit PCM, 16 kHz mono input; 24 kHz mono output.

## DEPLOYMENT

No Dagger module or recognized deployment configuration was found. This is a local-developer / tester build loaded via Chrome's unpacked-extension flow; it is not published on the Chrome Web Store.
