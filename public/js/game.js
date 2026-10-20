// The match view: draws the desk and pens, handles the flick input,
// shows the aim guide and plays back simulated shots.
import { DESK_W, DESK_H, deskHalf, simulate, shotVelocity } from '/shared/physics.js';
import { nextShrink } from '/shared/game.js';
import { makeWood, drawPen, drawPenShadow, capsulePath } from './render.js';
import { sfx } from './audio.js';

const TEAM = ['#e8742c', '#3f7fd0'];
const MIN_POWER = 0.08;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class GameView {
  /**
   * hooks: settings() -> settings object
   *        onShot(shot)          local player released a flick
   *        onAim(aim|null)       live aim (for online)
   *        onPower(p|null)       power bar
   */
  constructor(canvas, hooks) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.state = null;
    this.stats = null;
    this.players = [];
    this.disp = [];
    this.falling = [null, null];
    this.gone = [false, false];
    this.deskVis = 1;
    this.deskTarget = 1;
    this.playing = null;
    this.inputFor = -1;
    this.aim = null;
    this.ghost = null;     // remote / computer aim
    this.preview = null;
    this.particles = [];
    this.shake = 0;
    this.labelsAlpha = 1;
    this.labelsFade = false;
    this.cam = { s: 1, ox: 0, oy: 0, rot: 0 };
    this.time = 0;
    this.running = false;
    this.lastVib = 0;
    this._bind();
  }

  // ---------- setup ----------
  _bind() {
    const c = this.c;
    c.addEventListener('pointerdown', (e) => this._down(e));
    c.addEventListener('pointermove', (e) => this._move(e));
    c.addEventListener('pointerup', (e) => this._up(e));
    c.addEventListener('pointercancel', () => this.cancelAim());
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.aim) { this.cancelAim(); e.stopPropagation(); } }, true);
    window.addEventListener('resize', () => this.resize());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(50, t - last);
      last = t;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; this.cancelAim(); }

  resize() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = this.c.clientWidth || window.innerWidth, h = this.c.clientHeight || window.innerHeight;
    this.dpr = dpr;
    this.cw = w; this.ch = h;
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    this.floor = null;
  }

  /** players: [{ name, tag, color }] */
  setMatch(state, stats, players) {
    this.stats = stats;
    this.players = players;
    this.setState(state);
  }

  setState(state) {
    this.state = state;
    this.disp = state.bodies.map((b) => ({ x: b.x, y: b.y, a: b.a }));
    this.gone = state.bodies.map((b) => !!b.off);
    this.falling = [null, null];
    this.deskVis = this.deskTarget = state.deskScale;
    this.playing = null;
    this.ghost = null;
    this.preview = null;
    if (state.turnInRound === 0) { this.labelsAlpha = 1; this.labelsFade = false; }
  }

  setInput(player) {
    this.inputFor = player;
    if (player < 0) this.cancelAim();
  }

  get busy() { return !!this.playing; }

  // ---------- coordinates ----------
  // portrait screens show the desk turned 90 degrees
  toWorld(sx, sy) {
    const { s, ox, oy, rot } = this.cam;
    const x = (sx - ox) / s, y = (sy - oy) / s;
    return rot ? { x: y, y: -x } : { x, y };
  }

  toScreen(x, y) {
    const { s, ox, oy, rot } = this.cam;
    return rot ? { x: -y * s + ox, y: x * s + oy } : { x: x * s + ox, y: y * s + oy };
  }

  _local(e) {
    const r = this.c.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }

  // ---------- input ----------
  _down(e) {
    sfx.unlock();
    if (this.inputFor < 0 || this.playing || !this.state || this.state.roundOver) return;
    const i = this.inputFor;
    if (this.gone[i]) return;
    const { sx, sy } = this._local(e);
    const w = this.toWorld(sx, sy);
    const b = this.disp[i], st = this.stats[i];
    const ca = Math.cos(-b.a), sa = Math.sin(-b.a);
    const dx = w.x - b.x, dy = w.y - b.y;
    const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
    const tol = Math.max(st.wid / 2 + 10, 26 / this.cam.s);
    if (Math.abs(lx) > st.len / 2 + 14 / this.cam.s || Math.abs(ly) > tol) return;
    this.c.setPointerCapture(e.pointerId);
    this.aim = {
      player: i, pid: e.pointerId,
      lx: clamp(lx / st.len, -0.5, 0.5),
      sx, sy, power: 0, dx: 1, dy: 0, boost: 0, lastBucket: 0,
    };
    this.preview = null;
    this._previewDirty = true;
    sfx.grab();
    this._updateAim();
  }

  _move(e) {
    if (!this.aim || e.pointerId !== this.aim.pid) return;
    const { sx, sy } = this._local(e);
    this.aim.sx = sx; this.aim.sy = sy;
    this._updateAim();
  }

  _up(e) {
    if (!this.aim || e.pointerId !== this.aim.pid) return;
    const a = this.aim;
    this.aim = null;
    this.preview = null;
    this.hooks.onPower && this.hooks.onPower(null);
    this.hooks.onAim && this.hooks.onAim(null);
    if (a.power < MIN_POWER) return;
    const shot = { lx: +a.lx.toFixed(4), dx: +a.dx.toFixed(5), dy: +a.dy.toFixed(5), power: +a.power.toFixed(4) };
    this.hooks.onShot && this.hooks.onShot(shot);
  }

  cancelAim() {
    if (!this.aim) return;
    this.aim = null;
    this.preview = null;
    this.hooks.onPower && this.hooks.onPower(null);
    this.hooks.onAim && this.hooks.onAim(null);
  }

  _grabWorld(i, lx) {
    const b = this.disp[i], st = this.stats[i];
    return { x: b.x + Math.cos(b.a) * lx * st.len, y: b.y + Math.sin(b.a) * lx * st.len };
  }

  _maxPullPx() { return clamp(Math.min(this.cw, this.ch) * 0.34, 110, 320); }

  _updateAim() {
    const a = this.aim;
    if (!a) return;
    const g = this._grabWorld(a.player, a.lx);
    const gs = this.toScreen(g.x, g.y);
    const vx = gs.x - a.sx, vy = gs.y - a.sy;
    const len = Math.hypot(vx, vy);
    if (len > 2) {
      // screen direction back into world space
      const wx = this.cam.rot ? vy : vx, wy = this.cam.rot ? -vx : vy;
      a.dx = wx / len; a.dy = wy / len;
    }
    a.base = clamp(len / this._maxPullPx(), 0, 1);
    a.power = clamp(a.base + a.boost, 0, 1);
    this._previewDirty = true;
    this.hooks.onPower && this.hooks.onPower(a.power < MIN_POWER ? 0 : a.power);
    this.hooks.onAim && this.hooks.onAim({ lx: a.lx, dx: a.dx, dy: a.dy, power: a.power, on: true });
    const bucket = Math.floor(a.power * 10);
    if (bucket !== a.lastBucket) {
      a.lastBucket = bucket;
      const st = this.hooks.settings();
      if (st.vibration && navigator.vibrate && performance.now() - this.lastVib > 40) { navigator.vibrate(6); this.lastVib = performance.now(); }
      if (bucket > 0) sfx.tick();
    }
  }

  /** Show someone else's aim (online opponent). */
  setGhost(aim, player) {
    this.ghost = aim && aim.on ? { ...aim, player } : null;
  }

  /** Animate the computer pulling back, then resolve. */
  animateAim(shot, player, ms = 750) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const k = clamp((performance.now() - t0) / ms, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        this.ghost = { lx: shot.lx, dx: shot.dx, dy: shot.dy, power: shot.power * e, on: true, player };
        if (k < 1) requestAnimationFrame(step);
        else setTimeout(() => { this.ghost = null; resolve(); }, 120);
      };
      step();
    });
  }

  // ---------- playback ----------
  /** Play a shot result from playShot(). Resolves when everything settled. */
  play(res) {
    return new Promise((resolve) => {
      this.cancelAim();
      this.ghost = null;
      this.labelsFade = true;
      const events = res.events.filter((e) => e.type !== 'shrinkfall').sort((a, b) => a.f - b.f);
      this.playing = { res, f: 0, ev: 0, events, resolve, ending: false };
      if (res.shot && res.shot.power > 0) sfx.flick(res.shot.power);
    });
  }

  _finishPlay() {
    const p = this.playing;
    const res = p.res;
    const st = res.state;
    st.bodies.forEach((b, i) => {
      if (!b.off) { this.disp[i] = { x: b.x, y: b.y, a: b.a }; }
    });
    const done = () => { this.playing = null; this.state = st; p.resolve(); };
    if (res.shrink) {
      this.deskTarget = res.shrink;
      sfx.shrink();
      this.hooks.onShrink && this.hooks.onShrink();
      setTimeout(() => {
        for (const e of res.events) {
          if (e.type === 'shrinkfall') this._startFall(e.pen, { x: e.x, y: e.y, a: e.a, vx: e.x > 0 ? 0.8 : -0.8, vy: 0, w: 0 });
        }
      }, 450);
      setTimeout(done, 1100);
    } else {
      setTimeout(done, 120);
    }
  }

  _startFall(i, e) {
    if (this.falling[i] || this.gone[i]) return;
    this.falling[i] = { t: 0, x: e.x, y: e.y, a: e.a, vx: e.vx || 0, vy: e.vy || 0, w: e.w || 0 };
    sfx.fall();
    this.kick(6);
    const st = this.hooks.settings();
    if (st.vibration && navigator.vibrate) navigator.vibrate(30);
  }

  kick(v) {
    if (this.hooks.settings().reduceMotion) return;
    this.shake = Math.max(this.shake, v);
  }

  _spark(x, y, s) {
    const n = Math.min(18, 4 + Math.round(s * 1.4));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 3) * (0.6 + s / 8);
      this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.25 + Math.random() * 0.25 });
    }
    this.particles.push({ type: 'ring', x, y, life: 0, max: 0.35, r: 6 + s * 2 });
  }

  // ---------- update ----------
  update(dtMs) {
    const dt = dtMs / 1000;
    this.time += dt;
    const p = this.playing;
    if (p && !p.ending) {
      p.f += dtMs * 0.06;
      const fr = p.res.frames;
      while (p.ev < p.events.length && p.events[p.ev].f <= p.f) {
        const e = p.events[p.ev++];
        if (e.type === 'hit') {
          this._spark(e.x, e.y, e.s);
          sfx.hit(e.s);
          this.kick(Math.min(9, e.s * 0.9));
          const st = this.hooks.settings();
          if (st.vibration && navigator.vibrate && e.s > 3) navigator.vibrate(12);
        } else if (e.type === 'fall') {
          this._startFall(e.pen, e);
        }
      }
      const last = fr.length - 1;
      const fi = Math.min(last, Math.floor(p.f)), t = Math.min(1, p.f - fi);
      const A = fr[fi], B = fr[Math.min(last, fi + 1)];
      for (let i = 0; i < 2; i++) {
        if (A[i * 3] === null || this.falling[i]) continue;
        const b = B[i * 3] === null ? A : B;
        this.disp[i] = { x: lerp(A[i * 3], b[i * 3], t), y: lerp(A[i * 3 + 1], b[i * 3 + 1], t), a: lerp(A[i * 3 + 2], b[i * 3 + 2], t) };
      }
      if (p.f >= last) { p.ending = true; this._finishPlay(); }
    }

    for (let i = 0; i < 2; i++) {
      const f = this.falling[i];
      if (!f) continue;
      f.t += dt;
      const k = Math.pow(0.4, dt);
      f.x += f.vx * 60 * dt; f.y += f.vy * 60 * dt; f.a += f.w * 60 * dt;
      f.vx *= k; f.vy *= k;
      if (f.t > 0.9) { this.falling[i] = null; this.gone[i] = true; }
    }

    this.deskVis = lerp(this.deskVis, this.deskTarget, Math.min(1, dt * 3.5));
    if (this.labelsFade) this.labelsAlpha = Math.max(0, this.labelsAlpha - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt * 30);

    for (const q of this.particles) {
      q.life += dt;
      if (q.type === 'spark') { q.x += q.vx * 60 * dt; q.y += q.vy * 60 * dt; q.vx *= 0.9; q.vy *= 0.9; }
    }
    this.particles = this.particles.filter((q) => q.life < q.max);

    if (this.aim) {
      const edge = 14;
      const a = this.aim;
      const atEdge = a.sx < edge || a.sy < edge || a.sx > this.cw - edge || a.sy > this.ch - edge;
      if (atEdge && a.base > 0.4) { a.boost = Math.min(1, a.boost + dt * 0.6); this._updateAim(); }
    }

    // aim guide path (throttled)
    const st = this.hooks.settings();
    if (this.aim && st.aim && this._previewDirty && this.time - (this._lastPreview || 0) > 0.05 && this.aim.power >= MIN_POWER) {
      this._previewDirty = false;
      this._lastPreview = this.time;
      const a = this.aim;
      const bodies = this.state.bodies.map((b, i) => ({ ...b, x: this.disp[i].x, y: this.disp[i].y, a: this.disp[i].a }));
      const sim = simulate({
        bodies, stats: this.stats, deskScale: this.state.deskScale, shooter: a.player,
        shot: { lx: a.lx, dx: a.dx, dy: a.dy, power: a.power }, record: false, trackPath: true, stopOnHit: true, maxSteps: 900,
      });
      this.preview = { path: sim.path, hit: sim.firstHit >= 0, off: sim.off[a.player] };
    } else if (this.aim && this.aim.power < MIN_POWER) {
      this.preview = null;
    }
  }

  // ---------- drawing ----------
  _camera() {
    const reduce = this.hooks.settings().reduceMotion;
    const z = reduce ? 1 : clamp(this.deskVis * 1.05, 0.62, 1);
    const top = this.cw < 760 ? 100 : 64;
    const rot = this.ch - top > this.cw * 1.15 ? Math.PI / 2 : 0;
    let vw = DESK_W * z + 120, vh = DESK_H * z + 120;
    if (rot) [vw, vh] = [vh, vw];
    const s = Math.min(this.cw / vw, (this.ch - top) / vh);
    this.cam = { s, ox: this.cw / 2, oy: top / 2 + this.ch / 2, rot };
  }

  draw() {
    const ctx = this.ctx;
    if (!this.state) return;
    this._camera();
    const { s, ox, oy, rot } = this.cam;
    const st = this.hooks.settings();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // floor
    if (!this.floor) this.floor = makeWood('floor', 600, 400);
    const fw = this.cw, fh = this.ch, fs = Math.max(fw / 600, fh / 400);
    ctx.drawImage(this.floor, (fw - 600 * fs) / 2, (fh - 400 * fs) / 2, 600 * fs, 400 * fs);
    const vg = ctx.createRadialGradient(fw / 2, fh / 2, Math.min(fw, fh) * 0.3, fw / 2, fh / 2, Math.max(fw, fh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0.15)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, fw, fh);

    const shx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(ox + shx, oy + shy);
    ctx.rotate(rot);
    ctx.scale(s, s);

    this._drawDesk(ctx, st);

    // pens
    for (let i = 0; i < 2; i++) {
      if (this.gone[i] && !this.falling[i]) continue;
      const f = this.falling[i];
      const b = f || this.disp[i];
      const pen = this.stats[i];
      const k = f ? clamp(f.t / 0.9, 0, 1) : 0;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      if (f) ctx.scale(1 - 0.45 * k, 1 - 0.45 * k);
      drawPenShadow(ctx, pen, 1 + k * 3);
      // turn glow
      if (!f && !this.playing && !this.state.roundOver && this.state.turn === i && this.inputFor === i) {
        const pulse = 0.35 + 0.25 * Math.sin(this.time * 5);
        ctx.save();
        capsulePath(ctx, pen.len, pen.wid, 7);
        ctx.strokeStyle = TEAM[i];
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      }
      const pl = this.players[i] || {};
      drawPen(ctx, pen, { look: st.look, tag: pl.tag, tagColor: TEAM[i], alpha: 1 - k, angle: b.a + rot });
      ctx.restore();
    }

    // names under the pens at round start
    if (this.labelsAlpha > 0) {
      // drawn upright in screen space
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalAlpha = this.labelsAlpha;
      ctx.font = `700 ${Math.max(16, 34 * s)}px Fredoka, 'Hind Siliguri', sans-serif`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 2; i++) {
        if (this.gone[i]) continue;
        const b = this.disp[i];
        const p = this.toScreen(b.x, b.y);
        const name = (this.players[i] || {}).name || '';
        const y = p.y + Math.max(30, 80 * s);
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,248,234,0.8)';
        ctx.strokeText(name, p.x, y);
        ctx.fillStyle = this.state.turn === i ? TEAM[i] : 'rgba(80,80,90,0.7)';
        ctx.fillText(name, p.x, y);
      }
      ctx.restore();
    }

    this._drawParticles(ctx);
    if (this.aim) this._drawAim(ctx, this.aim, st, false);
    else if (this.ghost) this._drawAim(ctx, this.ghost, st, true);
  }

  _drawDesk(ctx, st) {
    const { hw, hh } = deskHalf(this.deskVis);
    const pad = 16;
    const s = this.cam.s;
    // shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40 * s * this.dpr;
    ctx.shadowOffsetY = 16 * s * this.dpr;
    ctx.beginPath();
    ctx.roundRect(-hw - pad, -hh - pad, (hw + pad) * 2, (hh + pad) * 2, 30);
    const rim = ctx.createLinearGradient(0, -hh - pad, 0, hh + pad);
    rim.addColorStop(0, '#a26f40'); rim.addColorStop(1, '#6a4222');
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,20,8,0.6)';
    ctx.beginPath(); ctx.roundRect(-hw - pad, -hh - pad, (hw + pad) * 2, (hh + pad) * 2, 30); ctx.stroke();

    // surface
    const tex = makeWood(st.desk === 'old' ? 'old' : 'clean', 900, 540);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-hw, -hh, hw * 2, hh * 2, 18); ctx.clip();
    const sw = tex.width * this.deskVis, sh = tex.height * this.deskVis;
    ctx.drawImage(tex, (tex.width - sw) / 2, (tex.height - sh) / 2, sw, sh, -hw, -hh, hw * 2, hh * 2);
    // inner bevel
    const e = 26;
    const edges = [
      [-hw, -hh, hw * 2, e, 0, -hh, 0, -hh + e],
      [-hw, hh - e, hw * 2, e, 0, hh, 0, hh - e],
      [-hw, -hh, e, hh * 2, -hw, 0, -hw + e, 0],
      [hw - e, -hh, e, hh * 2, hw, 0, hw - e, 0],
    ];
    for (const [x, y, w, h, x0, y0, x1, y1] of edges) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(60,30,10,0.35)'); g.addColorStop(1, 'rgba(60,30,10,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    if (document.documentElement.dataset.dark === '1') { ctx.fillStyle = 'rgba(10,12,20,0.18)'; ctx.fillRect(-hw, -hh, hw * 2, hh * 2); }
    ctx.restore();

    // the next shot shrinks the desk
    const ns = !this.playing && this.state && !this.state.roundOver ? nextShrink(this.state) : null;
    if (ns && Math.abs(this.deskVis - this.deskTarget) < 0.01) {
      const n = deskHalf(ns);
      ctx.save();
      ctx.setLineDash([16, 12]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(214,58,40,${0.45 + 0.3 * Math.sin(this.time * 6)})`;
      ctx.beginPath(); ctx.roundRect(-n.hw, -n.hh, n.hw * 2, n.hh * 2, 14); ctx.stroke();
      ctx.fillStyle = 'rgba(214,58,40,0.08)';
      ctx.beginPath();
      ctx.rect(-hw, -hh, hw * 2, hh * 2);
      ctx.roundRect(-n.hw, -n.hh, n.hw * 2, n.hh * 2, 14);
      ctx.fill('evenodd');
      ctx.restore();
    }
  }

  _drawParticles(ctx) {
    for (const q of this.particles) {
      const k = q.life / q.max;
      if (q.type === 'spark') {
        ctx.strokeStyle = `rgba(255,${200 + 40 * (1 - k)},120,${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 3, q.y - q.vy * 3); ctx.stroke();
      } else if (q.type === 'ring') {
        ctx.strokeStyle = `rgba(255,248,220,${0.8 * (1 - k)})`;
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r + k * 30, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  _drawAim(ctx, a, st, ghost) {
    const i = a.player;
    if (this.gone[i]) return;
    const s = this.cam.s;
    const g = this._grabWorld(i, a.lx);
    const pullW = (a.power * this._maxPullPx()) / s;
    const px = g.x - a.dx * pullW, py = g.y - a.dy * pullW;
    const col = a.power < 0.45 ? '#6dbb4f' : a.power < 0.8 ? '#f0b429' : '#e0482c';
    ctx.save();
    ctx.globalAlpha = ghost ? 0.7 : 1;
    ctx.lineCap = 'round';

    // path preview
    if (!ghost && st.aim && this.preview && this.preview.path.length) {
      const pts = this.preview.path;
      for (let k = 0; k < pts.length; k += 2) {
        const al = 1 - k / pts.length;
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * al})`;
        ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1], 4.5 / Math.sqrt(s), 0, Math.PI * 2); ctx.fill();
      }
      const end = pts[pts.length - 1];
      if (!this.preview.off && end[2] !== undefined) {
        ctx.save();
        ctx.translate(end[0], end[1]);
        ctx.rotate(end[2]);
        capsulePath(ctx, this.stats[i].len, this.stats[i].wid, 0);
        ctx.setLineDash([8 / s, 6 / s]);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2.5 / s;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (this.preview.hit) {
        ctx.strokeStyle = '#fff4c2'; ctx.lineWidth = 3 / s;
        for (let k = 0; k < 6; k++) {
          const an = (k / 6) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(end[0] + Math.cos(an) * 8, end[1] + Math.sin(an) * 8); ctx.lineTo(end[0] + Math.cos(an) * 16, end[1] + Math.sin(an) * 16); ctx.stroke();
        }
      } else if (this.preview.off) {
        ctx.strokeStyle = '#e0482c'; ctx.lineWidth = 5 / s;
        ctx.beginPath(); ctx.moveTo(end[0] - 10, end[1] - 10); ctx.lineTo(end[0] + 10, end[1] + 10); ctx.moveTo(end[0] + 10, end[1] - 10); ctx.lineTo(end[0] - 10, end[1] + 10); ctx.stroke();
      }
    }

    // rubber band
    ctx.setLineDash([10 / s, 8 / s]);
    ctx.strokeStyle = 'rgba(43,52,69,0.75)';
    ctx.lineWidth = 3.5 / s;
    ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(px, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2b3445';
    ctx.beginPath(); ctx.arc(px, py, 6 / s, 0, Math.PI * 2); ctx.fill();

    // arrow
    if ((st.aim || ghost) && a.power >= MIN_POWER) {
      const L = 50 + a.power * 170;
      const ex = g.x + a.dx * L, ey = g.y + a.dy * L;
      ctx.strokeStyle = 'rgba(43,52,69,0.6)';
      ctx.lineWidth = 12 / s + 2;
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = 8 / s + 1;
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(ex, ey); ctx.stroke();
      const hs = 16 / s + 8;
      const nx = -a.dy, ny = a.dx;
      ctx.beginPath();
      ctx.moveTo(ex + a.dx * hs, ey + a.dy * hs);
      ctx.lineTo(ex + nx * hs * 0.8, ey + ny * hs * 0.8);
      ctx.lineTo(ex - nx * hs * 0.8, ey - ny * hs * 0.8);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = 'rgba(43,52,69,0.8)'; ctx.lineWidth = 2 / s; ctx.stroke();

      // spin hint
      const v = shotVelocity(this.disp[i], this.stats[i], a);
      if (Math.abs(v.w) > 0.04 && st.aim) {
        const b = this.disp[i];
        const r = this.stats[i].len * 0.5 + 18;
        const dir = Math.sign(v.w);
        const a0 = b.a + (dir > 0 ? 0.3 : -0.3), a1 = a0 + dir * Math.min(1.6, Math.abs(v.w) * 5);
        ctx.strokeStyle = 'rgba(255,248,234,0.85)';
        ctx.lineWidth = 4 / s + 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, a0, a1, dir < 0); ctx.stroke();
        const hx = b.x + Math.cos(a1) * r, hy = b.y + Math.sin(a1) * r;
        const tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;
        ctx.fillStyle = 'rgba(255,248,234,0.9)';
        ctx.beginPath();
        ctx.moveTo(hx + tx * 12, hy + ty * 12);
        ctx.lineTo(hx - ty * 8, hy + tx * 8);
        ctx.lineTo(hx + ty * 8, hy - tx * 8);
        ctx.closePath(); ctx.fill();
      }
    }

    // grab point
    ctx.fillStyle = '#f5cf55';
    ctx.strokeStyle = '#2b3445';
    ctx.lineWidth = 3 / s;
    ctx.beginPath(); ctx.arc(g.x, g.y, 9 / s + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
