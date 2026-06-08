# VoiceBridge

Speak or type on your phone → the text pastes at your computer's cursor.
Cross-platform (iOS, Android, any browser), minimal setup, **no API keys**.

It's the Wispr-Flow idea split across two devices: your phone is the
microphone + keyboard, your computer is where the words land.

```
 ┌──────────┐    text over WebSocket    ┌──────────┐   pastes at    ┌──────────┐
 │  Phone   │ ────────────────────────► │  Relay   │ ─────────────► │ Computer │
 │ web app  │      (pairing code)       │ (Node)   │   the cursor   │  agent   │
 └──────────┘                           └──────────┘                └──────────┘
   type or                              hosts the page              python agent.py
   hold-to-talk                         + forwards text             clipboard-pastes
```

## Why this design (and not Bluetooth)

Phone browsers can't reliably inject text into a desktop over Bluetooth, and
pairing arbitrary phones to PCs is fragile — the opposite of "minimal setup."
A web page + a tiny relay + a small desktop agent gives the same
"speak → appears at cursor" result, works on every device, and hosts for free.

## Transcription

Voice uses the **browser's built-in Web Speech API** — free, no key, online.
It works in Chrome/Edge/Android and recent iOS Safari. If voice isn't
supported, the text box always works. You can later swap in a higher-accuracy
cloud engine (OpenAI Whisper, Deepgram) — see *Upgrading transcription* below.

## Components

| Folder    | What it is                          | Runs on        |
|-----------|-------------------------------------|----------------|
| `server/` | Relay + phone web app (Node.js)     | a host or your PC |
| `agent/`  | Desktop agent that pastes (Python)  | your computer  |

## Quick start (all local, one machine + phone on same Wi-Fi)

1. **Start the relay**
   ```bash
   cd server
   npm install
   npm start            # serves http://localhost:8080
   ```

2. **Start the desktop agent** (in another terminal)
   ```bash
   cd agent
   pip install -r requirements.txt
   python agent.py --server ws://localhost:8080 --room DEMO
   ```
   > macOS: grant **Accessibility** permission to your terminal under
   > System Settings → Privacy & Security → Accessibility, or the paste
   > keystroke is silently ignored.

3. **Open the phone app.** On your phone's browser go to
   `http://<your-computer-ip>:8080` (find the IP with `ipconfig getifaddr en0`
   on macOS, `hostname -I` on Linux). Enter the same code: `DEMO`.

4. Put your cursor anywhere on the computer (a text field, an editor),
   then on the phone **type + Send** or **hold the mic and speak**.
   The words appear at the cursor.

## Hosting the relay for free (use it from anywhere)

The relay is a single stateless Node process — deploy it to any host that
supports WebSockets:

- **Render / Railway / Fly.io**: point at `server/`, build `npm install`,
  start `npm start`. They provide HTTPS, so the phone gets `wss://`
  automatically and the mic works (browsers require HTTPS for getUserMedia).
- Then phone → `https://your-app.onrender.com`, agent →
  `python agent.py --server wss://your-app.onrender.com --room ABCD`.

No database, no env vars required. `PORT` is read from the environment if set.

## Delivery modes (desktop agent)

- `--mode paste` (default): clipboard + Cmd/Ctrl+V. Fast, Unicode-safe,
  restores your previous clipboard afterward.
- `--mode type`: simulates keystrokes. Use it in apps that block paste.

## Security notes

- The pairing code is the only access control. Use a non-obvious code
  (e.g. `K7QF`) so a stranger can't guess your room and paste into your PC.
- The relay never writes anything to disk; rooms live in memory only.
- For production, run the relay behind HTTPS/WSS and consider rotating codes.

## Upgrading transcription (optional, needs a key)

The phone currently transcribes with the free browser engine. To use a
cloud engine for higher accuracy, record audio on the phone and POST it to a
transcription endpoint, then send the returned text over the same WebSocket.
Good options: OpenAI Whisper API, Deepgram, AssemblyAI. This is the only part
that would require an API key, and it's intentionally not wired up yet to keep
setup at zero.

## Roadmap ideas

- PWA install (add-to-home-screen) + offline shell
- QR code on the agent terminal that opens the phone app pre-paired
- Per-message "type vs paste" toggle in the phone UI
- Optional end-to-end encryption of the relayed text
