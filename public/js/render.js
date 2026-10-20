// Drawing helpers: procedural wood desks and the pens.
// Everything is drawn in code, so there are no image files to load.

// ---------- noise ----------
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 17); f *= 2; amp *= 0.5; }
  return v;
}
function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WOODS = {
  clean: { light: [232, 190, 140], dark: [196, 146, 96], grain: [150, 100, 58], seed: 7, knots: 3, contrast: 0.85 },
  old: { light: [205, 158, 104], dark: [160, 112, 66], grain: [104, 66, 34], seed: 21, knots: 5, contrast: 1.1 },
  floor: { light: [130, 96, 66], dark: [100, 72, 48], grain: [70, 48, 30], seed: 3, knots: 4, contrast: 1 },
  school: { light: [206, 146, 86], dark: [164, 102, 52], grain: [96, 54, 22], seed: 33, knots: 4, contrast: 1.05 },
};

const woodCache = new Map();

/** A wood texture canvas. variant: clean | old | floor */
export function makeWood(variant = 'clean', w = 1200, h = 720) {
  const key = variant + w + 'x' + h;
  if (woodCache.has(key)) return woodCache.get(key);
  const cfg = WOODS[variant] || WOODS.clean;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const rnd = mulberry(cfg.seed);
  const knots = Array.from({ length: cfg.knots }, () => ({ x: rnd() * w, y: rnd() * h, r: 30 + rnd() * 60, s: 0.6 + rnd() * 0.8 }));
  const sx = 1200 / w; // keep the look the same at any size
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const X = x * sx, Y = y * sx;
      let warp = fbm(X * 0.0016, Y * 0.006, cfg.seed, 4) * 70;
      for (const k of knots) {
        const dx = (x - k.x) * sx, dy = (y - k.y) * sx * 2.2;
        const dd = dx * dx + dy * dy;
        warp += (k.r * k.r * 18 * k.s) / (dd + k.r * k.r) * Math.sign(y - k.y || 1) * 0.35;
      }
      // growth rings: thin dark lines, spacing varies along the board
      const v = (Y + warp) * 0.05 + fbm(X * 0.003, Y * 0.02, cfg.seed + 5, 3) * 1.6;
      const f = v - Math.floor(v);
      const dl = Math.min(f, 1 - f);
      const lines = (Math.exp(-dl * dl * 160) * 0.85 + Math.exp(-dl * dl * 18) * 0.25) * cfg.contrast;
      const band = fbm(X * 0.0009, Y * 0.005, cfg.seed + 9, 3);
      // long fibres stretched along the grain
      const fiber = (vnoise(X * 0.012, Y * 0.9, cfg.seed + 2) - 0.5) * 0.35 + (vnoise(X * 0.05, Y * 2.2, cfg.seed + 3) - 0.5) * 0.18;
      const m = Math.min(1, Math.max(0, band * 0.85 + fiber));
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const base = cfg.light[ch] + (cfg.dark[ch] - cfg.light[ch]) * m;
        d[i + ch] = base + (cfg.grain[ch] - base) * lines * 0.55;
      }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (variant === 'old') decorateOldDesk(ctx, w, h, rnd);
  // soft light from the top left
  const g = ctx.createRadialGradient(w * 0.35, h * 0.3, 10, w * 0.5, h * 0.5, w * 0.75);
  g.addColorStop(0, 'rgba(255,240,210,0.16)');
  g.addColorStop(1, 'rgba(60,30,10,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  woodCache.set(key, c);
  return c;
}

