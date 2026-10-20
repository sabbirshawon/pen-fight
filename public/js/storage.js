// Local progress and settings (saved on this device).
import { PENS, levelFromWins } from '/shared/pens.js';

const KEY = 'penfight.v1';

const defaults = () => ({
  clientId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()),
  name: '',
  guest: 'Player ' + (1000 + Math.floor(Math.random() * 9000)),
  name2: '',
  pen: 'ballpoint',
  pen2: 'gel',
  level: 'normal',
  rounds: 2,
  equal: true,
  mirror: false,
  settings: {
    theme: 'system', lang: (navigator.language || '').startsWith('bn') ? 'bn' : 'en',
    desk: 'clean', look: 'real', aim: true, sound: true, reduceMotion: false, vibration: true, autoNext: false,
  },
  vsc: {
    played: 0, won: 0, lost: 0, streak: 0, best: 0, timeMs: 0, fastestWin: 0, longest: 0, rounds: 0,
    byLevel: { easy: { p: 0, w: 0, ms: 0 }, normal: { p: 0, w: 0, ms: 0 }, hard: { p: 0, w: 0, ms: 0 } },
    byPen: {},
  },
  two: { played: 0, timeMs: 0, longest: 0, history: [] },
  online: { played: 0, won: 0, lost: 0, streak: 0, best: 0, timeMs: 0 },
  tutorialSeen: false,
});

function merge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  for (const k of Object.keys(extra)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = merge(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}

let data = defaults();
try { data = merge(defaults(), JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { /* storage blocked */ }

export const store = {
  get data() { return data; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ } },
  set(k, v) { data[k] = v; this.save(); },
  setting(k, v) {
    if (v === undefined) return data.settings[k];
    data.settings[k] = v; this.save();
    return v;
  },
  penLevel(id) {
    const r = data.vsc.byPen[id];
    return levelFromWins(r ? r.w : 0);
  },
  recordVsc({ won, level, pen, ms, rounds }) {
    const s = data.vsc;
    s.played++; s.timeMs += ms; s.rounds += rounds || 0;
    if (won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); if (!s.fastestWin || ms < s.fastestWin) s.fastestWin = ms; }
    else { s.lost++; s.streak = 0; }
    s.longest = Math.max(s.longest, ms);
    const l = s.byLevel[level]; l.p++; if (won) l.w++; l.ms += ms;
    const p = (s.byPen[pen] ||= { p: 0, w: 0 }); p.p++; if (won) p.w++;
    this.save();
  },
  recordTwo({ names, scores, winner, ms, pens }) {
    const s = data.two;
    s.played++; s.timeMs += ms; s.longest = Math.max(s.longest, ms);
    s.history.unshift({ names, scores, winner, ms, pens, at: Date.now() });
    s.history = s.history.slice(0, 30);
    this.save();
  },
  recordOnline({ won, ms }) {
    const s = data.online;
    s.played++; s.timeMs += ms;
    if (won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); } else { s.lost++; s.streak = 0; }
    this.save();
  },
  exportCode() {
    const { clientId, ...rest } = data;
    return btoa(unescape(encodeURIComponent(JSON.stringify({ pf: 1, ...rest, clientId }))));
  },
  importCode(code) {
    const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!obj || obj.pf !== 1) throw new Error('bad code');
    delete obj.pf;
    data = merge(defaults(), obj);
    this.save();
  },
  reset() {
    const keep = { clientId: data.clientId, settings: data.settings, name: data.name };
    data = merge(defaults(), keep);
    this.save();
  },
};

export const ALL_PENS = PENS;
