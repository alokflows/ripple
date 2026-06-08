// VoiceBridge relay.
//
// One tiny process does two jobs:
//   1. Serves the phone web app (public/index.html) over HTTP.
//   2. Runs a WebSocket relay at /ws that pairs a phone with a desktop agent
//      using a short room code, then forwards text from phone -> desktop.
//
// There is intentionally no database and no persistence. Rooms live in memory
// only and disappear when both sides disconnect. Nothing typed by the user is
// ever written to disk by this server.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8080;
const HEARTBEAT_MS = 30_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// ---------------------------------------------------------------------------
// Static file serving for the phone web app.
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    if (urlPath === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    const requested = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    let filePath = path.join(PUBLIC_DIR, requested);

    // Prevent path traversal outside the public directory.
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    let body;
    try {
      body = await readFile(filePath);
    } catch {
      // Single-page fallback so unknown paths still load the app.
      filePath = path.join(PUBLIC_DIR, 'index.html');
      body = await readFile(filePath);
    }

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    console.error('[http] error', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

// ---------------------------------------------------------------------------
// WebSocket relay.
//
// rooms: Map<code, Map<ws, role>>  where role is 'phone' | 'desktop'.
// ---------------------------------------------------------------------------
const rooms = new Map();

const MAX_TEXT_LENGTH = 1_000_000; // ~150k words — effectively no limit for dictation
const ROOM_CODE_RE = /^[A-Za-z0-9]{3,12}$/;

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = new Map();
    rooms.set(code, room);
  }
  return room;
}

function presence(code) {
  const room = rooms.get(code) || new Map();
  let phones = 0;
  let desktops = 0;
  for (const role of room.values()) {
    if (role === 'phone') phones += 1;
    else if (role === 'desktop') desktops += 1;
  }
  return { phones, desktops };
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(code, payload, { exclude } = {}) {
  const room = rooms.get(code);
  if (!room) return;
  for (const ws of room.keys()) {
    if (ws !== exclude) send(ws, payload);
  }
}

function notifyPresence(code) {
  broadcast(code, { type: 'presence', ...presence(code) });
}

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const code = (params.get('room') || '').trim();
  const role = params.get('role') === 'desktop' ? 'desktop' : 'phone';

  if (!ROOM_CODE_RE.test(code)) {
    send(ws, { type: 'error', message: 'Invalid room code. Use 3-12 letters/numbers.' });
    ws.close();
    return;
  }

  ws.isAlive = true;
  ws.role = role;
  ws.code = code;

  const room = getRoom(code);
  room.set(ws, role);
  console.log(`[ws] ${role} joined room ${code} (phones/desktops:`, presence(code), ')');

  send(ws, { type: 'joined', role, room: code, ...presence(code) });
  notifyPresence(code);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: 'Malformed message (expected JSON).' });
      return;
    }

    if (msg.type === 'text') {
      const text = typeof msg.text === 'string' ? msg.text : '';
      if (!text) return;
      if (text.length > MAX_TEXT_LENGTH) {
        send(ws, { type: 'error', message: 'Text too long.' });
        return;
      }
      // Phone -> desktop(s). Desktop typically does not send text.
      const { desktops } = presence(code);
      broadcast(code, { type: 'text', text, mode: msg.mode || 'paste' }, { exclude: ws });
      // Acknowledge to the sender so the UI can confirm delivery.
      send(ws, { type: 'ack', delivered: desktops, length: text.length });
      return;
    }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong' });
      return;
    }
  });

  ws.on('close', () => {
    const r = rooms.get(code);
    if (r) {
      r.delete(ws);
      if (r.size === 0) rooms.delete(code);
      else notifyPresence(code);
    }
    console.log(`[ws] ${role} left room ${code}`);
  });

  ws.on('error', (err) => {
    console.error('[ws] socket error', err.message);
  });
});

// Heartbeat: drop sockets that stopped responding (mobile networks, sleep, etc.).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* socket already closing */
    }
  }
}, HEARTBEAT_MS);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`VoiceBridge relay listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint:        ws://localhost:${PORT}/ws`);
});
