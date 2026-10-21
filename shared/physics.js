// Pen Fight physics, built on Matter.js.
// Runs the same way in the browser (vs Computer, 2 players, AI planning)
// and on the server (online matches are simulated there and played back).
//
// A shot is simulated to the end in one go and recorded as frames, so all
// clients see exactly the same thing.

const M = globalThis.Matter;
if (!M) throw new Error('Matter.js must be loaded before physics.js');

export const DESK_W = 880;
export const DESK_H = 530;

const BASE_DT = 1000 / 60;   // Matter's velocity unit: px per 1/60 s
const SUB_DT = 1000 / 120;   // physics substep
const DT_R = SUB_DT / BASE_DT;
const RECORD_EVERY = 2;      // record one frame every 2 substeps = 60 fps
const MAX_STEPS = 1500;      // 12.5 s hard cap

// Feel tuning
export const TUNE = {
  maxSpeed: 13,     // launch speed at full power (px per 1/60 s)
  axial: 0.45,        // a push along the pen is this much weaker
  tipLinearLoss: 0.3, // grabbing a tip trades push for spin
  spin: 0.9,
  decAxial: 0.2,     // sliding friction along the pen
  decPerp: 0.13,     // rolling friction across the pen
  decAng: 0.0055,     // spin friction
  damp: 0.003,        // general drag per base step
  speedCap: 22,
  minPower: 0.05,
};

// Desk clutter: fixed objects the pens bounce off. Sizes in world units.
export const OBSTACLES = {
  eraser: { w: 66, h: 32, r: 7 },
  sharpener: { w: 34, h: 30, r: 5 },
  ruler: { w: 220, h: 20, r: 3 },
};

export function deskHalf(scale) {
  return { hw: (DESK_W / 2) * scale, hh: (DESK_H / 2) * scale };
}

export function isOnDesk(x, y, scale) {
  const { hw, hh } = deskHalf(scale);
  return Math.abs(x) <= hw && Math.abs(y) <= hh;
}

// Distance from a point to the nearest desk edge (negative = off).
export function edgeDistance(x, y, scale) {
  const { hw, hh } = deskHalf(scale);
  return Math.min(hw - Math.abs(x), hh - Math.abs(y));
}

function makeBody(p, st) {
  const r = st.wid / 2;
  const body = M.Bodies.rectangle(p.x, p.y, st.len, st.wid, {
    chamfer: { radius: [r * 0.95, r * 0.95, r * 0.95, r * 0.95], quality: 6 },
    density: 0.001 * st.density,
    restitution: Math.min(0.92, st.bounce + 0.3),
    friction: 0.08,
    frictionStatic: 0.2,
    frictionAir: 0,
    slop: 0.02,
    angle: p.a,
  });
  // weight depends on the pen, not on its area (a fat pen is not 3x heavier)
  M.Body.setMass(body, st.density * (st.len / 200));
  body.deltaTime = SUB_DT;
  return body;
}

// Velocity the shot gives the shooter pen.
// shot = { lx: -0.5..0.5 along the pen (0.5 = tip), dx, dy: direction, power: 0..1 }
export function shotVelocity(p, st, shot) {
  const power = Math.max(0, Math.min(1, +shot.power || 0));
  if (power < TUNE.minPower) return { vx: 0, vy: 0, w: 0 };
  let dx = +shot.dx || 0, dy = +shot.dy || 0;
  const n = Math.hypot(dx, dy) || 1;
  dx /= n; dy /= n;
  const lx = Math.max(-0.5, Math.min(0.5, +shot.lx || 0));
  const ux = Math.cos(p.a), uy = Math.sin(p.a);
  const along = dx * ux + dy * uy;
  // perpendicular part at full strength, axial part weakened
  const ex = dx - along * ux + along * ux * TUNE.axial;
  const ey = dy - along * uy + along * uy * TUNE.axial;
  const curve = Math.pow(power, 0.8);
  const v0 = TUNE.maxSpeed * st.power * curve;
  const tip = Math.abs(lx) * 2; // 0 middle .. 1 tip
  const lin = v0 * (1 - TUNE.tipLinearLoss * tip * tip);
  // rigid rod: w = 12 * v * r / L^2, r = lx * L, using the perpendicular part
  const cross = ux * ey - uy * ex;
  const w = TUNE.spin * 12 * v0 * cross * lx / st.len;
  return { vx: ex * lin, vy: ey * lin, w };
}

