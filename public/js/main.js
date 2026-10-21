// App controller: screens, settings, match flow for all three modes.
import { PENS, penById, penBars, MAX_LEVEL, WINS_PER_LEVEL } from '/shared/pens.js';
import { createMatch, playShot, startNextRound, snapshot, restore } from '/shared/game.js';
import { store } from './storage.js';
import { sfx } from './audio.js';
import { t, setLang, applyI18n, num } from './i18n.js';
import { GameView } from './game.js';
import { chooseShot } from './ai.js';
import { makeWood, makeSchoolDesk, drawPen, drawPenShadow, penThumb } from './render.js';
import { BADGES, badgeIcon, evaluate, dailyFor, dailyDone, dailyStreak } from './progress.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = store.data;
const S = D.settings;
const AI_LEVEL_LV = { easy: 1, normal: 3, hard: 5 };

// ---------- helpers ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// badges and daily challenge news, one after another
const notes = [];
let noteBusy = false;
function note(msg) { notes.push(msg); if (!noteBusy) nextNote(); }
function nextNote() {
  const m = notes.shift();
  if (!m) { noteBusy = false; return; }
  noteBusy = true;
  toast(m, 2400);
  sfx.badge();
  setTimeout(nextNote, 2700);
}

function fmtDur(ms) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return t('sec', { n: num(s) });
  const m = Math.floor(s / 60), r = s % 60;
  return m < 60 ? `${num(m)}:${num(String(r).padStart(2, '0'))}` : `${num(Math.floor(m / 60))}h ${num(m % 60)}m`;
}
function fmtHours(ms) {
  const m = Math.floor(ms / 60000);
  return `${num(Math.floor(m / 60))}:${num(String(m % 60).padStart(2, '0'))}`;
}
function fmtK(n) {
  if (n >= 1e6) return num((n / 1e6).toFixed(1)) + 'M';
  if (n >= 1e3) return num((n / 1e3).toFixed(1)) + 'k';
  return num(n);
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('justNow');
  const v = m < 60 ? `${num(m)}m` : m < 1440 ? `${num(Math.round(m / 60))}h` : `${num(Math.round(m / 1440))}d`;
  return t('ago', { t: v });
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const penName = (id) => { const p = penById(id); return document.documentElement.lang === 'bn' ? p.bn : p.name; };
const penDesc = (id) => { const p = penById(id); return document.documentElement.lang === 'bn' ? p.descBn : p.desc; };
const myName = () => D.name || t('you');

async function api(path, body) {
  try {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch { return null; }
}

// ---------- theme / settings ----------
let bgDone = false;
function applySettings() {
  const root = document.documentElement;
  if (S.theme === 'system') delete root.dataset.theme; else root.dataset.theme = S.theme;
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.dark = dark ? '1' : '0';
  setLang(S.lang);
  applyI18n();
  document.body.classList.toggle('reduce-motion', !!S.reduceMotion);
  sfx.setEnabled(S.sound);
  $$('[data-setting]').forEach((g) => $$('button', g).forEach((b) => b.classList.toggle('on', b.dataset.v === S[g.dataset.setting])));
  $$('[data-toggle]').forEach((i) => { i.checked = !!S[i.dataset.toggle]; });
  $('#toggle-fullscreen').checked = !!document.fullscreenElement;
  $$('#look-seg button').forEach((b) => b.classList.toggle('on', b.dataset.look === S.look));
  // background wood
  try {
    if (!bgDone) {
      bgDone = true;
      const paint = () => { $('#bg').style.backgroundImage = `url(${makeSchoolDesk().toDataURL('image/jpeg', 0.85)})`; };
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(paint, paint);
    }
  } catch { /* ignore */ }
  refreshTexts();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);

function refreshTexts() {
  const played = D.vsc.played + D.two.played + D.online.played;
  $('#home-played').textContent = played ? t('playedN', { n: num(played) }) : '';
  renderDaily();
  if (current === 'pick') renderPick();
  if (current === 'board') renderBoard();
  if (current === 'stats') renderStats();
  if (current === 'game') updateHud();
  renderHelp();
}

// ---------- screens ----------
let current = 'home';
const stack = [];
function go(name, { replace = false } = {}) {
  if (name === current) return;
  if (!replace) stack.push(current);
  $(`#s-${current}`).classList.remove('active');
  current = name;
  $(`#s-${name}`).classList.add('active');
  onEnter(name);
}
function back() {
  const prev = stack.pop() || 'home';
  $(`#s-${current}`).classList.remove('active');
  current = prev;
  $(`#s-${prev}`).classList.add('active');
  onEnter(prev);
}
function home() {
  stack.length = 0;
  $(`#s-${current}`).classList.remove('active');
  current = 'home';
  $('#s-home').classList.add('active');
  onEnter('home');
}
function onEnter(name) {
  heroRun = name === 'home';
  previewRun = name === 'pick';
  if (name === 'home') { refreshTexts(); startHero(); pingOnline(); }
  if (name === 'mode') pingOnline();
  if (name === 'pick') { renderPick(); startPreview(); }
  if (name === 'board') renderBoard();
  if (name === 'stats') renderStats();
  if (name !== 'game') { view.stop(); }
  landscape(name === 'game');
}

// ---------- phones: full screen + landscape while a match is on ----------
// Needs a tap, so if the first try is blocked (online match started by the server)
// it tries again on the next tap. iPhone has no lock API and keeps the turned desk.
const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
let wantLand = false, landRetry = false;
function landscape(on) {
  wantLand = on && isPhone;
  if (wantLand) { landRetry = !tryLandscape(); return; }
  landRetry = false;
  try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function tryLandscape() {
  const el = document.documentElement;
  if (!el.requestFullscreen) return true;
  if (navigator.userActivation && !navigator.userActivation.isActive) return false;
  const p = document.fullscreenElement ? Promise.resolve() : el.requestFullscreen({ navigationUI: 'hide' });
  p.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  return true;
}
document.addEventListener('pointerup', () => {
  if (wantLand && landRetry) landRetry = !tryLandscape();
}, true);

$$('[data-go]').forEach((b) => b.addEventListener('click', () => { sfx.click(); go(b.dataset.go); }));
$$('[data-back]').forEach((b) => b.addEventListener('click', () => { sfx.click(); back(); }));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = $('.modal.open');
  if (open) { closeModal(open.id); return; }
  if (current === 'game') openModal('m-pause');
  else if (current !== 'home' && current !== 'wait') back();
});

// ---------- modals ----------
function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }
$$('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'm-result') closeModal(m.id); });
  $$('[data-close]', m).forEach((b) => b.addEventListener('click', () => { sfx.click(); closeModal(m.id); }));
});
$$('[data-act="settings"]').forEach((b) => b.addEventListener('click', () => { sfx.click(); drawDeskThumbs(); openModal('m-settings'); }));
$$('[data-act="help"]').forEach((b) => b.addEventListener('click', () => { sfx.click(); openModal('m-help'); }));

