// Pen Fight server: serves the web game, runs online matches, keeps world stats.
// Online shots are simulated here (same physics as the browser) and the
// recorded frames are sent to both players, so they always see the same thing.
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import Matter from 'matter-js';

globalThis.Matter = Matter;
const { createMatch, playShot, startNextRound, snapshot, RULES } = await import('../shared/game.js');
const { PENS } = await import('../shared/pens.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.get('/vendor/matter.min.js', (req, res) => res.sendFile(path.join(ROOT, 'node_modules/matter-js/build/matter.min.js')));

// ---------- world stats (saved to a JSON file) ----------
const emptyStats = () => ({
  visits: 0, players: {}, matches: { vsc: 0, two: 0, online: 0 },
  playMs: 0, siteMs: 0,
  vsc: { easy: [0, 0, 0], normal: [0, 0, 0], hard: [0, 0, 0] }, // won, lost, draws
  online: {}, // clientId -> { name, won, lost, played }
});
let stats = emptyStats();
try { stats = { ...emptyStats(), ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) }; } catch { /* first run */ }
let saveTimer = null;
function saveStats() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdir(DATA_DIR, { recursive: true }, () => fs.writeFile(STATS_FILE, JSON.stringify(stats), () => {}));
  }, 2000);
}
const cleanId = (s) => String(s || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Player';
const validPen = (id) => (PENS.some((p) => p.id === id) ? id : PENS[0].id);

app.post('/api/visit', (req, res) => {
  const id = cleanId(req.body.clientId);
  stats.visits++;
  if (id) stats.players[id] = 1;
  saveStats();
  res.json({ ok: true });
});

app.post('/api/report', (req, res) => {
  const b = req.body || {};
  const id = cleanId(b.clientId);
  if (id) stats.players[id] = 1;
  const ms = Math.max(0, Math.min(3600e3, +b.durationMs || 0));
  if (b.mode === 'vsc' || b.mode === 'two') {
    stats.matches[b.mode]++;
    stats.playMs += ms;
    if (b.mode === 'vsc' && stats.vsc[b.level]) {
      const idx = { won: 0, lost: 1, draw: 2 }[b.result];
      if (idx !== undefined) stats.vsc[b.level][idx]++;
    }
  }
  if (b.mode === 'site') stats.siteMs += Math.max(0, Math.min(600e3, +b.durationMs || 0));
  saveStats();
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  const pct = (a) => {
    const t = a[0] + a[1] + a[2];
    return t ? a.map((v) => Math.round((v / t) * 100)) : [0, 0, 0];
  };
  const all = ['easy', 'normal', 'hard'].reduce((s, k) => s.map((v, i) => v + stats.vsc[k][i]), [0, 0, 0]);
  res.json({
    players: Object.keys(stats.players).length,
    matches: stats.matches.vsc + stats.matches.two + stats.matches.online,
    visits: stats.visits,
    playMs: stats.playMs,
    siteMs: stats.siteMs,
    online: io.engine.clientsCount,
    vsc: { all: pct(all), easy: pct(stats.vsc.easy), normal: pct(stats.vsc.normal), hard: pct(stats.vsc.hard) },
  });
});

app.get('/api/leaderboard', (req, res) => {
  const list = Object.values(stats.online)
    .filter((p) => p.played > 0)
    .sort((a, b) => b.won - a.won || a.lost - b.lost)
    .slice(0, 25)
    .map((p) => ({ name: p.name, won: p.won, lost: p.lost, played: p.played }));
  res.json(list);
});

// ---------- online matches ----------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map(); // code -> room
let queue = [];          // sockets waiting for quick match

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function publicPlayers(room) {
  return room.players.map((p) => ({ name: p.name, pen: p.pen, connected: !!p.socket }));
}

function emitRoom(room, ev, data) { io.to(room.code).emit(ev, data); }

function clearTimers(room) {
  clearTimeout(room.turnTimer); room.turnTimer = null;
  clearTimeout(room.nextTimer); room.nextTimer = null;
}

function startTurnTimer(room, delayMs) {
  clearTimeout(room.turnTimer);
  room.turnDeadline = Date.now() + delayMs + RULES.turnSeconds * 1000;
  room.turnTimer = setTimeout(() => {
    // time is up: the turn passes with no shot
    if (!room.match || room.match.over || room.match.roundOver) return;
    doShot(room, room.match.turn, { lx: 0, dx: 1, dy: 0, power: 0 }, true);
  }, delayMs + RULES.turnSeconds * 1000);
}

function startMatch(room) {
  clearTimers(room);
  const starter = Math.random() < 0.5 ? 0 : 1;
  room.match = createMatch({ penIds: room.players.map((p) => p.pen), levels: [1, 1], roundsToWin: room.rounds, starter });
  room.startedAt = Date.now();
  room.rematch = [false, false];
  room.players.forEach((p, i) => p.socket && p.socket.emit('match:start', {
    code: room.code, you: i, players: publicPlayers(room), state: snapshot(room.match), turnSeconds: RULES.turnSeconds,
  }));
  startTurnTimer(room, 1500);
  emitRoom(room, 'turn', { turn: room.match.turn, deadline: room.turnDeadline, now: Date.now() });
}

function doShot(room, player, shot, timeout = false) {
  const m = room.match;
  let res;
  try { res = playShot(m, player, shot); } catch { return; }
  clearTimeout(room.turnTimer);
  const animMs = Math.round((res.frames.length / 60) * 1000) + (res.shrink ? 900 : 0);
  emitRoom(room, 'shot', { ...res, timeout });
  if (res.matchOver) {
    finishMatch(room, m.winner);
  } else if (res.round) {
    room.nextTimer = setTimeout(() => {
      startNextRound(m);
      emitRoom(room, 'round:start', { state: snapshot(m) });
      startTurnTimer(room, 1200);
      emitRoom(room, 'turn', { turn: m.turn, deadline: room.turnDeadline, now: Date.now() });
    }, animMs + 2800);
  } else {
    startTurnTimer(room, animMs + 300);
    emitRoom(room, 'turn', { turn: m.turn, deadline: room.turnDeadline, now: Date.now() });
  }
}

function finishMatch(room, winner, reason = 'normal') {
  clearTimers(room);
  if (room.recorded) return;
  room.recorded = true;
  stats.matches.online++;
  stats.playMs += Date.now() - (room.startedAt || Date.now());
  room.players.forEach((p, i) => {
    if (!p.clientId) return;
    const rec = (stats.online[p.clientId] ||= { name: p.name, won: 0, lost: 0, played: 0 });
    rec.name = p.name;
    rec.played++;
    if (i === winner) rec.won++; else rec.lost++;
  });
  saveStats();
  if (reason !== 'normal') emitRoom(room, 'match:end', { winner, reason, scores: room.match ? room.match.scores : [0, 0] });
}

function leaveRoom(socket, reason = 'left') {
  const room = rooms.get(socket.data.room);
  socket.data.room = null;
  if (!room) return;
  socket.leave(room.code);
  const idx = room.players.findIndex((p) => p.socket === socket);
  if (idx < 0) return;
  const m = room.match;
  if (m && !m.over && !room.recorded) {
    m.over = true; m.winner = 1 - idx;
    finishMatch(room, 1 - idx, reason);
  }
  room.players.splice(idx, 1);
  clearTimers(room);
  if (room.players.length === 0) { rooms.delete(room.code); return; }
  room.match = null;
  room.recorded = false;
  emitRoom(room, 'opponent:left', { reason });
  room.players[0].socket && room.players[0].socket.emit('room:waiting', { code: room.code, players: publicPlayers(room) });
}

function joinRoom(socket, room, info) {
  room.players.push({ socket, name: cleanName(info.name), pen: validPen(info.pen), clientId: cleanId(info.clientId) });
  socket.data.room = room.code;
  socket.join(room.code);
}

io.on('connection', (socket) => {
  socket.data.room = null;

  socket.on('room:create', (info = {}, ack) => {
    leaveRoom(socket);
    queue = queue.filter((s) => s !== socket);
    const room = { code: makeCode(), players: [], rounds: Math.max(1, Math.min(3, +info.rounds || 2)), match: null, private: true };
    rooms.set(room.code, room);
    joinRoom(socket, room, info);
    ack && ack({ ok: true, code: room.code });
  });

  socket.on('room:join', (info = {}, ack) => {
    const code = String(info.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: 'not_found' });
    if (room.players.some((p) => p.socket === socket)) return ack && ack({ ok: true, code });
    if (room.players.length >= 2) return ack && ack({ ok: false, error: 'full' });
    leaveRoom(socket);
    queue = queue.filter((s) => s !== socket);
    joinRoom(socket, room, info);
    ack && ack({ ok: true, code });
    startMatch(room);
  });

  socket.on('quick', (info = {}, ack) => {
    leaveRoom(socket);
    queue = queue.filter((s) => s !== socket && s.connected);
    socket.data.info = info;
    const other = queue.shift();
    if (other) {
      const room = { code: makeCode(), players: [], rounds: 2, match: null, private: false };
      rooms.set(room.code, room);
      joinRoom(other, room, other.data.info || {});
      joinRoom(socket, room, info);
      ack && ack({ ok: true, matched: true });
      startMatch(room);
    } else {
      queue.push(socket);
      ack && ack({ ok: true, matched: false });
    }
  });

  socket.on('quick:cancel', () => { queue = queue.filter((s) => s !== socket); });

  socket.on('shot', (shot) => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.match) return;
    const idx = room.players.findIndex((p) => p.socket === socket);
    if (idx !== room.match.turn) return;
    doShot(room, idx, shot);
  });

  // live aim so the other player can watch the pull
  socket.on('aim', (a) => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.match) return;
    const idx = room.players.findIndex((p) => p.socket === socket);
    if (idx !== room.match.turn) return;
    socket.to(room.code).emit('aim', a && typeof a === 'object' ? {
      lx: +a.lx || 0, dx: +a.dx || 0, dy: +a.dy || 0, power: +a.power || 0, on: !!a.on,
    } : { on: false });
  });

  socket.on('emote', (e) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const idx = room.players.findIndex((p) => p.socket === socket);
    const ok = ['👍', '😂', '😮', '😡', '🔥', '👏'];
    if (ok.includes(e)) socket.to(room.code).emit('emote', { from: idx, e });
  });

  socket.on('rematch', () => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.match || !room.match.over || room.players.length < 2) return;
    const idx = room.players.findIndex((p) => p.socket === socket);
    room.rematch[idx] = true;
    emitRoom(room, 'rematch', { ready: room.rematch });
    if (room.rematch[0] && room.rematch[1]) { room.recorded = false; startMatch(room); }
  });

  socket.on('leave', () => { queue = queue.filter((s) => s !== socket); leaveRoom(socket); });

  socket.on('disconnect', () => {
    queue = queue.filter((s) => s !== socket);
    leaveRoom(socket, 'disconnect');
  });
});

server.listen(PORT, () => console.log(`Pen Fight running on http://localhost:${PORT}`));
