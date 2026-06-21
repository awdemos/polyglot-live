# Install polyglot-live From ZIP

These instructions are for a friend who received a `.zip` copy of `polyglot-live` and wants to run it locally in Chrome.

## What this is

`polyglot-live` is a Chrome extension that can:

- translate live browser tab audio
- translate live microphone input
- play back translated speech in real time
- show transcripts in a side panel

It uses Gemini Live Translate and a small local token server that runs on your computer.

## Before you start

You will need:

1. Google Chrome
2. Node.js installed on your computer
3. A Gemini API key from Google AI Studio

## 1. Unzip the project

Unzip the archive to a folder such as:

```text
C:\polyglot-live
```

## 2. Install the local dependency

Open PowerShell in the unzipped folder and run:

```powershell
cd C:\polyglot-live
npm install
```

This installs the local dependency used by the token server.

## 3. Start the local token server

In PowerShell, from the project folder, run:

```powershell
cd C:\polyglot-live
$env:GEMINI_API_KEY="your-real-gemini-api-key"
$env:POLYGLOT_LIVE_SHARED_SECRET="your-local-secret"
node .\server\token-server.mjs
```

Important:

- `GEMINI_API_KEY` is your real Gemini API key
- `POLYGLOT_LIVE_SHARED_SECRET` is just a local secret you choose yourself
- the shared secret is not registered with Gemini
- keep this PowerShell window open while using the extension

Expected output:

```text
polyglot-live token server listening at http://127.0.0.1:8787/token
polyglot-live readiness probe available at http://127.0.0.1:8787/status
```

## 4. Load the extension in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the unzipped `polyglot-live` folder

## 5. Open the side panel

1. Click the `polyglot-live` extension icon
2. Open the side panel

## 6. Configure Auth

In the `Auth` section of the side panel, use:

- `Token endpoint`: `http://127.0.0.1:8787/token`
- `Shared secret`: the exact same value you used in `POLYGLOT_LIVE_SHARED_SECRET`

Then click:

- `Check readiness`

If everything is working, you should see:

```text
Ready: local token server reachable and Gemini token accepted.
```

## 7. Use Tab audio mode

To translate audio from a browser tab:

1. Open a normal website tab with audio
2. In the side panel, set `Input source` to `Tab audio`
3. Choose the target language
4. Press `Start`

Notes:

- this does not work on `chrome://` pages
- this does not work on the Chrome Web Store
- this does not work on other browser-internal pages

## 8. Use Microphone mode

To translate your live microphone input:

1. In the side panel, set `Input source` to `Microphone`
2. Open the `Microphone Access` section
3. Click `Grant microphone access`
4. Allow microphone access when prompted
5. Choose the target language
6. Press `Start`

If microphone permission succeeds, the panel will show that the mic is ready.

## 9. Stop translation

To stop the active session:

1. Press `Stop`

## 10. Helpful features

The extension also supports:

- live transcripts
- transcript export
- replay recording
- target language selection
- original audio mix control
- dark and light theme

## Troubleshooting

If something is not working, check these places:

- the PowerShell window running `node .\server\token-server.mjs`
- the extension service worker console in `chrome://extensions`
- the side panel DevTools console

## API key safety

Use safe practices:

- do keep your real Gemini API key only in the PowerShell session
- do not paste your API key into the extension UI
- do not hard-code the key in any file
- do not share the key in screenshots or messages

## Quick start recap

```powershell
cd C:\polyglot-live
npm install
$env:GEMINI_API_KEY="your-real-gemini-api-key"
$env:POLYGLOT_LIVE_SHARED_SECRET="your-local-secret"
node .\server\token-server.mjs
```

Then in Chrome:

1. `chrome://extensions`
2. `Load unpacked`
3. open the side panel
4. fill in `Auth`
5. click `Check readiness`
6. choose `Tab audio` or `Microphone`
7. click `Start`