function decorateOldDesk(ctx, w, h, rnd) {
  const s = w / 1200;
  ctx.save();
  ctx.lineCap = 'round';
  // scratches
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w, y = rnd() * h, l = (10 + rnd() * 70) * s, a = (rnd() - 0.5) * 0.9;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,235,200,0.22)' : 'rgba(70,40,20,0.22)';
    ctx.lineWidth = (0.6 + rnd() * 1.2) * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // carved initials and doodles
  ctx.font = `700 ${46 * s}px Fredoka, sans-serif`;
  const carve = (txt, x, y, rot) => {
    ctx.save(); ctx.translate(x * s, y * s); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(255,235,205,0.25)'; ctx.fillText(txt, 1.5 * s, 1.5 * s);
    ctx.fillStyle = 'rgba(70,38,16,0.42)'; ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  carve('R + S', 160, 140, -0.12);
  carve('2009', 930, 610, 0.08);
  carve('Class 7B', 820, 140, 0.05);
  // a heart
  ctx.save(); ctx.translate(320 * s, 560 * s); ctx.rotate(0.2); ctx.scale(s * 1.4, s * 1.4);
  ctx.strokeStyle = 'rgba(70,38,16,0.42)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-24, -8, -12, -26, 0, -12); ctx.bezierCurveTo(12, -26, 24, -8, 0, 10); ctx.stroke();
  ctx.restore();
  // ink stains
  for (let i = 0; i < 4; i++) {
    const x = rnd() * w, y = rnd() * h, r = (8 + rnd() * 18) * s;
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '30,50,120' : '20,20,30'},0.18)`;
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, rr = r * (0.7 + rnd() * 0.5);
      k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  // compass hole
  ctx.fillStyle = 'rgba(40,20,8,0.5)';
  ctx.beginPath(); ctx.arc(600 * s, 330 * s, 3 * s, 0, 7); ctx.fill();
  ctx.restore();
}

// ---------- colour helpers ----------
function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const INK = '#2b3445';

function rr(ctx, x0, x1, w, rl, rrt) {
  const y0 = -w / 2, y1 = w / 2;
  rl = Math.min(rl, w / 2, (x1 - x0) / 2); rrt = Math.min(rrt, w / 2, (x1 - x0) / 2);
  ctx.beginPath();
  ctx.moveTo(x0 + rl, y0);
  ctx.lineTo(x1 - rrt, y0);
  rrt ? ctx.arcTo(x1, y0, x1, y0 + rrt, rrt) : ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y1 - rrt);
  rrt ? ctx.arcTo(x1, y1, x1 - rrt, y1, rrt) : ctx.lineTo(x1, y1);
  ctx.lineTo(x0 + rl, y1);
  rl ? ctx.arcTo(x0, y1, x0, y1 - rl, rl) : ctx.lineTo(x0, y1);
  ctx.lineTo(x0, y0 + rl);
  rl ? ctx.arcTo(x0, y0, x0 + rl, y0, rl) : ctx.lineTo(x0, y0);
  ctx.closePath();
}

// Painter for one pen: wraps the classic / real styles.
function painter(ctx, look) {
  const real = look === 'real';
  const fillCyl = (color, w, alpha = 1) => {
    if (!real) { ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; return; }
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
    g.addColorStop(0, shade(color, -0.35));
    g.addColorStop(0.22, shade(color, 0.35));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.45));
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
  };
  const line = (lw = 2.2) => { if (!real) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); } };
  const shine = (x0, x1, w) => {
    ctx.fillStyle = real ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.35)';
    const h = Math.max(1.5, w * 0.14);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x0 + 3, -w * 0.32, Math.max(0, x1 - x0 - 6), h, h / 2) : ctx.rect(x0 + 3, -w * 0.32, x1 - x0 - 6, h);
    ctx.fill();
  };
  return {
    real,
    seg(x0, x1, w, color, { rl = 0, rr: rrt = 0, alpha = 1, gloss = true, outline = true } = {}) {
      rr(ctx, x0, x1, w, rl, rrt);
      fillCyl(color, w, alpha);
      if (outline) line();
      if (gloss) shine(x0, x1, w);
    },
    clear(x0, x1, w, tint = '#dfe9f2', { rl = 0, rr: rrt = 0 } = {}) {
      rr(ctx, x0, x1, w, rl, rrt);
      if (real) {
        const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        g.addColorStop(0, 'rgba(255,255,255,0.15)');
        g.addColorStop(0.2, 'rgba(255,255,255,0.65)');
        g.addColorStop(0.5, 'rgba(220,230,240,0.25)');
        g.addColorStop(1, 'rgba(90,100,120,0.35)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(80,90,110,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.globalAlpha = 0.55; ctx.fillStyle = tint; ctx.fill(); ctx.globalAlpha = 1;
        line();
        shine(x0, x1, w);
      }
    },
    cone(x0, x1, w0, w1, color, { round = true } = {}) {
      ctx.beginPath();
      ctx.moveTo(x0, -w0 / 2);
      ctx.lineTo(x1, -w1 / 2);
      if (round && w1 > 1) ctx.arc(x1, 0, w1 / 2, -Math.PI / 2, Math.PI / 2);
      else ctx.lineTo(x1, w1 / 2);
      ctx.lineTo(x0, w0 / 2);
      ctx.closePath();
      fillCyl(color, w0);
      line(2);
    },
    rect(x0, x1, y0, y1, color, outline = true) {
      ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = color; ctx.fill();
      if (outline && !real) { ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); }
    },
  };
}

const PEN_DRAW = {
  ballpoint(ctx, L, W, p) {
    const h = L / 2;
    p.clear(-h + 10, h - 38, W, '#e5eef6', { rl: 2 });
    // ink tube
    p.rect(-h + 18, h - 30, -1.7, 1.7, '#2f56c4', false);
    p.rect(-h + 30, -h + 50, -W * 0.38, W * 0.38, 'rgba(255,255,255,0.15)', false);
    p.seg(-h, -h + 14, W * 0.92, '#e8742c', { rl: W * 0.45, rr: 2 });
    p.cone(h - 40, h - 9, W, W * 0.45, '#e8742c');
    p.cone(h - 10, h, W * 0.36, 1.5, '#c9ced6', { round: false });
  },
  gel(ctx, L, W, p) {
    const h = L / 2;
    p.clear(-h + 26, h - 62, W, '#e7e0f1', {});
    p.rect(-h + 30, h - 58, -2.3, 2.3, '#d6409f', false);
    p.seg(-h, -h + 34, W, '#d6409f', { rl: W * 0.45, rr: 3 });
    p.rect(-h + 4, -h + 30, -2, 2, 'rgba(40,20,40,0.55)', false); // clip
    p.seg(h - 64, h - 22, W * 0.95, '#3d4250', { gloss: true });
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
    for (let x = h - 60; x < h - 24; x += 5) { ctx.beginPath(); ctx.moveTo(x, -W * 0.45); ctx.lineTo(x, W * 0.45); ctx.stroke(); }
    p.cone(h - 23, h - 6, W * 0.9, W * 0.38, '#ccd3dc');
    p.cone(h - 7, h, W * 0.3, 1.2, '#8a919c', { round: false });
  },
  click(ctx, L, W, p) {
    const h = L / 2;
    p.seg(-h, -h + 12, W * 0.6, '#b8bec8', { rl: 4, rr: 1 });
    p.seg(-h + 10, h - 34, W, '#2a9d8f', { rl: 4, rr: 2 });
    p.rect(-h + 14, -h + 62, -2.6, 2.6, '#d9dee6');
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let x = h - 70; x < h - 38; x += 5) { ctx.beginPath(); ctx.moveTo(x, -W * 0.48); ctx.lineTo(x, W * 0.48); ctx.stroke(); }
    p.cone(h - 35, h - 7, W, W * 0.4, '#2a9d8f');
    p.cone(h - 8, h, W * 0.32, 1.2, '#c9ced6', { round: false });
  },
  fourcolor(ctx, L, W, p) {
    const h = L / 2;
    p.clear(-h + 2, h - 34, W, '#eef1f5', { rl: W * 0.45 });
    const cols = ['#d33a2c', '#2f56c4', '#2f9e44', '#23262e'];
    cols.forEach((c, i) => p.rect(-h + 8, -h + 52, -W / 2 + 3 + i * ((W - 6) / 4) + 0.6, -W / 2 + 3 + (i + 1) * ((W - 6) / 4) - 0.6, c));
    p.rect(-h + 56, h - 40, -W * 0.18, W * 0.18, 'rgba(60,70,90,0.18)', false);
    p.seg(h - 36, h - 30, W, '#9aa3b2', { gloss: false });
    p.cone(h - 31, h - 6, W, W * 0.38, '#5c7fd6');
    p.cone(h - 7, h, W * 0.3, 1.2, '#c9ced6', { round: false });
  },
  fountain(ctx, L, W, p) {
    const h = L / 2;
    p.seg(-h, -h + 18, W, '#3f7fd0', { rl: W * 0.5, rr: 2 });
    p.seg(-h + 16, h - 56, W, '#a891d8', { rl: 2, rr: 2 });
    // clip slot and window
    p.rect(-h + 40, -h + 66, -W * 0.16, W * 0.16, '#2b3445');
    p.rect(-h + 74, -h + 82, -W * 0.36, W * 0.36, '#f1c84b');
    p.seg(h - 58, h - 52, W * 1.02, '#f1c84b', { gloss: false });
    p.seg(h - 53, h - 30, W * 0.9, '#2f3442', { rl: 2, rr: 2 });
    // nib
    ctx.beginPath();
    ctx.moveTo(h - 32, -W * 0.42); ctx.quadraticCurveTo(h - 10, -W * 0.3, h, 0);
    ctx.quadraticCurveTo(h - 10, W * 0.3, h - 32, W * 0.42); ctx.closePath();
    ctx.fillStyle = p.real ? '#e7bf45' : '#f1c84b'; ctx.fill();
    if (!p.real) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(h - 16, 0); ctx.lineTo(h - 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(h - 18, 0, 1.6, 0, 7); ctx.fillStyle = INK; ctx.fill();
  },
  marker(ctx, L, W, p) {
    const h = L / 2;
    p.seg(-h, -h + 8, W * 0.86, '#d33a2c', { rl: 4, rr: 1 });
    p.seg(-h + 6, h - 44, W, '#2c2f38', { rl: 3, rr: 2 });
    p.rect(-h + 30, -h + 92, -W * 0.38, W * 0.38, '#f3efe6');
    p.rect(-h + 36, -h + 86, -W * 0.12, W * 0.12, '#d33a2c', false);
    p.seg(h - 46, h, W * 1.04, '#d33a2c', { rl: 2, rr: W * 0.42 });
    p.rect(h - 44, h - 14, -2.6, 2.6, 'rgba(0,0,0,0.35)', false);
  },
  pencil(ctx, L, W, p) {
    const h = L / 2;
    p.seg(-h, -h + 12, W * 0.94, '#f08da0', { rl: W * 0.4, rr: 1 });
    p.seg(-h + 11, -h + 26, W, '#c4cad3', { gloss: false });
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2;
    for (let x = -h + 14; x < -h + 25; x += 3) { ctx.beginPath(); ctx.moveTo(x, -W / 2); ctx.lineTo(x, W / 2); ctx.stroke(); }
    p.seg(-h + 25, h - 32, W, '#f5c430', { gloss: false });
    p.rect(-h + 26, h - 33, -W * 0.18, -W * 0.08, 'rgba(255,255,255,0.4)', false);
    p.rect(-h + 26, h - 33, W * 0.14, W * 0.24, 'rgba(160,100,0,0.35)', false);
    // sharpened end
    ctx.beginPath();
    ctx.moveTo(h - 33, -W / 2); ctx.lineTo(h - 8, -W * 0.18);
    ctx.lineTo(h - 8, W * 0.18); ctx.lineTo(h - 33, W / 2);
    ctx.quadraticCurveTo(h - 36, 0, h - 33, -W / 2); ctx.closePath();
    ctx.fillStyle = '#e8c79a'; ctx.fill();
    if (!p.real) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(h - 9, -W * 0.2); ctx.lineTo(h, 0); ctx.lineTo(h - 9, W * 0.2); ctx.closePath();
    ctx.fillStyle = '#3b3f48'; ctx.fill();
  },
  highlighter(ctx, L, W, p) {
    const h = L / 2;
    p.seg(-h, h - 52, W, '#e9f04a', { rl: 8, rr: 2 });
    p.rect(-h + 18, -h + 70, -W * 0.22, W * 0.22, 'rgba(60,70,20,0.35)', false);
    p.seg(h - 54, h - 12, W * 0.96, '#c7d62b', { rl: 2, rr: 5, alpha: 0.95 });
    p.rect(h - 50, h - 18, -2.5, 2.5, 'rgba(255,255,255,0.5)', false);
    ctx.beginPath();
    ctx.moveTo(h - 13, -W * 0.3); ctx.lineTo(h, -W * 0.1); ctx.lineTo(h, W * 0.2); ctx.lineTo(h - 13, W * 0.3); ctx.closePath();
    ctx.fillStyle = '#f2e92c'; ctx.fill();
    if (!p.real) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
  },
};

/**
 * Draw a pen centred at (0,0), pointing to +x.
 * opts: { look, tag, tagColor, alpha }
 */
export function drawPen(ctx, pen, opts = {}) {
  const L = pen.len, W = pen.wid;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.lineJoin = 'round';
  const p = painter(ctx, opts.look || 'classic');
  (PEN_DRAW[pen.id] || PEN_DRAW.ballpoint)(ctx, L, W, p);
  if (opts.tag) {
    const tw = Math.max(18, opts.tag.length * 7.5 + 8), th = Math.min(W - 3, 13);
    ctx.save();
    ctx.translate(-8, 0);
    if (opts.angle !== undefined && Math.cos(opts.angle) < 0) ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-tw / 2, -th / 2, tw, th, 3) : ctx.rect(-tw / 2, -th / 2, tw, th);
    ctx.fillStyle = opts.tagColor || '#e8742c';
    ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(43,52,69,0.8)'; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${th * 0.78}px Nunito, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.tag, 0, 0.5);
    ctx.restore();
  }
  ctx.restore();
}

export function drawPenShadow(ctx, pen, lift = 1) {
  ctx.save();
  ctx.translate(4 * lift, 7 * lift);
  ctx.fillStyle = `rgba(40,20,5,${0.28 / lift})`;
  ctx.filter = 'blur(3px)';
  rr(ctx, -pen.len / 2, pen.len / 2, pen.wid * 0.9, pen.wid / 2, pen.wid / 2);
  ctx.fill();
  ctx.restore();
}

export function capsulePath(ctx, len, wid, pad = 0) {
  rr(ctx, -len / 2 - pad, len / 2 + pad, wid + pad * 2, wid / 2 + pad, wid / 2 + pad);
}

/** Small pen picture for lists. */
export function penThumb(canvas, pen, look) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 90, h = canvas.clientHeight || 28;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.12);
  const s = (w - 6) / pen.len;
  ctx.scale(s, s);
  drawPen(ctx, pen, { look });
}

/**
 * A classroom bench top for the menu background: varnished planks with
 * seams, a pencil groove, an inkwell hole, carvings and ink stains.
 */
export function makeSchoolDesk(w = 1400, h = 860) {
  const key = 'schooldesk' + w + 'x' + h;
  if (woodCache.has(key)) return woodCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = makeWood('school', w, Math.round(h * 0.6));
  const rnd = mulberry(77);
  const s = w / 1200;

  // three planks, each cut from a different part of the wood
  const cuts = [0, 0.37, 0.71, 1];
  for (let i = 0; i < 3; i++) {
    const y0 = Math.round(cuts[i] * h), y1 = Math.round(cuts[i + 1] * h), bh = y1 - y0;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, w, bh); ctx.clip();
    if (i === 1) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    const srcY = Math.min(tex.height - Math.min(bh, tex.height), [0, 60, 25][i] * s);
    ctx.drawImage(tex, 0, srcY, w, Math.min(bh, tex.height), 0, y0, w, bh);
    ctx.restore();
    // each plank a slightly different tone
    ctx.fillStyle = ['rgba(255,220,170,0.05)', 'rgba(60,30,10,0.06)', 'rgba(255,200,140,0.03)'][i];
    ctx.fillRect(0, y0, w, bh);
  }

  // seams between the planks
  const seam = (y) => {
    const g = ctx.createLinearGradient(0, y - 12 * s, 0, y);
    g.addColorStop(0, 'rgba(40,18,6,0)'); g.addColorStop(1, 'rgba(40,18,6,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, y - 12 * s, w, 12 * s);
    ctx.fillStyle = 'rgba(30,14,4,0.85)'; ctx.fillRect(0, y - 1.5 * s, w, 3 * s);
    ctx.fillStyle = 'rgba(255,230,190,0.22)'; ctx.fillRect(0, y + 1.5 * s, w, 1.5 * s);
  };
  seam(cuts[1] * h); seam(cuts[2] * h);
  // a butt joint and screws
  const jx = w * 0.64, jy0 = cuts[1] * h, jy1 = cuts[2] * h;
  ctx.fillStyle = 'rgba(30,14,4,0.8)'; ctx.fillRect(jx - 1.5 * s, jy0, 3 * s, jy1 - jy0);
  ctx.fillStyle = 'rgba(255,230,190,0.18)'; ctx.fillRect(jx + 1.5 * s, jy0, 1.5 * s, jy1 - jy0);
  const screw = (x, y) => {
    const r = 6 * s;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, '#d9d4c8'); g.addColorStop(1, '#6d665a');
    ctx.fillStyle = 'rgba(30,14,4,0.5)'; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, r + 1, 0, 7); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(40,36,30,0.8)'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.6, y + r * 0.2); ctx.stroke();
  };
  const m = 40 * s, sy1 = cuts[1] * h + 24 * s, sy2 = cuts[2] * h + 24 * s;
  [[m, sy1], [w - m, sy1], [m, sy2], [w - m, sy2], [jx - 22 * s, (jy0 + jy1) / 2], [jx + 22 * s, (jy0 + jy1) / 2]]
    .forEach(([x, y]) => screw(x, y));

  // pencil groove along the top
  const gy = h * 0.075, gh = 30 * s, gx0 = w * 0.1, gx1 = w * 0.8;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(gx0, gy - gh / 2, gx1 - gx0, gh, gh / 2);
  const gg = ctx.createLinearGradient(0, gy - gh / 2, 0, gy + gh / 2);
  gg.addColorStop(0, 'rgba(40,18,6,0.75)'); gg.addColorStop(0.55, 'rgba(70,36,14,0.45)'); gg.addColorStop(1, 'rgba(255,225,180,0.25)');
  ctx.fillStyle = gg; ctx.fill();
  ctx.clip();
  // a pencil and a ballpoint resting in the groove
  ctx.save(); ctx.translate(gx0 + (gx1 - gx0) * 0.3, gy + 2 * s); ctx.scale(s * 1.25, s * 1.25); ctx.rotate(0.01);
  ctx.fillStyle = 'rgba(20,8,2,0.35)'; ctx.fillRect(-104, 4, 210, 6);
  drawPen(ctx, { id: 'pencil', len: 212, wid: 14 }, { look: 'real' });
  ctx.restore();
  ctx.save(); ctx.translate(gx0 + (gx1 - gx0) * 0.72, gy + 2 * s); ctx.scale(s * 1.2, s * 1.2); ctx.rotate(Math.PI - 0.01);
  drawPen(ctx, { id: 'ballpoint', len: 200, wid: 15 }, { look: 'real' });
  ctx.restore();
  ctx.restore();

  // inkwell hole with a metal ring
  const ix = w * 0.9, iy = gy + 4 * s, ir = 20 * s;
  const ring = ctx.createRadialGradient(ix - ir * 0.4, iy - ir * 0.4, 2, ix, iy, ir * 1.35);
  ring.addColorStop(0, '#efe6cf'); ring.addColorStop(0.6, '#a59a80'); ring.addColorStop(1, '#5a5242');
  ctx.fillStyle = 'rgba(30,14,4,0.45)'; ctx.beginPath(); ctx.arc(ix + 2 * s, iy + 3 * s, ir * 1.35, 0, 7); ctx.fill();
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(ix, iy, ir * 1.3, 0, 7); ctx.fill();
  const hole = ctx.createRadialGradient(ix, iy - ir * 0.3, 1, ix, iy, ir);
  hole.addColorStop(0, '#0d0703'); hole.addColorStop(1, '#2c1a0c');
  ctx.fillStyle = hole; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(30,50,120,0.25)'; ctx.beginPath(); ctx.ellipse(ix, iy + ir * 1.9, ir * 1.6, ir * 0.7, 0.2, 0, 7); ctx.fill();

  // years of students
  decorateOldDesk(ctx, w, h, rnd);
  ctx.save();
  ctx.font = `700 ${40 * s}px Fredoka, sans-serif`;
  const carve = (txt, x, y, rot, size = 1) => {
    ctx.save(); ctx.translate(x * s, y * s); ctx.rotate(rot); ctx.scale(size, size);
    ctx.fillStyle = 'rgba(255,230,195,0.22)'; ctx.fillText(txt, 1.5 * s, 1.5 * s);
    ctx.fillStyle = 'rgba(60,30,10,0.45)'; ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  carve('PEN FIGHT CHAMP', 70, 520, -0.06, 0.8);
  carve('Roll 12', 1010, 470, 0.1, 0.7);
  carve('★', 1080, 800, 0.2, 1.3);
  // tic-tac-toe
  ctx.strokeStyle = 'rgba(60,30,10,0.42)'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  const tx = 980 * s, ty = 640 * s, ts = 22 * s;
  ctx.beginPath();
  ctx.moveTo(tx + ts, ty); ctx.lineTo(tx + ts, ty + ts * 3); ctx.moveTo(tx + ts * 2, ty); ctx.lineTo(tx + ts * 2, ty + ts * 3);
  ctx.moveTo(tx, ty + ts); ctx.lineTo(tx + ts * 3, ty + ts); ctx.moveTo(tx, ty + ts * 2); ctx.lineTo(tx + ts * 3, ty + ts * 2);
  ctx.moveTo(tx + 5 * s, ty + 5 * s); ctx.lineTo(tx + ts - 5 * s, ty + ts - 5 * s); ctx.moveTo(tx + ts - 5 * s, ty + 5 * s); ctx.lineTo(tx + 5 * s, ty + ts - 5 * s);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(tx + ts * 1.5, ty + ts * 1.5, ts * 0.32, 0, 7); ctx.stroke();
  ctx.restore();

  // the rounded front edge
  const eh = 34 * s;
  const eg = ctx.createLinearGradient(0, h - eh, 0, h);
  eg.addColorStop(0, 'rgba(255,225,180,0.25)'); eg.addColorStop(0.25, 'rgba(255,225,180,0)'); eg.addColorStop(0.6, 'rgba(50,22,6,0.35)'); eg.addColorStop(1, 'rgba(30,12,2,0.75)');
  ctx.fillStyle = eg; ctx.fillRect(0, h - eh, w, eh);

  // varnish shine and a soft vignette
  const sh = ctx.createLinearGradient(0, 0, w, h);
  sh.addColorStop(0, 'rgba(255,245,220,0)'); sh.addColorStop(0.42, 'rgba(255,245,220,0.10)'); sh.addColorStop(0.5, 'rgba(255,245,220,0.02)'); sh.addColorStop(1, 'rgba(255,245,220,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,12,2,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

  woodCache.set(key, c);
  return c;
}

export { mulberry };