function applyFriction(body, st) {
  const v = M.Body.getVelocity(body);
  const a = body.angle;
  const ux = Math.cos(a), uy = Math.sin(a);
  let along = v.x * ux + v.y * uy;
  let perp = -v.x * uy + v.y * ux;
  const da = TUNE.decAxial * st.slide * DT_R;
  const dp = (TUNE.decPerp / st.roll) * DT_R;
  along = Math.sign(along) * Math.max(0, Math.abs(along) - da);
  perp = Math.sign(perp) * Math.max(0, Math.abs(perp) - dp);
  const k = 1 - TUNE.damp * DT_R;
  let vx = (along * ux - perp * uy) * k;
  let vy = (along * uy + perp * ux) * k;
  const sp = Math.hypot(vx, vy);
  if (sp > TUNE.speedCap) { vx *= TUNE.speedCap / sp; vy *= TUNE.speedCap / sp; }
  let w = M.Body.getAngularVelocity(body);
  w = Math.sign(w) * Math.max(0, Math.abs(w) - TUNE.decAng * DT_R) * (1 - 0.01 * DT_R);
  M.Body.setVelocity(body, { x: vx, y: vy });
  M.Body.setAngularVelocity(body, w);
}

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Simulate one shot until everything stops.
 * @param {object} o
 * @param {Array<{x,y,a,off}>} o.bodies  two pens
 * @param {Array} o.stats                 penStats() for both
 * @param {number} o.deskScale
 * @param {number} o.shooter              0 or 1
 * @param {object} o.shot
 * @param {boolean} [o.record=true]       record frames for playback
 * @param {number} [o.maxSteps]
 * @param {number} [o.stopOnHit]          stop at the first hit between pens (aim preview)
 * @param {Array<{kind,x,y,a}>} [o.obstacles]  desk clutter on the desk right now
 */
