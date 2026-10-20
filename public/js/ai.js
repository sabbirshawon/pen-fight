// Computer player. It tries many shots in a headless copy of the physics,
// scores where everything ends up, and picks a good one. Lower levels try
// fewer shots and aim worse.
import { simulate, edgeDistance, deskHalf } from '/shared/physics.js';
import { nextShrink } from '/shared/game.js';

const LEVELS = {
  easy: { tries: 14, angleNoise: 0.2, powerNoise: 0.28, pickTop: 0.5, refine: 0, care: 0.4 },
  normal: { tries: 42, angleNoise: 0.065, powerNoise: 0.1, pickTop: 0.15, refine: 8, care: 0.85 },
  hard: { tries: 90, angleNoise: 0.018, powerNoise: 0.035, pickTop: 0, refine: 24, care: 1 },
};

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

function scoreResult(sim, me, deskScale, care) {
  const op = 1 - me;
  const meOff = sim.off[me], opOff = sim.off[op];
  if (meOff && opOff) return -400;
  if (meOff) return -1000;
  if (opOff) return 1000 + edgeDistance(sim.bodies[me].x, sim.bodies[me].y, deskScale) * 0.5;
  const { hh } = deskHalf(deskScale);
  const myEdge = edgeDistance(sim.bodies[me].x, sim.bodies[me].y, deskScale) / hh;
  const opEdge = edgeDistance(sim.bodies[op].x, sim.bodies[op].y, deskScale) / hh;
  // push them toward the edge, keep yourself in the middle
  return (1 - opEdge) * 260 + Math.min(1, myEdge) * 160 * care - (myEdge < 0.2 ? 200 * care : 0);
}

function randomShot(m, me) {
  const a = m.bodies[me], b = m.bodies[1 - me];
  const toward = Math.atan2(b.y - a.y, b.x - a.x);
  const r = Math.random();
  let dir;
  if (r < 0.75) dir = toward + gauss() * 0.35;          // go for them
  else dir = Math.random() * Math.PI * 2;               // reposition
  return {
    lx: (Math.random() - 0.5) * 0.9,
    dx: Math.cos(dir), dy: Math.sin(dir),
    power: 0.3 + Math.random() * 0.7,
  };
}

function evalShot(m, me, shot, cfg) {
  const sim = simulate({ bodies: m.bodies, stats: m.stats, deskScale: m.deskScale, shooter: me, shot, record: false, maxSteps: 900 });
  // the desk may shrink right after this shot
  const ns = nextShrink(m);
  let score = scoreResult(sim, me, m.deskScale, cfg.care);
  if (ns && !sim.off[0] && !sim.off[1]) {
    const myE = edgeDistance(sim.bodies[me].x, sim.bodies[me].y, ns);
    const opE = edgeDistance(sim.bodies[1 - me].x, sim.bodies[1 - me].y, ns);
    if (myE < 0 && opE >= 0) score -= 900 * cfg.care;
    else if (opE < 0 && myE >= 0) score += 800;
  }
  return score;
}

/** Pick a shot for player `me`. Runs in small slices so the page stays smooth. */
export async function chooseShot(m, me, level = 'normal') {
  const cfg = LEVELS[level] || LEVELS.normal;
  const results = [];
  let t0 = performance.now();
  for (let i = 0; i < cfg.tries; i++) {
    const shot = randomShot(m, me);
    results.push({ shot, score: evalShot(m, me, shot, cfg) });
    if (performance.now() - t0 > 8) { await yieldFrame(); t0 = performance.now(); }
  }
  results.sort((a, b) => b.score - a.score);
  // refine around the best
  let best = results[0];
  for (let i = 0; i < cfg.refine; i++) {
    const s = best.shot;
    const ang = Math.atan2(s.dy, s.dx) + gauss() * 0.12;
    const shot = {
      lx: Math.max(-0.48, Math.min(0.48, s.lx + gauss() * 0.12)),
      dx: Math.cos(ang), dy: Math.sin(ang),
      power: Math.max(0.15, Math.min(1, s.power + gauss() * 0.12)),
    };
    const score = evalShot(m, me, shot, cfg);
    if (score > best.score) best = { shot, score };
    if (performance.now() - t0 > 8) { await yieldFrame(); t0 = performance.now(); }
  }
  if (cfg.pickTop > 0) {
    const n = Math.max(1, Math.floor(results.length * cfg.pickTop));
    best = results[Math.floor(Math.random() * n)];
  }
  // human-like mistakes
  const s = best.shot;
  const ang = Math.atan2(s.dy, s.dx) + gauss() * cfg.angleNoise;
  return {
    lx: Math.max(-0.5, Math.min(0.5, s.lx + gauss() * cfg.angleNoise * 0.5)),
    dx: Math.cos(ang), dy: Math.sin(ang),
    power: Math.max(0.12, Math.min(1, s.power * (1 + gauss() * cfg.powerNoise))),
  };
}