// settings controls
$$('[data-setting]').forEach((g) => $$('button', g).forEach((b) => b.addEventListener('click', () => {
  sfx.click();
  store.setting(g.dataset.setting, b.dataset.v);
  applySettings();
})));
$$('[data-toggle]').forEach((i) => i.addEventListener('change', () => {
  store.setting(i.dataset.toggle, i.checked);
  applySettings();
  sfx.click();
}));
$('#toggle-fullscreen').addEventListener('change', async (e) => {
  try {
    if (e.target.checked) await document.documentElement.requestFullscreen();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch { e.target.checked = !!document.fullscreenElement; }
});
document.addEventListener('fullscreenchange', () => { $('#toggle-fullscreen').checked = !!document.fullscreenElement; });

function drawDeskThumbs() {
  $$('.desk-thumb').forEach((c) => {
    const ctx = c.getContext('2d');
    ctx.drawImage(makeWood(c.dataset.desk, 300, 180), 0, 40, 300, 140, 0, 0, c.width, c.height);
  });
}

function textModal(title, sub, value, okText, onOk) {
  $('#text-title').textContent = title;
  $('#text-sub').textContent = sub;
  const ta = $('#text-area');
  ta.value = value;
  ta.readOnly = !onOk;
  $('#text-ok').textContent = okText;
  $('#text-ok').onclick = () => {
    if (onOk) onOk(ta.value);
    else { navigator.clipboard?.writeText(ta.value).then(() => toast(t('copied')), () => { ta.select(); }); }
  };
  openModal('m-text');
  if (!onOk) setTimeout(() => ta.select(), 50);
}
$('#btn-backup').addEventListener('click', () => textModal(t('backupTitle'), t('backupSub'), store.exportCode(), t('copy')));
$('#btn-restore').addEventListener('click', () => textModal(t('restoreTitle'), t('restoreSub'), '', t('restore'), (v) => {
  try { store.importCode(v); closeModal('m-text'); toast(t('restoreOk')); location.reload(); } catch { toast(t('restoreBad')); }
}));
$('#btn-reset').addEventListener('click', () => {
  if (confirm(t('resetConfirm'))) { store.reset(); toast(t('resetDone')); refreshTexts(); }
});

// ---------- help ----------
const ILLUS = {
  goal: '<svg class="illus" viewBox="0 0 200 110"><rect x="30" y="20" width="120" height="74" rx="12" fill="#e5c697" stroke="#2b3445" stroke-width="3"/><rect x="58" y="52" width="56" height="10" rx="5" transform="rotate(-14 86 57)" fill="#3f7fd0" stroke="#2b3445" stroke-width="2.5"/><g transform="rotate(30 160 30)"><rect x="130" y="25" width="56" height="10" rx="5" fill="#e8742c" stroke="#2b3445" stroke-width="2.5"/></g><path d="M170 66q4 8 0 16M178 70q4 8 0 14" fill="none" stroke="#2b3445" stroke-width="2.5" stroke-dasharray="3 4" stroke-linecap="round"/></svg>',
  flick: '<svg class="illus" viewBox="0 0 200 110"><rect x="30" y="16" width="140" height="80" rx="12" fill="#e5c697" stroke="#2b3445" stroke-width="3"/><path d="M60 78 92 58" stroke="#2b3445" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/><circle cx="58" cy="79" r="4" fill="#2b3445"/><rect x="92" y="48" width="50" height="11" rx="5.5" transform="rotate(-24 92 54)" fill="#3f7fd0" stroke="#2b3445" stroke-width="2.5"/><circle cx="94" cy="57" r="6" fill="#f5cf55" stroke="#2b3445" stroke-width="2.5"/><path d="M118 40 150 22" stroke="#2b3445" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/></svg>',
  shrink: '<svg class="illus" viewBox="0 0 200 110"><rect x="20" y="12" width="160" height="88" rx="12" fill="#e5c697" stroke="#2b3445" stroke-width="3"/><rect x="48" y="28" width="104" height="56" rx="8" fill="none" stroke="#d63a28" stroke-width="3" stroke-dasharray="8 6"/><path d="M34 22l12 10M166 22l-12 10M34 90l12-10M166 90l-12-10" stroke="#2b3445" stroke-width="3" stroke-linecap="round"/></svg>',
};
function renderHelp() {
  const items = t('help');
  if (!Array.isArray(items)) return;
  $('#help-body').innerHTML = items.map(([title, ill, paras, ordered], i) => `
    <div class="acc${i === 0 ? ' open' : ''}"><button><span>${esc(title)}</span><i>⌄</i></button>
      <div class="acc-body">${ill ? ILLUS[ill] : ''}${ordered ? `<ol>${paras.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`).join('') +
    `<div class="stack"><button class="btn btn-tile wide" id="btn-practice" style="background:var(--green)"><svg><use href="#i-repeat"/></svg><span>${esc(t('tutorialAgain'))}</span></button>
     <div class="muted tiny center">${esc(t('tutorialSub'))}</div>
     <button class="btn btn-tile wide" data-close-help><svg><use href="#i-back"/></svg><span>${esc(t('back'))}</span></button></div>`;
  $$('#help-body .acc > button').forEach((b) => b.addEventListener('click', () => { sfx.click(); b.parentElement.classList.toggle('open'); }));
  $('#btn-practice').addEventListener('click', () => {
    closeModal('m-help'); closeModal('m-pause');
    if (M) quitMatch(true);
    pick.mode = 'vsc';
    startOffline({ practice: true });
  });
  $('[data-close-help]').addEventListener('click', () => closeModal('m-help'));
}

// ---------- home hero ----------
let heroRun = true, heroGen = 0;
function startHero() {
  const gen = ++heroGen;
  const c = $('#hero');
  const ctx = c.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = 520 * dpr; c.height = 260 * dpr;
  const a = penById('ballpoint'), b = penById('click');
  const t0 = performance.now();
  const loop = (now) => {
    if (!heroRun || gen !== heroGen) return;
    const tt = ((now - t0) / 1000) % 3.2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 520, 260);
    const hitT = 0.9;
    const k = Math.min(1, tt / hitT);
    const ease = 1 - Math.pow(1 - k, 3);
    const after = Math.max(0, tt - hitT);
    const reduce = S.reduceMotion;
    // blue pen gets hit and slides
    const bx = 330 + (reduce ? 0 : after * 18 * Math.exp(-after)), by = 105 - (reduce ? 0 : after * 10 * Math.exp(-after));
    const ba = -0.28 + (reduce ? 0 : after * 0.35 * Math.exp(-after * 1.2));
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ba); ctx.scale(1.2, 1.2); drawPenShadow(ctx, b); drawPen(ctx, b, { look: S.look }); ctx.restore();
    // orange pen flies in
    const ax = reduce ? 225 : 150 + ease * 75, ay = reduce ? 160 : 210 - ease * 50;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(-0.62); ctx.scale(1.2, 1.2);
    if (!reduce && k < 1) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-160, -6, 70, 12);
      ctx.globalAlpha = 1;
    }
    drawPenShadow(ctx, a); drawPen(ctx, a, { look: S.look }); ctx.restore();
    // spark
    if (tt > hitT - 0.05 && tt < hitT + 0.5 || reduce) {
      const sk = reduce ? 0.5 : (tt - hitT + 0.05) / 0.55;
      ctx.save(); ctx.translate(292, 112);
      ctx.strokeStyle = `rgba(255,240,190,${1 - sk})`; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(an) * (10 + sk * 12), Math.sin(an) * (10 + sk * 12)); ctx.lineTo(Math.cos(an) * (18 + sk * 22), Math.sin(an) * (18 + sk * 22)); ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,220,120,${0.6 * (1 - sk)})`;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------- mode ----------
const pick = { mode: 'vsc', slot: 0 };
$$('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  sfx.click();
  pick.mode = b.dataset.mode;
  pick.slot = 0;
  go('pick');
}));

let onlineCount = 0;
async function pingOnline() {
  const s = await api('/api/stats');
  onlineCount = s ? s.online : 0;
  $('#online-now').textContent = s && s.online > 0 ? t('onlineNow', { n: num(s.online) }) : '';
  $('#mode-online-count').textContent = !hasSocket() ? t('serverHint') : s ? t('onlineNow', { n: num(s.online) }) : '';
}

// ---------- pick ----------
function slotPen(i) { return i === 0 ? D.pen : D.pen2; }
function setSlotPen(i, id) { store.set(i === 0 ? 'pen' : 'pen2', id); }

function renderPick() {
  const sec = $('#s-pick');
  sec.dataset.mode = pick.mode;
  const chip = $('#pick-mode-chip');
  chip.innerHTML = `<svg><use href="#${pick.mode === 'vsc' ? 'i-bot' : pick.mode === 'two' ? 'i-two' : 'i-globe'}"/></svg>${esc(t(pick.mode === 'vsc' ? 'vsComputerChip' : pick.mode === 'two' ? 'twoChip' : 'onlineChip'))}`;
  const id = slotPen(pick.mode === 'two' ? pick.slot : 0);
  const idx = PENS.findIndex((p) => p.id === id);
  $('#pen-dots').innerHTML = PENS.map((p, i) => `<i class="${i === idx ? 'on' : ''}" data-i="${i}"></i>`).join('');
  $$('#pen-dots i').forEach((d) => d.addEventListener('click', () => choosePen(+d.dataset.i)));
  $('#pen-name').textContent = penName(id);
  $('#pen-desc').textContent = penDesc(id);
  const lv = store.penLevel(id);
  const lvEl = $('#pen-lv');
  lvEl.textContent = 'Lv' + lv;
  lvEl.classList.toggle('dim', pick.mode === 'online' || D.equal);
  $('#name-input').value = pick.mode === 'two' ? (D.name || t('player1')) : D.name;
  $('#name-input').placeholder = pick.mode === 'two' ? t('player1') : pick.mode === 'online' ? D.guest : t('you');
  $('#name-input-2').value = D.name2 || t('player2');
  $('#slot-name-0').textContent = D.name || t('player1');
  $('#slot-name-1').textContent = D.name2 || t('player2');
  $('#slot-pen-0').textContent = penName(D.pen);
  $('#slot-pen-1').textContent = penName(D.pen2);
  $$('.slot').forEach((s) => s.classList.toggle('active', +s.dataset.slot === pick.slot));
  $$('#level-seg button').forEach((b) => b.classList.toggle('on', b.dataset.level === D.level));
  $$('#rounds-seg button').forEach((b) => b.classList.toggle('on', +b.dataset.rounds === D.rounds));
  $('#opt-equal').checked = D.equal;
  $('#opt-mirror').checked = D.mirror;
  $('#rule-equal').classList.toggle('on', D.equal);
  $('#rule-mirror').classList.toggle('on', D.mirror);
  $('#opt-clutter').checked = D.clutter;
  $('#rule-clutter').classList.toggle('on', D.clutter);
  $('#clutter-sub').textContent = t(pick.mode === 'online' ? 'clutterRoom' : 'clutterSub');
  $('#equal-sub').textContent = D.equal ? t('equalOn') : t('equalOff');
  $('#online-status').textContent = hasSocket() ? '' : t('noServer');
  $$('#look-seg button').forEach((b) => b.classList.toggle('on', b.dataset.look === S.look));
  previewPen = id;
}

function choosePen(i) {
  const n = PENS.length;
  const id = PENS[((i % n) + n) % n].id;
  setSlotPen(pick.mode === 'two' ? pick.slot : 0, id);
  previewSwap = performance.now();
  sfx.click();
  renderPick();
}
function stepPen(d) {
  const id = slotPen(pick.mode === 'two' ? pick.slot : 0);
  choosePen(PENS.findIndex((p) => p.id === id) + d);
}
$('#pen-prev').addEventListener('click', () => stepPen(-1));
$('#pen-next').addEventListener('click', () => stepPen(1));
{
  let sx = null;
  const st = $('.pen-stage');
  st.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; sx = e.clientX; });
  st.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) stepPen(e.clientX < sx ? 1 : -1); sx = null; });
}
$$('.slot').forEach((s) => s.addEventListener('click', () => { pick.slot = +s.dataset.slot; sfx.click(); renderPick(); }));
$('#name-input').addEventListener('input', (e) => { store.set('name', e.target.value.trim().slice(0, 16)); $('#slot-name-0').textContent = D.name || t('player1'); });
$('#name-input-2').addEventListener('input', (e) => { store.set('name2', e.target.value.trim().slice(0, 16)); $('#slot-name-1').textContent = D.name2 || t('player2'); });
$('#name-input-2').addEventListener('focus', () => { pick.slot = 1; renderPick(); });
$$('#level-seg button').forEach((b) => b.addEventListener('click', () => { store.set('level', b.dataset.level); sfx.click(); renderPick(); }));
$$('#rounds-seg button').forEach((b) => b.addEventListener('click', () => { store.set('rounds', +b.dataset.rounds); sfx.click(); renderPick(); }));
$('#opt-equal').addEventListener('change', (e) => { store.set('equal', e.target.checked); renderPick(); });
$('#opt-mirror').addEventListener('change', (e) => { store.set('mirror', e.target.checked); renderPick(); });
$('#opt-clutter').addEventListener('change', (e) => { store.set('clutter', e.target.checked); renderPick(); });
$$('#look-seg button').forEach((b) => b.addEventListener('click', () => { store.setting('look', b.dataset.look); sfx.click(); applySettings(); }));

