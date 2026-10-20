// Pen catalogue. Shared by the browser and the server.
// len/wid are in world units (the desk is 1000 x 600).
// power: launch speed multiplier. density: weight in collisions.
// roll: how far it rolls on a side flick (higher = rolls further).
// slide: friction when it slides along its own axis (higher = stops sooner).
// bounce: restitution when pens hit each other.

export const PENS = [
  {
    id: 'ballpoint', name: 'Cheap Ballpoint', bn: 'সস্তা বলপেন',
    desc: 'Long barrel. Smooth side flicks.', descBn: 'লম্বা বডি। পাশ থেকে মারলে মসৃণ গড়ায়।',
    len: 200, wid: 15, density: 1.0, power: 1.0, roll: 1.0, slide: 1.0, bounce: 0.5,
  },
  {
    id: 'gel', name: 'Gel Pen', bn: 'জেল পেন',
    desc: 'Rubber grip. Steady and accurate.', descBn: 'রাবার গ্রিপ। স্থির আর নিখুঁত।',
    len: 186, wid: 17, density: 1.1, power: 0.98, roll: 0.9, slide: 1.1, bounce: 0.45,
  },
  {
    id: 'click', name: 'Click Pen', bn: 'ক্লিক পেন',
    desc: 'Springy. Hits a bit harder.', descBn: 'স্প্রিং আছে। একটু জোরে মারে।',
    len: 180, wid: 18, density: 1.12, power: 1.06, roll: 0.95, slide: 1.0, bounce: 0.6,
  },
  {
    id: 'fourcolor', name: '4-Colour Pen', bn: '৪-রঙা পেন',
    desc: 'Fat and heavy. Hard to push off.', descBn: 'মোটা আর ভারী। ফেলা কঠিন।',
    len: 176, wid: 25, density: 1.45, power: 0.94, roll: 0.8, slide: 1.15, bounce: 0.35,
  },
  {
    id: 'fountain', name: 'Fountain Pen', bn: 'ফাউন্টেন পেন',
    desc: 'Short and dense. A real tank.', descBn: 'ছোট কিন্তু ভারী। আসল ট্যাংক।',
    len: 168, wid: 21, density: 1.6, power: 0.92, roll: 0.85, slide: 1.2, bounce: 0.3,
  },
  {
    id: 'marker', name: 'Marker', bn: 'মার্কার',
    desc: 'Thick body. Rolls very far.', descBn: 'মোটা বডি। অনেক দূর গড়ায়।',
    len: 166, wid: 27, density: 1.2, power: 1.0, roll: 1.25, slide: 1.0, bounce: 0.4,
  },
  {
    id: 'pencil', name: 'Pencil', bn: 'পেন্সিল',
    desc: 'Light and long. Fast but jumpy.', descBn: 'হালকা আর লম্বা। দ্রুত কিন্তু লাফায়।',
    len: 212, wid: 14, density: 0.8, power: 1.1, roll: 0.75, slide: 0.95, bounce: 0.65,
  },
  {
    id: 'highlighter', name: 'Highlighter', bn: 'হাইলাইটার',
    desc: 'Flat sides. Barely rolls.', descBn: 'চ্যাপ্টা বডি। প্রায় গড়ায় না।',
    len: 158, wid: 28, density: 1.25, power: 0.97, roll: 0.6, slide: 1.05, bounce: 0.4,
  },
];

export const MAX_LEVEL = 5;
export const WINS_PER_LEVEL = 3;

export function penById(id) {
  return PENS.find((p) => p.id === id) || PENS[0];
}

export function levelFromWins(wins) {
  return Math.min(MAX_LEVEL, 1 + Math.floor((wins || 0) / WINS_PER_LEVEL));
}

// Stats used by the physics for a pen at a given level.
export function penStats(id, level = 1) {
  const p = penById(id);
  const lv = Math.max(1, Math.min(MAX_LEVEL, level | 0)) - 1;
  return {
    id: p.id,
    len: p.len,
    wid: p.wid,
    density: p.density * (1 + lv * 0.03),
    power: p.power * (1 + lv * 0.035),
    roll: p.roll,
    slide: p.slide,
    bounce: p.bounce,
    level: lv + 1,
  };
}

// 0..1 bars for the pen info card.
export function penBars(id) {
  const p = penById(id);
  const norm = (v, a, b) => Math.max(0.08, Math.min(1, (v - a) / (b - a)));
  return {
    power: norm(p.power, 0.85, 1.12),
    weight: norm(p.density * p.wid * p.len, 2000, 6600),
    roll: norm(p.roll, 0.5, 1.3),
    length: norm(p.len, 150, 215),
  };
}
