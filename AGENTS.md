# polyglot-live — Agent Guide

## Overview

A Chrome extension for real-time browser-tab or microphone audio translation.
Uses the Chrome Manifest V3 extension model with a service worker, side panel,
offscreen audio pipeline, and a small local token server.

## Project Layout

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension manifest (MV3) |
| `background.js` | Service worker: tab capture, offscreen lifecycle, API routing |
| `sidepanel.html` / `sidepanel.js` | Side-panel UI (transcripts, controls) |
| `offscreen.html` / `offscreen.js` | Offscreen document for audio capture/processing |
| `mic-permission.html` / `mic-permission.js` | Microphone permission helper |
| `config.js` | Shared configuration / prompt templates |
| `latin-dub-content.js` | Latin-dub specific content rules |
| `demo/` | Demo assets |
| `INSTALL_FROM_ZIP.md` | Manual installation guide for testers |

## Install / Test

### Local unpacked install

```bash
# 1. Start the local token server (see INSTALL_FROM_ZIP.md for server path)
# 2. Open chrome://extensions
# 3. Enable Developer mode
# 4. Load unpacked → select this directory
# 5. Pin the extension and open the side panel
```

### Lint / sanity

```bash
# There is no build step; validate the manifest JSON
python3 -m json.tool manifest.json > /dev/null

# Optional: run a JS linter if available
npx eslint background.js sidepanel.js offscreen.js config.js || true
```

## Key Conventions

- **Manifest V3**: service worker background, no persistent page.
- **Offscreen API**: audio capture runs in an offscreen document because service
  workers cannot use `navigator.mediaDevices`.
- **Side panel**: declared in manifest; default path is `sidepanel.html`.
- **Host permissions**: includes `generativelanguage.googleapis.com` for Gemini
  Live Translate and `localhost` for the token server.
- **No build tooling**: plain JavaScript; edit files directly.

## Common Gotchas

- Chrome internal pages (`chrome://`) cannot be captured for tab audio.
- The extension needs a running local token server; it will not work standalone.
- Extension ID is pinned by the embedded `key` field in `manifest.json`.
- Load as unpacked in a regular Chrome profile, not an enterprise-managed one,
  unless the extension is force-installed.

## Deployment

Package as a `.zip` for sideloading:

```bash
zip -r polyglot-live.zip \
  manifest.json background.js sidepanel.html sidepanel.js \
  offscreen.html offscreen.js config.js latin-dub-content.js \
  mic-permission.html mic-permission.js icons/ demo/
```

Store publication is not configured; distribute the ZIP for local testing.
