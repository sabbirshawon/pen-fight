import Matter from 'matter-js';
globalThis.Matter = Matter;
const { simulate } = await import('../shared/physics.js');
const { penStats, PENS } = await import('../shared/pens.js');
const { createMatch, playShot } = await import('../shared/game.js');

const stats = [penStats('ballpoint'), penStats('fountain')];
const far = [{ x: -400, y: -250, a: 0, off: false }, { x: 400, y: 250, a: 0, off: false }];
function run(label, shot, bodies = far, sh = 0) {
  const t = performance.now();
  const r = simulate({ bodies, stats, deskScale: 3, shooter: sh, shot, record: true });
  const b = r.bodies[sh];
  console.log(label.padEnd(26), 'dist', Math.hypot(b.x - bodies[sh].x, b.y - bodies[sh].y).toFixed(0).padStart(4),
    'rot', ((b.a - bodies[sh].a) * 180 / Math.PI).toFixed(0).padStart(5), 'frames', r.frames.length, 'ms', (performance.now() - t).toFixed(1));
}
run('side full, middle', { lx: 0, dx: 0, dy: 1, power: 1 });
run('side half, middle', { lx: 0, dx: 0, dy: 1, power: 0.5 });
run('side 0.2, middle', { lx: 0, dx: 0, dy: 1, power: 0.2 });
run('axial full', { lx: 0, dx: 1, dy: 0, power: 1 });
run('side full, tip', { lx: 0.5, dx: 0, dy: 1, power: 1 });
run('side 0.5, tip', { lx: 0.45, dx: 0, dy: 1, power: 0.5 });
// collision
const near = [{ x: -150, y: 0, a: Math.PI / 2, off: false }, { x: 150, y: 0, a: Math.PI / 2, off: false }];
const r = simulate({ bodies: near, stats, deskScale: 1, shooter: 0, shot: { lx: 0, dx: 1, dy: 0, power: 0.8 } });
console.log('hit test', JSON.stringify(r.bodies), r.events.map(e => e.type + '@' + e.f + (e.s ? ' s' + e.s : '')).join(', '));
// a full match with random shots
const m = createMatch({ penIds: ['ballpoint', 'marker'], roundsToWin: 2 });
let n = 0;
while (!m.over && n < 200) {
  const me = m.bodies[m.turn], op = m.bodies[1 - m.turn];
  const res = playShot(m, m.turn, { lx: Math.random() - 0.5, dx: op.x - me.x, dy: op.y - me.y, power: 0.4 + Math.random() * 0.6 });
  n++;
  if (res.round) { console.log('round', m.round, 'winner', res.round.winner, 'after', m.turnInRound, 'shots, desk', m.deskScale); if (!m.over) (await import('../shared/game.js')).startNextRound(m); }
}
console.log('match over', m.over, 'winner', m.winner, 'scores', m.scores, 'shots', n);
// desk clutter: a pen flicked straight at an eraser bounces back
{
  const ob = [{ kind: 'eraser', x: 0, y: 0, a: Math.PI / 2 }];
  const pens = [{ x: -150, y: 0, a: Math.PI / 2, off: false }, { x: 300, y: 200, a: 0, off: false }];
  const rb = simulate({ bodies: pens, stats, deskScale: 1, shooter: 0, shot: { lx: 0, dx: 1, dy: 0, power: 0.7 }, obstacles: ob });
  const bumps = rb.events.filter((e) => e.type === 'bump');
  console.log('clutter bounce', 'bumps', bumps.length, 'end x', rb.bodies[0].x, bumps.length && rb.bodies[0].x < -60 ? 'OK' : 'FAIL');
  const mc = createMatch({ penIds: ['ballpoint', 'gel'], clutter: true });
  console.log('clutter match', mc.obstacles.map((o) => o.kind).join(', '), mc.obstacles.length ? 'OK' : 'FAIL');
}
for (const pw of [0.3, 0.6, 1]) {
  const nb = [{ x: -40, y: 0, a: Math.PI / 2, off: false }, { x: 40, y: 0, a: Math.PI / 2, off: false }];
  const rr = simulate({ bodies: nb, stats, deskScale: 3, shooter: 0, shot: { lx: 0, dx: 1, dy: 0, power: pw } });
  console.log('close hit p' + pw, 'shooter', rr.bodies[0].x, 'target moved', (rr.bodies[1].x - 40).toFixed(0));
  const rt = simulate({ bodies: nb, stats, deskScale: 3, shooter: 0, shot: { lx: 0.4, dx: 1, dy: 0, power: pw } });
  console.log('   tip hit', 'target moved', Math.hypot(rt.bodies[1].x - 40, rt.bodies[1].y).toFixed(0), 'target rot', ((rt.bodies[1].a - Math.PI / 2) * 57).toFixed(0));
}
