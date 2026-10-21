// Small synthesized sound effects (no audio files).
let ctx = null;
let enabled = true;
let noiseBuf = null;

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { freq = 2000, q = 1, vol = 0.3, type = 'bandpass', delay = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t); s.stop(t + dur + 0.02);
}

export const sfx = {
  setEnabled(v) { enabled = !!v; },
  unlock() { ac(); },
  click() { tone(900, 0.05, { type: 'triangle', vol: 0.08 }); },
  grab() { tone(420, 0.06, { type: 'triangle', vol: 0.1, slide: 1.4 }); },
  flick(power) {
    noise(0.12 + power * 0.1, { freq: 1800 + power * 2000, q: 0.8, vol: 0.12 + power * 0.25 });
    tone(220 + power * 200, 0.08, { type: 'triangle', vol: 0.15 });
  },
  hit(s) {
    const v = Math.min(1, s / 10);
    tone(1400 + Math.random() * 400, 0.06, { type: 'square', vol: 0.05 + v * 0.12 });
    noise(0.05 + v * 0.06, { freq: 3500, q: 2, vol: 0.15 + v * 0.35 });
    tone(320, 0.09, { type: 'triangle', vol: 0.1 + v * 0.15, slide: 0.6 });
  },
  bump(s) {
    const v = Math.min(1, s / 10);
    tone(240 + Math.random() * 60, 0.07, { type: 'triangle', vol: 0.1 + v * 0.2, slide: 0.7 });
    noise(0.04 + v * 0.04, { freq: 900, q: 1.5, vol: 0.12 + v * 0.25, type: 'lowpass' });
  },
  badge() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.16, { type: 'sine', vol: 0.12, delay: i * 0.07 })); },
  fall() {
    tone(520, 0.45, { type: 'sine', vol: 0.18, slide: 0.35 });
    noise(0.12, { freq: 500, q: 1, vol: 0.4, type: 'lowpass', delay: 0.42 });
    tone(140, 0.12, { type: 'triangle', vol: 0.3, delay: 0.42 });
  },
  shrink() {
    tone(300, 0.25, { type: 'sawtooth', vol: 0.05, slide: 0.6 });
    noise(0.3, { freq: 600, vol: 0.12, type: 'lowpass' });
  },
  turn() { tone(660, 0.08, { type: 'sine', vol: 0.08 }); tone(880, 0.1, { type: 'sine', vol: 0.08, delay: 0.08 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.16, delay: i * 0.11 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.16 })); },
  round() { tone(784, 0.12, { type: 'triangle', vol: 0.14 }); tone(1047, 0.18, { type: 'triangle', vol: 0.14, delay: 0.12 }); },
  tick() { tone(1200, 0.03, { type: 'square', vol: 0.04 }); },
  pop() { tone(600, 0.08, { type: 'sine', vol: 0.15, slide: 2 }); },
};
