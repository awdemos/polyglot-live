# Install polyglot-live From ZIP

These instructions are for a friend who received a `.zip` copy of `polyglot-live` and wants to run it locally in Chrome.

## What this is

`polyglot-live` is a Chrome extension that can:

- translate live browser tab audio
- translate live microphone input
- play back translated speech in real time
- show transcripts in a side panel
- generate browser-native back-translation for review
- generate local-AI metrics after a session
- record translated replay audio and export it

It uses Gemini Live Translate and a small local token server that runs on your computer.

## For testers

This ZIP is intended for local testing, not one-click store installation.

You are testing whether the extension can:

- start live translation from a browser tab or microphone
- show usable transcripts in the side panel
- generate comparison and metrics review after a session
- export replay audio and transcripts for review

Known expectations:

- you must keep the local token server running while testing
- Chrome internal pages such as `chrome://` cannot be used for tab-audio capture
- voice identity in translated audio is best-effort

## Before you start

You will need:

1. Google Chrome
2. Node.js installed on your computer
3. A Gemini API key from Google AI Studio

## Get a Gemini API key

To create a Gemini API key for free-tier testing:

1. Go to Google AI Studio and sign in with your Google account.
2. Accept the terms if this is your first time there.
3. Click the official `Get API key` or `API keys` entry in AI Studio.
4. Create a key in the default AI Studio project, or choose/import an existing Google Cloud project.
5. Copy the key and keep it private.

Important notes:

- as of June 23, 2026, Google's pricing page lists `gemini-3.5-live-translate-preview` as free on the free tier
- Google can change preview pricing later, so check the official Gemini pricing page from time to time
- even a free-tier key should be treated like a secret

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

This only confirms token access. It does not mean the live translation session has started yet.

## 7. Use Tab audio mode

To translate audio from a browser tab:

1. Open a normal website tab with audio
2. In the side panel, set `Input source` to `Tab audio`
3. Choose the target language
4. Start the source audio on that tab
5. Press `Start`

Wait for the side panel to show the live session is ready before judging startup timing.

Notes:

- this does not work on `chrome://` pages
- this does not work on the Chrome Web Store
- this does not work on other browser-internal pages

## 8. Use Microphone mode

To translate your live microphone input:

1. In the side panel, set `Input source` to `Microphone`
2. Click `Grant microphone access`
4. Allow microphone access when prompted
5. Choose the target language
6. Press `Start`

Important:

- microphone permission granted is not the same as translation-ready
- after `Start`, wait for the live session ready indicator before speaking for your test

## 9. Stop translation

To stop the active session:

1. Press `Stop`

## 10. Helpful features

The extension also supports:

- live transcripts
- comparison review tab
- local-AI metrics tab
- transcript export
- replay recording and MP3 export
- target language selection
- original audio mix control
- dark and light theme
- sticky preferences across reloads

## 11. What to test

If you are helping test the extension, these are the main things to try:

1. Confirm `Check readiness` succeeds while the local token server is running.
2. Test `Tab audio` on a normal website tab with audio.
3. Test `Microphone` mode after granting mic access.
4. Change the target language and confirm the session switches cleanly.
5. Confirm transcripts populate during the session.
6. After a session, open `Comparison` and confirm back-translation appears.
7. Open `Metrics` and confirm local-AI scoring appears.
8. Test replay recording, replay preview, and replay export.
9. Toggle dark/light theme and reload the extension to confirm settings persist.

## 12. What the side panel should look like

The side panel is organized into a few main areas:

1. `Translation Controls`
   Choose `Input source`, choose the target language, adjust original audio mix if needed, and use `Start` or `Stop`.

2. `Live Text`
   This contains the `Live`, `Comparison`, and `Metrics` workflow tabs.

3. `Utilities`
   This contains support sections such as `Auth`, `Audio Alignment`, and `Status`.

4. `Recording`
   This is where replay capture, replay preview, and replay export are handled.

## Troubleshooting

If something is not working, check these places:

- the PowerShell window running `node .\server\token-server.mjs`
- the extension service worker console in `chrome://extensions`
- the side panel DevTools console

Common issues:

- `Tab audio` will not work on `chrome://` pages, the Chrome Web Store, or other internal browser pages
- if the mic was allowed but translation does not begin, press `Start` and wait for the live session ready state
- if `Comparison` or `Metrics` do not work, Chrome built-in AI may not be available on that machine

## API key safety

Use safe practices:

- do keep your real Gemini API key only in the PowerShell session
- do not paste your API key into the extension UI
- do not hard-code the key in any file
- do not share the key in screenshots or messages

Pricing note:

- as of June 23, 2026, Google's pricing page lists `gemini-3.5-live-translate-preview` as free on the free tier
- that may change later if Google ends the preview or moves the model to paid billing
- testers should check the official Gemini pricing page from time to time instead of assuming the model will stay free

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
7. if using `Tab audio`, start source audio on a normal site tab
8. click `Start`
