// Computer player. It tries many shots in a headless copy of the physics,
// scores where everything ends up, and picks a good one. Higher levels also
// check that the shot still works when it is a little off, and (hard) what the
// other player could do back. Lower levels try fewer shots and aim worse.
import { simulate, edgeDistance, deskHalf } from '/shared/physics.js';
import { nextShrink, liveObstacles } from '/shared/game.js';

// robust: noisy re-tests per finalist, reply: shots tried for the other player
const LEVELS = {
  easy: { tries: 14, angleNoise: 0.2, powerNoise: 0.28, pickTop: 0.5, refine: 0, care: 0.4, finalists: 0, robust: 0, reply: 0 },
  normal: { tries: 70, angleNoise: 0.03, powerNoise: 0.05, pickTop: 0, refine: 24, care: 1, finalists: 4, robust: 3, reply: 0 },
  hard: { tries: 130, angleNoise: 0.008, powerNoise: 0.015, pickTop: 0, refine: 40, care: 1, finalists: 6, robust: 4, reply: 14 },
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
  if (r < 0.3) {
    // straight at them, hard
    const d = toward + gauss() * 0.08;
    return { lx: (Math.random() - 0.5) * 0.6, dx: Math.cos(d), dy: Math.sin(d), power: 0.7 + Math.random() * 0.3 };
  }
  const dir = r < 0.8 ? toward + gauss() * 0.35 : Math.random() * Math.PI * 2; // go for them, or reposition
  return {
    lx: (Math.random() - 0.5) * 0.9,
    dx: Math.cos(dir), dy: Math.sin(dir),
    power: 0.3 + Math.random() * 0.7,
  };
}

const jitter = (s, an, pn) => {
  const ang = Math.atan2(s.dy, s.dx) + gauss() * an;
  return {
    lx: Math.max(-0.5, Math.min(0.5, s.lx + gauss() * an * 0.5)),
    dx: Math.cos(ang), dy: Math.sin(ang),
    power: Math.max(0.12, Math.min(1, s.power * (1 + gauss() * pn))),
  };
};

function evalShot(m, me, shot, cfg, keep) {
  const sim = simulate({ bodies: m.bodies, stats: m.stats, deskScale: m.deskScale, obstacles: liveObstacles(m), shooter: me, shot, record: false, maxSteps: 900 });
  // the desk may shrink right after this shot
  const ns = nextShrink(m);
  let score = scoreResult(sim, me, m.deskScale, cfg.care);
  if (ns && !sim.off[0] && !sim.off[1]) {
    const myE = edgeDistance(sim.bodies[me].x, sim.bodies[me].y, ns);
    const opE = edgeDistance(sim.bodies[1 - me].x, sim.bodies[1 - me].y, ns);
    if (myE < 0 && opE >= 0) score -= 900 * cfg.care;
    else if (opE < 0 && myE >= 0) score += 800;
  }
  if (keep) keep.sim = sim;
  return score;
}

// best the other player can do from where this shot leaves the pens (0..1, 1 = they knock us off)
function replyThreat(m, me, sim, tries) {
  const op = 1 - me;
  const pos = { bodies: sim.bodies, stats: m.stats, deskScale: nextShrink(m) || m.deskScale };
  const obstacles = liveObstacles(m, pos.deskScale);
  let best = 0;
  for (let i = 0; i < tries; i++) {
    const r = simulate({ bodies: pos.bodies, stats: pos.stats, deskScale: pos.deskScale, obstacles, shooter: op, shot: randomShot(pos, op), record: false, maxSteps: 700 });
    if (r.off[me] && !r.off[op]) return 1;
    if (!r.off[op]) {
      const e = edgeDistance(r.bodies[me].x, r.bodies[me].y, pos.deskScale) / deskHalf(pos.deskScale).hh;
      best = Math.max(best, 0.5 * (1 - Math.min(1, e)));
    }
  }
  return best;
}

/** Pick a shot for player `me`. Runs in small slices so the page stays smooth. */
export async function chooseShot(m, me, level = 'normal') {
  const cfg = LEVELS[level] || LEVELS.normal;
  const results = [];
  let t0 = performance.now();
  const breathe = async () => { if (performance.now() - t0 > 8) { await yieldFrame(); t0 = performance.now(); } };
  for (let i = 0; i < cfg.tries; i++) {
    const shot = randomShot(m, me);
    results.push({ shot, score: evalShot(m, me, shot, cfg) });
    await breathe();
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
    if (score > best.score) { best = { shot, score }; results.unshift(best); }
    await breathe();
  }
  if (cfg.pickTop > 0) {
    const n = Math.max(1, Math.floor(results.length * cfg.pickTop));
    best = results[Math.floor(Math.random() * n)];
  } else if (cfg.finalists > 0) {
    // keep shots that still work when slightly off, and (hard) leave nothing easy for the other player
    const an = Math.max(0.02, cfg.angleNoise * 2), pn = Math.max(0.04, cfg.powerNoise * 2);
    let top = -Infinity;
    for (const f of results.slice(0, cfg.finalists)) {
      let sum = f.score;
      for (let k = 0; k < cfg.robust; k++) { sum += evalShot(m, me, jitter(f.shot, an, pn), cfg); await breathe(); }
      let v = sum / (cfg.robust + 1);
      if (cfg.reply && f.score > -300 && f.score < 1000) {
        const keep = {};
        evalShot(m, me, f.shot, cfg, keep);
        v -= replyThreat(m, me, keep.sim, cfg.reply) * 500;
        await breathe();
      }
      if (v > top) { top = v; best = f; }
    }
  }
  // human-like mistakes
  return jitter(best.shot, cfg.angleNoise, cfg.powerNoise);
}
