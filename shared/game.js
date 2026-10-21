// Match rules. Pure logic, shared by the browser and the server.
import { penStats } from './pens.js';
import { simulate, isOnDesk } from './physics.js';

export const RULES = {
  shrinkStart: 6,   // after this many shots in a round the desk starts shrinking
  shrinkEvery: 2,   // then every N shots
  shrinkStep: 0.08,
  minScale: 0.44,
  turnSeconds: 30,  // online turn timer
};

// Desk clutter layouts. The pens start at x = ±150, so nothing sits there.
const LAYOUTS = [
  [{ kind: 'eraser', x: 0, y: 70, a: 0.4 }],
  [{ kind: 'sharpener', x: 0, y: -115, a: 0.2 }, { kind: 'sharpener', x: 0, y: 115, a: -0.3 }],
  [{ kind: 'ruler', x: 0, y: -150, a: 0.12 }, { kind: 'eraser', x: -10, y: 150, a: -0.3 }],
  [{ kind: 'eraser', x: -20, y: -70, a: 0.9 }, { kind: 'sharpener', x: 40, y: 85, a: 0.5 }],
  [{ kind: 'ruler', x: 0, y: 0, a: Math.PI / 2 - 0.25 }],
  [{ kind: 'sharpener', x: 0, y: 0, a: 0.6 }, { kind: 'eraser', x: -260, y: -170, a: 0.2 }, { kind: 'eraser', x: 260, y: 170, a: 0.2 }],
];

export function startObstacles(rng = Math.random) {
  const L = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
  const fy = rng() < 0.5 ? 1 : -1; // mirror top/bottom for variety
  return L.map((o) => ({ kind: o.kind, x: o.x, y: o.y * fy, a: +(o.a * fy).toFixed(4) }));
}

// Clutter that is still on the desk (the desk shrinking past it takes it away).
export function liveObstacles(m, scale = m.deskScale) {
  return (m.obstacles || []).filter((o) => isOnDesk(o.x, o.y, scale));
}

export function startBodies(rng = Math.random) {
  const j = () => rng() - 0.5;
  const flipA = rng() < 0.5 ? 0 : Math.PI;
  const flipB = rng() < 0.5 ? 0 : Math.PI;
  return [
    { x: -150 + j() * 40, y: j() * 60, a: j() * 0.5 + flipA, off: false },
    { x: 150 + j() * 40, y: j() * 60, a: j() * 0.5 + flipB, off: false },
  ];
}

/**
 * @param {object} o
 * @param {string[]} o.penIds
 * @param {number[]} [o.levels]
 * @param {number} [o.roundsToWin]
 * @param {number} [o.starter]
 * @param {boolean} [o.clutter]  put an eraser, sharpener or ruler on the desk
 */
export function createMatch(o) {
  const levels = o.levels || [1, 1];
  const m = {
    penIds: o.penIds.slice(),
    levels: levels.slice(),
    stats: o.penIds.map((id, i) => penStats(id, levels[i])),
    roundsToWin: Math.max(1, Math.min(5, o.roundsToWin || 2)),
    scores: [0, 0],
    round: 1,
    starter: o.starter ?? 0,
    turn: o.starter ?? 0,
    turnInRound: 0,
    deskScale: 1,
    bodies: startBodies(),
    roundOver: false,
    over: false,
    winner: -1,
    nextStarter: 0,
    shots: 0,
    clutter: !!o.clutter,
    obstacles: o.clutter ? startObstacles() : [],
  };
  return m;
}

// What the desk scale will be after the next shot (for AI and warnings).
export function nextShrink(m) {
  const t = m.turnInRound + 1;
  if (t >= RULES.shrinkStart && (t - RULES.shrinkStart) % RULES.shrinkEvery === 0 && m.deskScale > RULES.minScale) {
    return Math.max(RULES.minScale, +(m.deskScale - RULES.shrinkStep).toFixed(3));
  }
  return null;
}