$('#pen-info-btn').addEventListener('click', () => {
  sfx.click();
  const id = previewPen;
  const bars = penBars(id);
  const rec = D.vsc.byPen[id] || { p: 0, w: 0 };
  const lv = store.penLevel(id);
  const toNext = lv >= MAX_LEVEL ? t('maxLevel') : t('nextLevel', { n: num(WINS_PER_LEVEL - ((rec.w + (rec.bonus || 0)) % WINS_PER_LEVEL)), l: num(lv + 1) });
  $('#info-title').textContent = penName(id);
  $('#info-body').innerHTML = `<p class="muted">${esc(penDesc(id))}</p>` +
    [['power', bars.power], ['weight', bars.weight], ['roll', bars.roll], ['length', bars.length]]
      .map(([k, v]) => `<div class="bar-row"><span>${esc(t(k))}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div></div>`).join('') +
    `<div class="tiles t2" style="margin-top:14px"><div class="tile"><b>Lv${lv}</b><small>${esc(toNext)}</small></div><div class="tile"><b>${num(rec.w)}</b><small>${esc(t('winsOnPen'))}</small></div></div>`;
  openModal('m-info');
});

// pen preview animation
let previewRun = false, previewPen = D.pen, previewSwap = 0;
let previewGen = 0;
function startPreview() {
  const gen = ++previewGen;
  const c = $('#pen-preview');
  const loop = (now) => {
    if (!previewRun || gen !== previewGen) return;
    const w = c.clientWidth, h = c.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tex = makeWood(S.desk === 'old' ? 'old' : 'clean', 900, 540);
    const sc = Math.max(w / tex.width, h / tex.height);
    ctx.drawImage(tex, (w - tex.width * sc) / 2, (h - tex.height * sc) / 2, tex.width * sc, tex.height * sc);
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, 'rgba(255,240,210,0.25)'); g.addColorStop(1, 'rgba(60,30,10,0.25)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const pen = penById(previewPen);
    const k = Math.min(1, (now - previewSwap) / 350);
    const ease = 1 - Math.pow(1 - k, 3);
    const bob = S.reduceMotion ? 0 : Math.sin(now / 700) * 3;
    const scale = (Math.min(w, h * 1.6) / pen.len) * 0.78 * (0.85 + 0.15 * ease);
    ctx.save();
    ctx.translate(w / 2, h / 2 + bob);
    ctx.rotate(-0.62 + (S.reduceMotion ? 0 : Math.sin(now / 1300) * 0.03) + (1 - ease) * 0.4);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.3 + 0.7 * ease;
    drawPenShadow(ctx, pen, 1.6);
    drawPen(ctx, pen, { look: S.look });
    ctx.restore();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------- the match ----------
const view = new GameView($('#game'), {
  settings: () => S,
  onShot: (shot) => onLocalShot(shot),
  onAim: (aim) => sendAim(aim),
  onPower: (p) => {
    const el = $('#power');
    if (p === null) { el.classList.remove('show'); return; }
    el.classList.add('show');
    $('#power-fill').style.width = Math.round(p * 100) + '%';
    $('#power-val').textContent = num(Math.round(p * 100)) + '%';
  },
  onShrink: () => banner(t('deskShrinks')),
});

let M = null; // current match session

// ---------- resume after a page refresh (this tab only) ----------
const RESUME_KEY = 'penfight.resume';
function saveResume() {
  if (!M || M.match.over) { clearResume(); return; }
  const r = M.mode === 'online'
    ? { mode: 'online', code: M.code }
    : { mode: M.mode, level: M.level, players: M.players, startedAt: M.startedAt, practice: M.practice, state: snapshot(M.match) };
  try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(r)); } catch { /* storage blocked */ }
}
function clearResume() { try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } }
function readResume() { try { return JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); } catch { return null; } }