export function simulate(o) {
  const record = o.record !== false;
  const engine = M.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
    positionIterations: 10,
    velocityIterations: 8,
    enableSleeping: false,
  });
  const live = o.bodies.map((p, i) => (p.off ? null : makeBody(p, o.stats[i])));
  live.forEach((b) => b && M.Composite.add(engine.world, b));
  for (const ob of o.obstacles || []) {
    const k = OBSTACLES[ob.kind];
    if (!k) continue;
    M.Composite.add(engine.world, M.Bodies.rectangle(ob.x, ob.y, k.w, k.h, {
      isStatic: true, angle: ob.a || 0, chamfer: { radius: k.r }, restitution: 0.55, friction: 0.1, slop: 0.02,
    }));
  }

  const events = [];
  const frames = [];
  const off = o.bodies.map((p) => !!p.off);
  let substep = 0;
  let firstHit = -1;
  let lastHitFrame = -99;
  const lastBump = [-99, -99];

  // Matter.js barely bounces flat sides off each other, so the first contact
  // gets a proper rigid-rod impulse. It runs inside update (before Matter's
  // solver) and is applied once the update finishes.
  const statOf = new Map(live.map((b, i) => [b, o.stats[i]]));
  let overrides = [];
  const queueBounce = (a, b, pair, cx, cy) => {
    const sa = statOf.get(a), sb = statOf.get(b);
    if (!sa || !sb) return;
    let nx = pair.collision.normal.x, ny = pair.collision.normal.y;
    if ((b.position.x - a.position.x) * nx + (b.position.y - a.position.y) * ny < 0) { nx = -nx; ny = -ny; }
    const va = M.Body.getVelocity(a), vb = M.Body.getVelocity(b);
    const wa = M.Body.getAngularVelocity(a), wb = M.Body.getAngularVelocity(b);
    const rax = cx - a.position.x, ray = cy - a.position.y;
    const rbx = cx - b.position.x, rby = cy - b.position.y;
    // velocity of the contact point on each body
    const pax = va.x - wa * ray, pay = va.y + wa * rax;
    const pbx = vb.x - wb * rby, pby = vb.y + wb * rbx;
    const vn = (pax - pbx) * nx + (pay - pby) * ny;
    if (vn <= 0) return; // separating
    const ma = a.mass, mb = b.mass;
    const ia = (ma * sa.len * sa.len) / 12, ib = (mb * sb.len * sb.len) / 12;
    const rna = rax * ny - ray * nx, rnb = rbx * ny - rby * nx;
    const e = Math.min(0.92, (sa.bounce + sb.bounce) / 2 + 0.3);
    const j = ((1 + e) * vn) / (1 / ma + 1 / mb + (rna * rna) / ia + (rnb * rnb) / ib);
    overrides.push(
      [a, { x: va.x - (j * nx) / ma, y: va.y - (j * ny) / ma }, wa - (j * rna) / ia * 0.85],
      [b, { x: vb.x + (j * nx) / mb, y: vb.y + (j * ny) / mb }, wb + (j * rnb) / ib * 0.85],
    );
  };

  M.Events.on(engine, 'collisionStart', (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA.parent || pair.bodyA, b = pair.bodyB.parent || pair.bodyB;
      const va = M.Body.getVelocity(a), vb = M.Body.getVelocity(b);
      const s = Math.hypot(va.x - vb.x, va.y - vb.y);
      const sup = pair.collision && pair.collision.supports && pair.collision.supports[0];
      const x = sup ? sup.x : (a.position.x + b.position.x) / 2;
      const y = sup ? sup.y : (a.position.y + b.position.y) / 2;
      const f = Math.floor(substep / RECORD_EVERY);
      // a pen against desk clutter
      if (a.isStatic || b.isStatic) {
        const pen = live.indexOf(a.isStatic ? b : a);
        if (pen >= 0 && s > 0.6 && f - lastBump[pen] > 4) {
          events.push({ type: 'bump', pen, f, x: r2(x), y: r2(y), s: r2(s) });
          lastBump[pen] = f;
        }
        continue;
      }
      if (firstHit < 0) firstHit = f;
      queueBounce(a, b, pair, x, y);
      if (s > 0.6 && f - lastHitFrame > 4) {
        events.push({ type: 'hit', f, x: r2(x), y: r2(y), s: r2(s) });
        lastHitFrame = f;
      }
    }
  });

  // launch
  const sh = o.shooter;
  if (live[sh] && o.shot) {
    const v = shotVelocity(o.bodies[sh], o.stats[sh], o.shot);
    M.Body.setVelocity(live[sh], { x: v.vx, y: v.vy });
    M.Body.setAngularVelocity(live[sh], v.w);
  }

  const pushFrame = () => {
    const fr = [];
    for (let i = 0; i < 2; i++) {
      const b = live[i];
      if (b) fr.push(r2(b.position.x), r2(b.position.y), r4(b.angle));
      else fr.push(null, null, null);
    }
    frames.push(fr);
  };
  if (record) pushFrame();

  const maxSteps = o.maxSteps || MAX_STEPS;
  let still = 0;
  const path = o.trackPath ? [] : null;
  while (substep < maxSteps) {
    for (let i = 0; i < 2; i++) if (live[i]) applyFriction(live[i], o.stats[i]);
    M.Engine.update(engine, SUB_DT);
    substep++;
    if (overrides.length) {
      for (const [b, v, w] of overrides) { M.Body.setVelocity(b, v); M.Body.setAngularVelocity(b, w); }
      overrides = [];
    }

    // falling off the desk
    for (let i = 0; i < 2; i++) {
      const b = live[i];
      if (!b) continue;
      if (!isOnDesk(b.position.x, b.position.y, o.deskScale)) {
        const v = M.Body.getVelocity(b);
        events.push({
          type: 'fall', pen: i, f: Math.floor(substep / RECORD_EVERY),
          x: r2(b.position.x), y: r2(b.position.y), a: r4(b.angle),
          vx: r2(v.x), vy: r2(v.y), w: r4(M.Body.getAngularVelocity(b)),
        });
        off[i] = true;
        M.Composite.remove(engine.world, b);
        live[i] = null;
      }
    }

    if (record && substep % RECORD_EVERY === 0) pushFrame();
    if (path && substep % 6 === 0 && live[sh]) path.push([r2(live[sh].position.x), r2(live[sh].position.y), r4(live[sh].angle)]);
    if (o.stopOnHit && firstHit >= 0) break;

    let moving = false;
    for (const b of live) {
      if (!b) continue;
      if (M.Body.getSpeed(b) > 0.03 || Math.abs(M.Body.getAngularVelocity(b)) > 0.0015) { moving = true; break; }
    }
    still = moving ? 0 : still + 1;
    if (still > 6) break;
  }
  if (record && substep % RECORD_EVERY !== 0) pushFrame();
  if (path && live[sh]) path.push([r2(live[sh].position.x), r2(live[sh].position.y), r4(live[sh].angle)]);

  const bodies = o.bodies.map((p, i) => {
    const b = live[i];
    if (!b) {
      const ev = events.find((e) => e.type === 'fall' && e.pen === i);
      return ev ? { x: ev.x, y: ev.y, a: ev.a, off: true } : { ...p, off: true };
    }
    return { x: r2(b.position.x), y: r2(b.position.y), a: r4(b.angle), off: false };
  });

  M.Events.off(engine);
  M.Engine.clear(engine);
  return { bodies, frames, events, off, firstHit, path, steps: substep };
}