export function snapshot(m) {
  return {
    penIds: m.penIds, levels: m.levels, roundsToWin: m.roundsToWin, scores: m.scores.slice(),
    round: m.round, starter: m.starter, turn: m.turn, turnInRound: m.turnInRound,
    deskScale: m.deskScale, bodies: m.bodies.map((b) => ({ ...b })), roundOver: m.roundOver,
    over: m.over, winner: m.winner, nextStarter: m.nextStarter, shots: m.shots,
    clutter: !!m.clutter, obstacles: (m.obstacles || []).map((o) => ({ ...o })),
  };
}

export function restore(s) {
  return { ...s, stats: s.penIds.map((id, i) => penStats(id, s.levels[i])), bodies: s.bodies.map((b) => ({ ...b })), scores: s.scores.slice(), obstacles: (s.obstacles || []).map((o) => ({ ...o })) };
}

export function sanitizeShot(shot) {
  const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
  let dx = num(shot && shot.dx), dy = num(shot && shot.dy);
  const n = Math.hypot(dx, dy);
  if (n < 1e-6) { dx = 1; dy = 0; } else { dx /= n; dy /= n; }
  return {
    lx: Math.max(-0.5, Math.min(0.5, num(shot && shot.lx))),
    dx, dy,
    power: Math.max(0, Math.min(1, num(shot && shot.power))),
  };
}

/**
 * Play a shot for `player`. Mutates the match and returns everything a client
 * needs to animate it.
 */
export function playShot(m, player, rawShot, opts = {}) {
  if (m.over || m.roundOver) throw new Error('round is over');
  if (player !== m.turn) throw new Error('not your turn');
  const shot = sanitizeShot(rawShot);
  const sim = simulate({
    bodies: m.bodies, stats: m.stats, deskScale: m.deskScale, obstacles: liveObstacles(m),
    shooter: player, shot, record: opts.record !== false,
  });
  m.bodies = sim.bodies;
  m.turnInRound++;
  m.shots++;

  const res = { shooter: player, shot, frames: sim.frames, events: sim.events, shrink: null, round: null, matchOver: false };
  let off = sim.off.slice();

  // the desk shrinks between turns
  if (!off[0] && !off[1]) {
    const t = m.turnInRound;
    if (t >= RULES.shrinkStart && (t - RULES.shrinkStart) % RULES.shrinkEvery === 0 && m.deskScale > RULES.minScale) {
      m.deskScale = Math.max(RULES.minScale, +(m.deskScale - RULES.shrinkStep).toFixed(3));
      res.shrink = m.deskScale;
      m.bodies.forEach((b, i) => {
        if (!b.off && !isOnDesk(b.x, b.y, m.deskScale)) {
          b.off = true; off[i] = true;
          res.events.push({ type: 'shrinkfall', pen: i, x: b.x, y: b.y, a: b.a });
        }
      });
    }
  }

  if (off[0] || off[1]) {
    let winner;
    if (off[0] && off[1]) winner = -1;   // both off: round is a draw, replay it
    else winner = off[0] ? 1 : 0;
    if (winner >= 0) m.scores[winner]++;
    m.roundOver = true;
    res.round = { winner, scores: m.scores.slice(), selfOut: winner >= 0 && winner !== player };
    if (winner >= 0 && m.scores[winner] >= m.roundsToWin) {
      m.over = true;
      m.winner = winner;
      res.matchOver = true;
    } else {
      m.nextStarter = winner >= 0 ? 1 - winner : 1 - m.starter;
    }
  } else {
    m.turn = 1 - player;
  }
  res.state = snapshot(m);
  return res;
}

export function startNextRound(m, rng) {
  if (m.over) return m;
  m.round++;
  m.starter = m.nextStarter;
  m.turn = m.starter;
  m.turnInRound = 0;
  m.deskScale = 1;
  m.bodies = startBodies(rng);
  if (m.clutter) m.obstacles = startObstacles(rng);
  m.roundOver = false;
  return m;
}