function resumeOffline(r) {
  const match = restore(r.state);
  M = { id: Math.random(), mode: r.mode, level: r.level, match, players: r.players, startedAt: r.startedAt, practice: !!r.practice };
  if (match.roundOver) { startNextRound(match); saveResume(); }
  view.setMatch(snapshot(match), match.stats, M.players);
  enterGame(false);
  updateHud();
  banner(t('roundN', { n: num(match.round) }));
  setTimeout(() => nextTurn(M), 900);
}

function banner(text, sub) {
  const el = $('#banner');
  el.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function updateHud() {
  if (!M) return;
  const st = M.match;
  for (let i = 0; i < 2; i++) {
    $('#hs-n' + i).textContent = M.players[i].name;
    const v = $('#hs-v' + i);
    if (v.textContent !== num(st.scores[i])) { v.textContent = num(st.scores[i]); v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump'); }
  }
  $('#hs-round').innerHTML = `<span>${esc(t('roundN', { n: num(st.round) }))}</span><span>${esc(t('firstTo', { n: num(st.roundsToWin) }))}</span>`;
  const turnEl = $('#hud-turn');
  turnEl.classList.remove('p1', 'p2');
  let txt = '';
  if (M.thinking) txt = t('thinking');
  else if (!st.roundOver && !st.over) {
    const p = M.players[st.turn];
    if (M.mode === 'vsc') txt = st.turn === 0 ? t('yourTurn') : t('turnOf', { name: p.name });
    else if (M.mode === 'online') txt = st.turn === M.you ? t('yourTurn') : t('aiming', { name: p.name });
    else txt = t('turnOf', { name: p.name });
    turnEl.classList.add(st.turn === 0 ? 'p1' : 'p2');
  }
  $('#turn-text').textContent = txt;
  turnEl.style.visibility = txt ? 'visible' : 'hidden';
  $('.ring').style.display = M.mode === 'online' ? '' : 'none';
}

// turn timer ring (online)
setInterval(() => {
  if (!M || M.mode !== 'online' || !M.deadline) return;
  const left = Math.max(0, M.deadline - Date.now());
  const k = Math.min(1, left / (M.turnSeconds * 1000));
  const ring = $('#turn-ring');
  ring.style.strokeDashoffset = String(94.25 * (1 - k));
  ring.classList.toggle('low', left < 8000);
  if (left < 5000 && left > 0 && M.match.turn === M.you && !view.busy && Math.floor(left / 1000) !== M.lastTick) { M.lastTick = Math.floor(left / 1000); sfx.tick(); }
}, 200);

function enterGame(online) {
  $('#s-game').classList.toggle('online-game', !!online);
  closeModal('m-result');
  if (current !== 'game') go('game');
  view.start();
  view.resize();
}

function startOffline(opts = {}) {
  const mode = opts.practice ? 'vsc' : pick.mode;
  const level = opts.practice ? 'easy' : D.level;
  let penIds, levels, players;
  if (mode === 'vsc') {
    const others = PENS.filter((p) => p.id !== D.pen);
    const cpu = D.mirror ? D.pen : others[Math.floor(Math.random() * others.length)].id;
    penIds = [D.pen, cpu];
    levels = D.equal || opts.practice ? [1, 1] : [store.penLevel(D.pen), AI_LEVEL_LV[level]];
    players = [{ name: myName(), tag: t('you').slice(0, 3) }, { name: t('computerName'), tag: 'C' }];
  } else {
    penIds = [D.pen, D.pen2];
    levels = D.equal ? [1, 1] : [store.penLevel(D.pen), store.penLevel(D.pen2)];
    players = [{ name: D.name || t('player1'), tag: 'P1' }, { name: D.name2 || t('player2'), tag: 'P2' }];
  }
  const match = createMatch({ penIds, levels, roundsToWin: opts.practice ? 1 : D.rounds, starter: mode === 'vsc' ? 0 : Math.random() < 0.5 ? 0 : 1, clutter: !opts.practice && D.clutter });
  M = { id: Math.random(), mode, level, match, players, startedAt: Date.now(), practice: !!opts.practice };
  saveResume();
  view.setMatch(snapshot(match), match.stats, players);
  enterGame(false);
  updateHud();
  banner(t('roundN', { n: num(1) }), t('fightBang'));
  sfx.round();
  if (!D.tutorialSeen || opts.practice) { setTimeout(() => toast(t('firstHint'), 4500), 1200); store.set('tutorialSeen', true); }
  setTimeout(() => nextTurn(M), 900);
}

async function nextTurn(session) {
  if (M !== session) return;
  const st = M.match;
  updateHud();
  if (st.over || st.roundOver || M.mode === 'online') return;
  if (M.mode === 'vsc' && st.turn === 1) {
    view.setInput(-1);
    M.thinking = true;
    updateHud();
    const t0 = performance.now();
    const shot = await chooseShot(st, 1, M.level);
    await sleep(Math.max(0, 650 - (performance.now() - t0)));
    if (M !== session) return;
    M.thinking = false;
    updateHud();
    await view.animateAim(shot, 1);
    if (M !== session) return;
    await runLocalShot(session, 1, shot);
  } else {
    view.setInput(st.turn);
    if (M.mode === 'two') sfx.turn();
  }
}

function onLocalShot(shot) {
  if (!M) return;
  if (M.mode === 'online') {
    if (M.match.turn !== M.you) return;
    view.setInput(-1);
    const s = M;
    socket.timeout(5000).emit('shot', shot, (err, r) => {
      if (M !== s || s.match.over) return;
      if (err || (r && r.lost)) { reconnectSeat(); return; }
      if (r && !r.ok && r.state) queue(() => resync(r));
    });
    return;
  }
  runLocalShot(M, M.match.turn, shot);
}

async function runLocalShot(session, player, shot) {
  view.setInput(-1);
  const before = deskBefore(session.match);
  let res;
  try { res = playShot(session.match, player, shot); } catch { return; }
  keepKO(session, res, before);
  saveResume();
  await view.play(res);
  if (M !== session) return;
  await afterShot(session, res);
}

// ---------- replay, badges, daily challenge ----------
const deskBefore = (m) => ({ bodies: m.bodies.map((b) => ({ ...b })), deskScale: m.deskScale });
function keepKO(session, res, before) {
  if (res.round && res.events.some((e) => e.type === 'fall')) session.lastKO = { res, ...before };
}
function replayOpts(rec) {
  const fall = rec.res.events.find((e) => e.type === 'fall');
  const n = rec.res.frames.length - 1;
  return { from: fall.f < 110 ? 0 : fall.f - 80, to: Math.min(n, fall.f + 45), label: t('replayBadge'), hint: t('tapSkip') };
}

// which player is "you" for badges (nobody in 2 players or practice)
function meOf(session) {
  if (session.practice) return null;
  return session.mode === 'vsc' ? 0 : session.mode === 'online' ? session.you : null;
}
function trackShot(session, res) {
  const me = meOf(session);
  if (me === null) return;
  const g = (session.prog ||= { flags: {}, lostRounds: 0, firstRoundLost: false, myShots: 0, roundShots: 0 });
  if (res.shooter === me && res.shot.power > 0) { g.myShots++; g.roundShots++; }
  const r = res.round;
  if (!r) return;
  const fell = (i) => res.events.some((e) => e.type === 'fall' && e.pen === i);
  if (res.shooter === me && r.winner === me && fell(1 - me)) {
    if (Math.abs(res.shot.lx) >= 0.3) g.flags.trick = true;
    if (g.roundShots === 1) g.flags.oneShot = true;
    if (res.events.some((e) => e.type === 'bump' && e.pen === me)) g.flags.bank = true;
  }
  if (r.winner === me && res.state.deskScale <= 0.6) g.flags.tiny = true;
  if (res.shooter === me && r.winner < 0 && fell(0) && fell(1)) g.flags.kamikaze = true;
  if (r.winner === 1 - me) { g.lostRounds++; if (res.state.round === 1) g.firstRoundLost = true; }
  g.roundShots = 0;
}
// quiet: the result screen shows the news as chips instead of toasts
function checkProgress(session, won, quiet = false) {
  if (session.practice) return;
  const me = meOf(session), st = session.match, g = session.prog || {};
  const out = evaluate({
    mode: session.mode, level: session.level, pen: me === null ? null : st.penIds[me], clutter: !!st.clutter,
    roundsToWin: st.roundsToWin, won: me === null ? undefined : won, lostRounds: g.lostRounds || 0,
    firstRoundLost: !!g.firstRoundLost, myShots: g.myShots || 0, flags: g.flags || {},
  });
  (session.earned ||= []).push(...out.badges);
  if (out.daily) session.dailyDone = true;
  if (quiet) return;
  out.badges.forEach((id) => note(`${badgeIcon(id)} ${t('badgeGot', { name: t('ach_' + id) })}`));
  if (out.daily) note(`📅 ${t('dailyDoneToast', { n: num(D.daily.streak) })}`);
}

function dailyText(ch) {
  return t('dc_' + ch.k, { level: ch.level ? t(ch.level) : '', pen: ch.pen ? penName(ch.pen) : '', n: num(ch.n || 0) });
}
function renderDaily() {
  const ch = dailyFor(), done = dailyDone(), streak = dailyStreak();
  $('#daily-text').textContent = dailyText(ch);
  $('#daily-sub').textContent = done ? t('dailyDone') : t('dailyReward');
  $('#daily-side').textContent = done ? '✓' : streak ? `🔥 ${num(streak)}` : '';
  $('#daily-card').classList.toggle('done', done);
}
// get the pick screen ready for today's challenge
$('#daily-card').addEventListener('click', () => {
  sfx.click();
  const ch = dailyFor();
  if (!dailyDone()) {
    if (ch.k === 'beat') store.set('level', ch.level);
    if (ch.k === 'pen') store.set('pen', ch.pen);
    if (ch.k === 'clutter') store.set('clutter', true);
    if (ch.k === 'first3') store.set('rounds', 3);
    if (ch.k === 'flawless' && D.rounds < 2) store.set('rounds', 2);
    toast(dailyText(ch), 3500);
  }
  pick.mode = 'vsc';
  pick.slot = 0;
  go('pick');
});

async function afterShot(session, res) {
  updateHud();
  trackShot(session, res);
  if (!res.round) { nextTurn(session); return; }
  if (!res.matchOver) checkProgress(session);
  const w = res.round.winner;
  if (w < 0) { banner(t('roundDraw'), t('roundDrawSub')); sfx.lose(); }
  else {
    const youWon = (session.mode === 'vsc' && w === 0) || (session.mode === 'online' && w === session.you);
    const name = session.players[w].name;
    banner(youWon ? t('roundYou') : t('roundWin', { name }), res.round.selfOut ? t('selfOut') : '');
    youWon || session.mode === 'two' ? sfx.round() : sfx.lose();
  }
  // online rounds run on the server's clock, so there the replay waits for the end of the match
  const rec = session.lastKO && session.lastKO.res === res ? session.lastKO : null;
  if (rec && S.replay && (session.mode !== 'online' || res.matchOver)) {
    await sleep(1300);
    if (M !== session) return;
    await view.replay(rec, replayOpts(rec));
    if (M !== session) return;
    await sleep(250);
  } else await sleep(2000);
  if (M !== session) return;
  if (res.matchOver) { endMatch(session); return; }
  if (session.mode === 'online') return; // the server starts the next round
  startNextRound(session.match);
  saveResume();
  view.setState(snapshot(session.match));
  updateHud();
  banner(t('roundN', { n: num(session.match.round) }), t('fightBang'));
  await sleep(800);
  nextTurn(session);
}

function endMatch(session, reason) {
  clearResume();
  const st = session.match;
  const ms = Date.now() - session.startedAt;
  const w = st.winner;
  view.setInput(-1);
  let title, sub = `${num(st.scores[0])} – ${num(st.scores[1])}`, win = false;
  const extra = [];
  if (session.mode === 'vsc') {
    win = w === 0;
    title = win ? t('youWin') : t('nameWon', { name: session.players[1].name });
    if (!session.practice) {
      const before = store.penLevel(st.penIds[0]);
      store.recordVsc({ won: win, level: session.level, pen: st.penIds[0], ms, rounds: st.round });
      const after = store.penLevel(st.penIds[0]);
      if (after > before) extra.push(t('levelUp', { pen: penName(st.penIds[0]), n: num(after) }));
      api('/api/report', { clientId: D.clientId, mode: 'vsc', level: session.level, result: win ? 'won' : 'lost', durationMs: ms });
    }
  } else if (session.mode === 'two') {
    win = true;
    title = t('winsP', { name: session.players[w].name });
    store.recordTwo({ names: session.players.map((p) => p.name), scores: st.scores.slice(), winner: w, ms, pens: st.penIds.slice() });
    api('/api/report', { clientId: D.clientId, mode: 'two', durationMs: ms });
  } else {
    win = w === session.you;
    title = win ? t('youWin') : t('nameWon', { name: session.players[w].name });
    sub = `${num(st.scores[session.you])} – ${num(st.scores[1 - session.you])}`;
    if (reason) extra.push(t('opponentLeft'));
    store.recordOnline({ won: win, ms });
  }
  checkProgress(session, win, true);
  win ? sfx.win() : sfx.lose();
  $('#result-ico').innerHTML = `<svg><use href="#${win ? 'i-trophy' : 'i-lose'}"/></svg>`;
  $('#result-ico').classList.toggle('lose', !win);
  $('#result-title').textContent = title;
  $('#result-sub').textContent = [sub, ...extra].join(' · ');
  $('#result-stats').innerHTML = [
    [fmtDur(ms), t('time')], [num(st.shots), t('shots')], [num(st.round), t('roundN', { n: '' }).trim() || 'Rounds'],
  ].map(([v, l]) => `<div class="tile"><b style="font-size:24px">${esc(v)}</b><small>${esc(l)}</small></div>`).join('');
  $('#result-badges').innerHTML = (session.dailyDone ? `<span class="rb daily-rb">📅 ${esc(t('dailyDoneToast', { n: num(D.daily.streak) }))}</span>` : '') +
    (session.earned || []).map((id) => `<span class="rb">${badgeIcon(id)} ${esc(t('ach_' + id))}</span>`).join('');
  if (session.earned?.length || session.dailyDone) setTimeout(() => sfx.badge(), 700);
  $('#btn-replay').style.display = session.lastKO ? '' : 'none';
  $('#btn-replay').title = t('watchReplay');
  $('#btn-replay').setAttribute('aria-label', t('watchReplay'));
  $('#rematch-text').textContent = t('rematch');
  $('#btn-rematch').disabled = session.mode === 'online' && !!reason;
  $('#btn-change-pen').style.display = session.mode === 'online' ? 'none' : '';
  $('#auto-next').textContent = '';
  openModal('m-result');
  refreshTexts();
  clearInterval(autoTimer);
  if (session.mode === 'vsc' && win && S.autoNext && !session.practice) {
    let n = 5;
    $('#auto-next').textContent = t('autoNextIn', { n: num(n) });
    autoTimer = setInterval(() => {
      n--;
      if (M !== session || !$('#m-result').classList.contains('open')) { clearInterval(autoTimer); return; }
      $('#auto-next').textContent = t('autoNextIn', { n: num(n) });
      if (n <= 0) { clearInterval(autoTimer); rematch(); }
    }, 1000);
  }
}
let autoTimer;

function rematch() {
  clearInterval(autoTimer);
  if (!M) return;
  if (M.mode === 'online') {
    net.emit('rematch');
    $('#rematch-text').textContent = t('rematchWait', { name: M.players[1 - M.you].name });
    $('#btn-rematch').disabled = true;
    return;
  }
  closeModal('m-result');
  if (M.practice) { startOffline({ practice: true }); return; }
  pick.mode = M.mode;
  startOffline();
}
$('#btn-rematch').addEventListener('click', () => { sfx.click(); rematch(); });
$('#btn-replay').addEventListener('click', async () => {
  const s = M;
  if (!s || !s.lastKO || view.busy) return;
  sfx.click();
  clearInterval(autoTimer);
  $('#auto-next').textContent = '';
  closeModal('m-result');
  await view.replay(s.lastKO, replayOpts(s.lastKO));
  if (M === s) openModal('m-result');
});
$('#btn-change-pen').addEventListener('click', () => {
  sfx.click(); clearInterval(autoTimer); closeModal('m-result');
  const mode = M ? M.mode : 'vsc';
  M = null;
  pick.mode = mode;
  stack.length = 0; stack.push('home', 'mode');
  $(`#s-${current}`).classList.remove('active'); current = 'pick'; $('#s-pick').classList.add('active'); onEnter('pick');
});
$('#btn-menu').addEventListener('click', () => { sfx.click(); clearInterval(autoTimer); closeModal('m-result'); quitMatch(); });

function quitMatch(stay = false) {
  clearResume();
  if (M && M.mode === 'online') net.emit('leave');
  M = null;
  view.setInput(-1);
  $('#toast').classList.remove('show');
  closeModal('m-pause');
  closeModal('m-result');
  if (!stay) home();
}
$('#btn-pause').addEventListener('click', () => { sfx.click(); view.cancelAim(); openModal('m-pause'); });
$('#btn-quit').addEventListener('click', () => { sfx.click(); quitMatch(); });
$('#btn-restart').addEventListener('click', () => {
  sfx.click(); closeModal('m-pause');
  if (!M || M.mode === 'online') return;
  const practice = M.practice;
  pick.mode = M.mode;
  startOffline({ practice });
});

// ---------- online ----------
function hasSocket() { return typeof window.io === 'function' && !window.__noSocket; }
let socket = null;
const net = {
  emit(ev, data, ack) { if (socket) socket.emit(ev, data, ack); },
};

function connect() {
  if (socket || !hasSocket()) return socket;
  socket = window.io({ transports: ['websocket', 'polling'] });
  socket.on('connect_error', () => { $('#online-status').textContent = t('connecting'); });
  socket.on('connect', () => { $('#online-status').textContent = ''; if (M && M.mode === 'online' && M.away) rejoin(); });
  socket.on('match:start', (d) => onlineStart(d));
  socket.on('shot', (res) => queue(() => onlineShot(res)));
  socket.on('round:start', (d) => queue(() => onlineRound(d)));
  socket.on('turn', (d) => queue(() => onlineTurn(d)));
  socket.on('aim', (a) => { if (M && M.mode === 'online' && M.match.turn !== M.you && !view.busy) view.setGhost(a, 1 - M.you); });
  socket.on('emote', (d) => showEmote(d.e, d.from));
  socket.on('rematch', (d) => {
    if (!M || M.mode !== 'online') return;
    if (d.ready[1 - M.you] && !d.ready[M.you]) $('#rematch-text').textContent = t('rematchAsk', { name: M.players[1 - M.you].name });
  });
  socket.on('opponent:left', () => onlineLeft());
  socket.on('match:end', (d) => { if (M && M.mode === 'online' && !M.match.over) { M.match.over = true; M.match.winner = d.winner; endMatch(M, d.reason); } });
  socket.on('disconnect', () => {
    if (M && M.mode === 'online' && !M.match.over) { M.away = true; view.setInput(-1); toast(t('connecting'), 20000); }
  });
  socket.on('opponent:away', () => { if (M && M.mode === 'online' && !M.match.over) toast(t('oppAway'), 20000); });
  socket.on('opponent:back', () => { if (M && M.mode === 'online') toast(t('oppBack')); });
  return socket;
}

// no answer, or the server does not know us: get a fresh connection and take the seat back
function reconnectSeat() {
  if (!M || M.mode !== 'online') return;
  M.away = true;
  if (socket.connected) socket.disconnect();
  socket.connect();
}

// the server's picture wins: same board, same turn
function resync(r) {
  M.match = restore(r.state);
  view.setState(r.state);
  updateHud();
  onlineTurn({ turn: r.turn, deadline: r.deadline, now: r.now });
}

// back after a drop: take our seat again, or say the match is gone (for example the server restarted)
function rejoin() {
  const s = M;
  net.emit('room:rejoin', { code: s.code, clientId: D.clientId }, (r) => {
    if (M !== s) return;
    s.away = false;
    if (!r || !r.ok) {
      if (s.match.over) return;
      quitMatch(true);
      home();
      toast(t('connLost'), 5000);
      return;
    }
    s.q = Promise.resolve();
    resync(r);
    toast(t('reconnected'));
  });
}

function queue(fn) {
  if (!M || M.mode !== 'online') return;
  const s = M;
  s.q = (s.q || Promise.resolve()).then(() => (M === s ? fn() : null)).catch((e) => console.error(e));
}

function onlineStart(d, resumed = false) {
  const players = d.players.map((p, i) => ({ name: p.name, tag: i === d.you ? t('you').slice(0, 3) : (p.name || '?').slice(0, 2).toUpperCase() }));
  const match = restore(d.state);
  M = { id: Math.random(), mode: 'online', you: d.you, match, players, startedAt: Date.now(), turnSeconds: d.turnSeconds, code: d.code };
  view.setMatch(d.state, match.stats, players);
  view.setInput(-1);
  enterGame(true);
  updateHud();
  renderEmotes();
  saveResume();
  if (resumed) { banner(t('roundN', { n: num(match.round) })); return; }
  banner(t('roundN', { n: num(1) }), t('fightBang'));
  sfx.round();
}

function resumeOnline(r) {
  if (!connect()) { clearResume(); return; }
  net.emit('room:rejoin', { code: r.code, clientId: D.clientId }, (a) => {
    if (!a || !a.ok) { clearResume(); toast(t('connLost'), 5000); return; }
    onlineStart({ ...a, code: r.code }, true);
    onlineTurn({ turn: a.turn, deadline: a.deadline, now: a.now });
  });
}

async function onlineShot(res) {
  const s = M;
  view.setInput(-1);
  M.deadline = 0;
  if (res.timeout && res.shooter === M.you) toast(t('timeUp'));
  keepKO(s, res, deskBefore(M.match));
  M.match = restore(res.state);
  await view.play(res);
  if (M !== s) return;
  await afterShot(s, res);
}

function onlineRound(d) {
  M.match = restore(d.state);
  view.setState(d.state);
  updateHud();
  banner(t('roundN', { n: num(M.match.round) }), t('fightBang'));
}

function onlineTurn(d) {
  M.match.turn = d.turn;
  M.deadline = Date.now() + (d.deadline - d.now);
  updateHud();
  if (d.turn === M.you) { view.setInput(M.you); sfx.turn(); }
  else view.setInput(-1);
}

function onlineLeft() {
  if (!M || M.mode !== 'online') {
    if (current === 'wait') return;
    return;
  }
  if (M.match.over) {
    $('#btn-rematch').disabled = true;
    $('#rematch-text').textContent = t('opponentLeft').split('.')[0];
    return;
  }
  M.match.over = true;
  M.match.winner = M.you;
  endMatch(M, 'left');
}

let aimLast = 0, aimPending = null, aimTimer = null;
function sendAim(aim) {
  if (!M || M.mode !== 'online' || M.match.turn !== M.you) return;
  aimPending = aim || { on: false };
  const now = performance.now();
  const flush = () => { aimLast = performance.now(); net.emit('aim', aimPending); aimTimer = null; };
  if (!aim) { clearTimeout(aimTimer); flush(); return; }
  if (now - aimLast > 70) flush();
  else if (!aimTimer) aimTimer = setTimeout(flush, 70 - (now - aimLast));
}

const EMOTES = ['👍', '😂', '😮', '😡', '🔥', '👏'];
// quick phrases go over the wire as ids; the other player sees exactly the words that were picked
const PHRASE_TEXT = { nice: 'Nice shot!', gg: 'GG', oops: 'Oops!', bnNice: 'দারুণ শট!', bnLucky: 'কপাল ভালো!', bnOops: 'উফ!', bnAgain: 'আবার হবে?' };
const PHRASES = Object.keys(PHRASE_TEXT);
const emoteText = (e) => PHRASE_TEXT[e] || e;
function renderEmotes() {
  $('#emote-list').innerHTML = PHRASES.map((e) => `<button class="phrase" data-e="${e}">${emoteText(e)}</button>`).join('')
    + EMOTES.map((e) => `<button data-e="${e}">${e}</button>`).join('');
  $$('#emote-list button').forEach((b) => b.addEventListener('click', () => {
    net.emit('emote', b.dataset.e);
    showEmote(b.dataset.e, M ? M.you : 0);
    $('#emote-list').classList.remove('open');
  }));
}
$('#emote-toggle').addEventListener('click', () => $('#emote-list').classList.toggle('open'));
function showEmote(e, from) {
  if (!M) return;
  const el = document.createElement('div');
  el.className = 'emote-float' + (PHRASES.includes(e) ? ' phrase' : '');
  el.textContent = emoteText(e);
  const mine = from === M.you;
  el.style.left = mine ? '30%' : '70%';
  el.style.top = '60%';
  $('#s-game').appendChild(el);
  sfx.pop();
  setTimeout(() => el.remove(), 2100);
}

function onlineInfo() {
  return { name: D.name || D.guest, pen: D.pen, clientId: D.clientId, rounds: D.rounds, clutter: D.clutter };
}

function showWait(kind, code) {
  $('#wait-title').textContent = kind === 'quick' ? t('searching') : t('waitingFriend');
  $('#wait-sub').textContent = kind === 'quick' ? t('searchingSub') : t('waitingSub');
  $('#wait-room').classList.toggle('hidden', kind === 'quick');
  $('#room-code').textContent = code || '';
  waitKind = kind;
  go('wait');
}
let waitKind = null;
$('#wait-back').addEventListener('click', () => {
  sfx.click();
  if (waitKind === 'quick') net.emit('quick:cancel'); else net.emit('leave');
  back();
});

function needServer() {
  if (!hasSocket()) { toast(t('noServer')); return false; }
  connect();
  return true;
}
$('#btn-quick').addEventListener('click', () => {
  sfx.click();
  if (!needServer()) return;
  showWait('quick');
  net.emit('quick', onlineInfo(), (r) => { if (!r || !r.ok) toast(t('noServer')); });
});
$('#btn-create').addEventListener('click', () => {
  sfx.click();
  if (!needServer()) return;
  net.emit('room:create', onlineInfo(), (r) => {
    if (!r || !r.ok) { toast(t('noServer')); return; }
    showWait('room', r.code);
  });
});
function joinCode(code) {
  if (!needServer()) return;
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { toast(t('enterCode')); return; }
  net.emit('room:join', { ...onlineInfo(), code }, (r) => {
    if (!r || !r.ok) toast(r && r.error === 'full' ? t('roomFull') : t('roomNotFound'));
  });
}
$('#btn-join').addEventListener('click', () => { sfx.click(); joinCode($('#join-code').value); });
$('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinCode(e.target.value); });
const inviteLink = () => `${location.origin}/?room=${$('#room-code').textContent}`;
$('#btn-copy-link').addEventListener('click', () => {
  navigator.clipboard?.writeText(inviteLink()).then(() => toast(t('linkCopied')), () => toast(inviteLink(), 5000));
});
$('#btn-share').addEventListener('click', () => {
  const url = inviteLink();
  if (navigator.share) navigator.share({ title: 'Pen Fight', text: 'Pen Fight — ' + $('#room-code').textContent, url }).catch(() => {});
  else navigator.clipboard?.writeText(url).then(() => toast(t('linkCopied')));
});

// ---------- leaderboard ----------
let boardTab = 'vsc';
$$('#board-tabs button').forEach((b) => b.addEventListener('click', () => { boardTab = b.dataset.tab; sfx.click(); renderBoard(); }));
const tile = (ico, v, l, cls = '') => `<div class="tile ${cls}">${ico ? `<svg><use href="#${ico}"/></svg>` : ''}<b>${v}</b><small>${esc(l)}</small></div>`;
function emptyState(icon, color) {
  return `<div class="empty"><div class="mode-ico ${color}"><svg><use href="#${icon}"/></svg></div><h3>${esc(t('noMatches'))}</h3><p class="muted">${esc(t('noMatchesSub'))}</p><button class="btn btn-play" data-empty-play style="font-size:22px;padding:12px 26px"><svg><use href="#i-play"/></svg>${esc(t('play'))}</button></div>`;
}
async function renderBoard() {
  $$('#board-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === boardTab));
  const body = $('#board-body');
  if (boardTab === 'vsc') {
    const s = D.vsc;
    if (!s.played) body.innerHTML = emptyState('i-bot', 'blue');
    else {
      const rate = s.played ? Math.round((s.won / s.played) * 100) : 0;
      body.innerHTML = `<div class="tiles" style="grid-template-columns:repeat(3,1fr)">${tile('i-two', num(s.played), t('played'))}${tile('i-trophy', num(s.won), t('won'))}${tile('i-lose', num(s.lost), t('lost'))}</div>
      <div class="tiles t3" style="margin-top:10px">${tile('i-podium', num(rate) + '%', t('winRate'))}${tile('i-fire', num(s.best), t('bestStreak'))}${tile('i-fire', num(s.streak), t('streakNow'))}</div>
      <div class="foot">${esc(t('savedDevice'))}</div>
      <div class="row-head"><div class="label">${esc(t('byLevel'))}</div><div class="label">${esc(t('playedWonRate'))}</div></div>
      <div class="tiles t3">${['easy', 'normal', 'hard'].map((k) => { const l = s.byLevel[k]; return `<div class="tile lvl"><b>${esc(t(k))}</b><small>${num(l.p)} · ${num(l.w)} · ${num(l.p ? Math.round((l.w / l.p) * 100) : 0)}%</small></div>`; }).join('')}</div>
      <div class="row-head"><div class="label">${esc(t('bestPerPen'))}</div><div class="label">${esc(t('playedWins'))}</div></div>
      ${[...PENS].sort((a, b) => ((s.byPen[b.id] || {}).w || 0) - ((s.byPen[a.id] || {}).w || 0)).map((p) => {
        const r = s.byPen[p.id];
        return `<div class="pen-row${r ? '' : ' dim'}"><canvas data-thumb="${p.id}"></canvas><div><b>${esc(penName(p.id))}</b><small>${r ? esc(t('pw', { p: num(r.p), w: num(r.w) })) : esc(t('notPlayed'))}</small></div><span class="lv-badge${r ? '' : ' dim'}">Lv${store.penLevel(p.id)}</span></div>`;
      }).join('')}`;
    }
  } else if (boardTab === 'two') {
    const h = D.two.history;
    if (!h.length) body.innerHTML = emptyState('i-two', 'green');
    else body.innerHTML = `<div class="tiles t3">${tile('i-two', num(D.two.played), t('played'))}${tile('i-clock', fmtDur(D.two.timeMs), t('timePlayed'))}${tile('i-trophy', fmtDur(D.two.longest), t('longestMatch'))}</div>
      <div class="label">${esc(t('matches'))}</div>` + h.map((m) => `<div class="lb-row"><span class="rank" style="background:${m.winner === 0 ? 'var(--p1)' : 'var(--p2)'};border-color:var(--ink);color:#fff">🏆</span><span class="nm"><b>${esc(m.names[m.winner])}</b> <span class="muted">vs ${esc(m.names[1 - m.winner])}</span></span><span class="wl">${num(m.scores[m.winner])}–${num(m.scores[1 - m.winner])} · ${esc(ago(m.at))}</span></div>`).join('');
  } else {
    const o = D.online;
    body.innerHTML = `<div class="label" style="margin-top:0">${esc(t('yourOnline'))}</div><div class="tiles t3">${tile('i-two', num(o.played), t('played'))}${tile('i-trophy', num(o.won), t('won'))}${tile('i-fire', num(o.best), t('bestStreak'))}</div><div class="label">${esc(t('topPlayers'))}</div><div id="lb-list" class="muted">…</div>`;
    const list = await api('/api/leaderboard');
    const el = $('#lb-list');
    if (!el) return;
    if (!list) el.innerHTML = `<div class="soon">${esc(t('worldOffline'))}</div>`;
    else if (!list.length) el.innerHTML = `<div class="soon">${esc(t('noOnline'))}</div>`;
    else el.innerHTML = list.map((p, i) => `<div class="lb-row${p.name === D.name ? ' me' : ''}"><span class="rank">${num(i + 1)}</span><span class="nm">${esc(p.name)}</span><span class="wl">${esc(t('wl', { w: num(p.won), l: num(p.lost) }))}</span></div>`).join('');
  }
  $$('canvas[data-thumb]', body).forEach((c) => penThumb(c, penById(c.dataset.thumb), S.look));
  const ep = $('[data-empty-play]', body);
  if (ep) ep.addEventListener('click', () => { pick.mode = boardTab === 'two' ? 'two' : 'vsc'; go('pick'); });
}

// ---------- stats ----------
let statsTab = 'me', statsSub = 'vsc';
$$('#stats-tabs button').forEach((b) => b.addEventListener('click', () => { statsTab = b.dataset.tab; sfx.click(); renderStats(); }));
async function renderStats() {
  $$('#stats-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === statsTab));
  const body = $('#stats-body');
  if (statsTab === 'me') {
    const subs = [['vsc', 'i-bot', t('vsc')], ['two', 'i-two', t('two')], ['online', 'i-globe', t('online')]];
    const s = statsSub === 'vsc' ? D.vsc : statsSub === 'two' ? D.two : D.online;
    const avg = s.played ? s.timeMs / s.played : 0;
    body.innerHTML = `<div class="seg" id="stats-sub">${subs.map(([k, ic, l]) => `<button data-sub="${k}" class="${k === statsSub ? 'on' : ''}"><svg style="width:20px;height:20px"><use href="#${ic}"/></svg>${esc(l)}</button>`).join('')}</div>
      <div class="label">${esc(t('time'))}</div>
      <div class="tiles t2">${tile('i-clock', fmtDur(s.timeMs), t('timePlayed'))}${tile('i-podium', fmtDur(avg), t('avgMatch'))}
      ${statsSub === 'vsc' ? tile('i-trophy', fmtDur(s.fastestWin), t('fastestWin')) : tile('i-two', num(s.played), t('played'))}${statsSub === 'online' ? tile('i-trophy', num(s.won), t('won')) : tile('i-fire', fmtDur(s.longest), t('longestMatch'))}</div>
      ${statsSub === 'vsc' ? `<div class="row-head"><div class="label">${esc(t('byLevel'))}</div><div class="label">${esc(t('averageMatch'))}</div></div>
      <div class="tiles t3">${['easy', 'normal', 'hard'].map((k) => { const l = s.byLevel[k]; return `<div class="tile lvl"><b>${esc(t(k))}</b><small>${l.p ? fmtDur(l.ms / l.p) : esc(t('countingFromNow'))}</small></div>`; }).join('')}</div>` : ''}
      <div class="foot">${esc(t('savedDevice'))} · <a id="stats-backup">${esc(t('backup'))}</a></div>`;
    $$('#stats-sub button').forEach((b) => b.addEventListener('click', () => { statsSub = b.dataset.sub; sfx.click(); renderStats(); }));
    $('#stats-backup').addEventListener('click', () => $('#btn-backup').click());
  } else if (statsTab === 'badges') {
    const got = BADGES.filter(([id]) => D.ach[id]).length;
    body.innerHTML = `<div class="tiles t3">${tile('i-trophy', `${num(got)}/${num(BADGES.length)}`, t('badgesEarned'))}${tile('i-fire', num(dailyStreak()), t('dailyStreak'))}${tile('i-check', num(D.daily.total), t('dailyTotal'))}</div>
      <div class="label">${esc(t('badges'))}</div>
      <div class="badges">${BADGES.map(([id, ic]) => `<div class="badge${D.ach[id] ? ' got' : ''}"><span class="badge-ico">${ic}</span><div><b>${esc(t('ach_' + id))}</b><small>${esc(t('achd_' + id))}</small></div>${D.ach[id] ? '<svg><use href="#i-check"/></svg>' : ''}</div>`).join('')}</div>
      <div class="foot">${esc(t('savedDevice'))}</div>`;
  } else {
    body.innerHTML = '<div class="muted center">…</div>';
    const w = await api('/api/stats');
    if (statsTab !== 'world') return;
    if (!w) { body.innerHTML = `<div class="soon">${esc(t('worldOffline'))}</div>`; return; }
    body.innerHTML = `<div class="tiles t3">${tile('i-two', fmtK(w.players), t('players'))}${tile('i-podium', fmtK(w.matches), t('matches'))}${tile('i-globe', fmtK(w.visits), t('visits'))}</div>
      <div class="tiles t3" style="margin-top:10px">${tile('i-clock', fmtHours(w.playMs), t('hoursPlayed'), 'big')}${tile('i-fire', fmtHours(w.siteMs), t('timeOnSite'), 'big')}${tile('i-check', num(w.online), t('onlineNowL'), 'big')}</div>
      <div class="label">${esc(t('vscWorld'))}</div>
      <div class="tiles t3">${tile('i-two', num(w.vsc.all[0]) + '%', t('playersWon'))}${tile('i-bot', num(w.vsc.all[1]) + '%', t('computerWon'))}${tile('i-check', num(w.vsc.all[2]) + '%', t('draws'))}</div>
      <div class="row-head"><div class="label">${esc(t('byLevel'))}</div><div class="label">${esc(t('wld'))}</div></div>
      <div class="tiles t3">${['easy', 'normal', 'hard'].map((k) => `<div class="tile lvl"><b>${esc(t(k))}</b><small>${w.vsc[k].map((v) => num(v) + '%').join(' · ')}</small></div>`).join('')}</div>
      <div class="foot">${esc(t('updatedEvery'))}</div>`;
  }
}

// ---------- fight button ----------
$('#btn-fight').addEventListener('click', () => { sfx.unlock(); sfx.click(); startOffline(); });

// ---------- start ----------
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
evaluate({}); // badges already earned by progress from before badges existed
applySettings();
startHero();
pingOnline();
setInterval(() => { if (current === 'home' || current === 'mode') pingOnline(); }, 20000);
if (!sessionStorage.getItem('pf-visit')) { sessionStorage.setItem('pf-visit', '1'); api('/api/visit', { clientId: D.clientId }); }
{
  let since = Date.now();
  const flushSite = () => {
    const ms = Date.now() - since; since = Date.now();
    if (ms < 2000) return;
    const body = JSON.stringify({ clientId: D.clientId, mode: 'site', durationMs: ms });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/report', new Blob([body], { type: 'application/json' }));
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSite(); else since = Date.now(); });
  setInterval(flushSite, 120000);
}
// invite link: /?room=CODE, or pick up a match that was going on before a refresh
{
  const code = new URLSearchParams(location.search).get('room');
  const r = !code && readResume();
  if (r && r.mode === 'online' && r.code) resumeOnline(r);
  else if (r && r.state && !r.state.over) { try { resumeOffline(r); } catch { clearResume(); M = null; home(); } }
  if (code) {
    window.history.replaceState(null, '', location.pathname);
    pick.mode = 'online';
    go('mode'); go('pick');
    $('#join-code').value = code.toUpperCase();
    setTimeout(() => joinCode(code), 300);
  }
}

// handy for debugging in the console
window.__pf = { view, get match() { return M; }, get socket() { return socket; } };
