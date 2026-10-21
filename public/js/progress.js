// Badges and daily challenges. Saved on this device, next to the stats.
import { PENS, MAX_LEVEL } from '/shared/pens.js';
import { store } from './storage.js';

const D = store.data;

// [id, emoji]. Names and descriptions live in i18n as ach_<id> / achd_<id>.
export const BADGES = [
  ['first_win', '🏆'], ['beat_easy', '🙂'], ['beat_normal', '😎'], ['beat_hard', '🤖'],
  ['flawless', '💎'], ['comeback', '🔄'], ['one_shot', '🎯'], ['trick', '🌀'],
  ['bank', '🧽'], ['tiny', '🏝️'], ['kamikaze', '💥'], ['streak5', '🔥'],
  ['online_win', '🌍'], ['all_pens', '🖊️'], ['max_level', '⭐'], ['daily3', '📅'],
  ['daily7', '🗓️'], ['matches50', '🎒'],
];

/*
 * ctx (from the match):
 *   mode: 'vsc' | 'two' | 'online', level, pen (your pen), clutter, roundsToWin
 *   won: true/false once the match is over, undefined after a round
 *   lostRounds, firstRoundLost, myShots
 *   flags: { trick, oneShot, bank, tiny, kamikaze } things you did this match
 */
const WON = (c) => c.won === true;
const CHECKS = {
  first_win: (c) => WON(c) && c.mode !== 'two',
  beat_easy: (c) => WON(c) && c.mode === 'vsc' && c.level === 'easy',
  beat_normal: (c) => WON(c) && c.mode === 'vsc' && c.level === 'normal',
  beat_hard: (c) => WON(c) && c.mode === 'vsc' && c.level === 'hard',
  flawless: (c) => WON(c) && c.roundsToWin >= 2 && c.lostRounds === 0,
  comeback: (c) => WON(c) && c.firstRoundLost,
  one_shot: (c) => !!c.flags?.oneShot,
  trick: (c) => !!c.flags?.trick,
  bank: (c) => !!c.flags?.bank,
  tiny: (c) => !!c.flags?.tiny,
  kamikaze: (c) => !!c.flags?.kamikaze,
  streak5: () => D.vsc.best >= 5,
  online_win: (c) => WON(c) && c.mode === 'online',
  all_pens: () => PENS.every((p) => (D.vsc.byPen[p.id] || {}).w > 0),
  max_level: () => PENS.some((p) => store.penLevel(p.id) >= MAX_LEVEL),
  daily3: () => D.daily.total >= 3,
  daily7: () => D.daily.best >= 7,
  matches50: () => D.vsc.played + D.two.played + D.online.played >= 50,
};

// ---------- daily challenge ----------
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}
function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// The same challenge for everyone on the same day.
export function dailyFor(day = dayKey()) {
  const r = seeded('pen-fight:' + day);
  const kinds = ['beat', 'pen', 'fast', 'flawless', 'trick', 'oneShot', 'clutter', 'first3'];
  const k = kinds[Math.floor(r() * kinds.length)];
  const c = { day, k };
  if (k === 'beat') c.level = r() < 0.6 ? 'normal' : 'hard';
  if (k === 'pen') c.pen = PENS[Math.floor(r() * PENS.length)].id;
  if (k === 'fast') c.n = r() < 0.5 ? 6 : 8;
  return c;
}

function dailyMet(ch, c) {
  if (c.mode === 'two') return false;
  switch (ch.k) {
    case 'beat': return WON(c) && c.mode === 'vsc' && c.level === ch.level;
    case 'pen': return WON(c) && c.pen === ch.pen;
    case 'fast': return WON(c) && c.myShots <= ch.n;
    case 'flawless': return CHECKS.flawless(c);
    case 'trick': return !!c.flags?.trick;
    case 'oneShot': return !!c.flags?.oneShot;
    case 'clutter': return WON(c) && c.clutter;
    case 'first3': return WON(c) && c.roundsToWin >= 3;
    default: return false;
  }
}

export function dailyDone(day = dayKey()) { return D.daily.last === day; }

// Streak only counts if yesterday (or today) was finished too.
export function dailyStreak(day = dayKey()) {
  return D.daily.last === day || D.daily.last === prevDay(day) ? D.daily.streak : 0;
}

/**
 * Check everything after a round or a match.
 * Returns { badges: [ids just earned], daily: challenge or null if just finished }.
 */
export function evaluate(c) {
  const out = { badges: [], daily: null };
  const day = dayKey();
  if (!dailyDone(day)) {
    const ch = dailyFor(day);
    if (dailyMet(ch, c)) {
      const d = D.daily;
      d.streak = d.last === prevDay(day) ? d.streak + 1 : 1;
      d.best = Math.max(d.best, d.streak);
      d.total++;
      d.last = day;
      if (c.pen) store.addPenBonus(c.pen);
      out.daily = ch;
    }
  }
  for (const [id] of BADGES) {
    if (D.ach[id] || !CHECKS[id](c)) continue;
    D.ach[id] = Date.now();
    out.badges.push(id);
  }
  store.save();
  return out;
}

export const badgeIcon = (id) => (BADGES.find((b) => b[0] === id) || [])[1] || '🏅';
