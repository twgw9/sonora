/* =========================================================
   SONORA v3 — client
   ========================================================= */
'use strict';
/* Build fingerprint. If the browser is running an older bundle than the server
   serves, every cache and service worker is destroyed and the page reloads once.
   This is what makes "I don't see the changes" impossible. */
const BUILD = 'v15-2026-08-22';
(async () => {
  try {
    const prev = localStorage.getItem('sn_build');
    if (prev && prev !== BUILD) {
      localStorage.setItem('sn_build', BUILD);
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      try { sessionStorage.clear(); } catch (e) {}
      if (!sessionStorage.getItem('sn_reloaded')) { sessionStorage.setItem('sn_reloaded', '1'); location.reload(); }
      return;
    }
    localStorage.setItem('sn_build', BUILD);
  } catch (e) {}
})();
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = s => (!s || !isFinite(s) || s < 0) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nf = n => n >= 1e7 ? (n / 1e7).toFixed(1) + ' Cr' : n >= 1e5 ? (n / 1e5).toFixed(1) + ' L' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : (n || '');
const LS = (k, d) => { try { const v = localStorage.getItem('sn_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const SET = (k, v) => { try { localStorage.setItem('sn_' + k, JSON.stringify(v)); } catch (e) { } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uniqById = a => { const seen = new Set(); return (a || []).filter(x => x && x.id && !seen.has(x.id) && seen.add(x.id)); };

let tT; function toast(m) { $('#toastT').textContent = m; const t = $('#toast'); t.classList.add('show'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('show'), 2500); }
const buzz = n => { try { navigator.vibrate && navigator.vibrate(n || 8); } catch (e) { } };

const MEM = new Map();
function memGet(k, maxAge) { const v = MEM.get(k); if (!v) return null; if (Date.now() - v.t > maxAge) return null; return v.d; }
function memSet(k, d) { if (MEM.size > 120) MEM.delete(MEM.keys().next().value); MEM.set(k, { t: Date.now(), d }); }
function diskGet(k) { try { const v = JSON.parse(sessionStorage.getItem('sc_' + k) || 'null'); return v && v.d; } catch { return null; } }
function diskSet(k, d) { try { sessionStorage.setItem('sc_' + k, JSON.stringify({ t: Date.now(), d })); } catch { } }

let netDown = false;
function setNet(down, msg) {
  netDown = down;
  const b = $('#netbar'); if (!b) return;
  if (down) { $('#netTxt').textContent = msg || 'Connection lost — retrying'; b.classList.remove('ok'); b.classList.add('show'); }
  else if (b.classList.contains('show')) { $('#netTxt').textContent = 'Back online'; b.classList.add('ok');
    setTimeout(() => b.classList.remove('show'), 1800); }
}

async function api(p, opt = {}) {
  const { tries = 3, cache: useCache = true, fresh = false } = opt;
  if (useCache && !fresh) { const m = memGet(p, 90000); if (m) return m; }
  let last;
  for (let i = 0; i <= tries; i++) {
    try {
      const c = new AbortController(), to = setTimeout(() => c.abort(), 18000);
      const r = await fetch(p, { signal: c.signal, headers: { Accept: 'application/json' } });
      clearTimeout(to);
      if (r.status === 429) { const ra = +(r.headers.get('Retry-After') || 1); await wait(ra * 1000 + Math.random() * 400); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (useCache) { memSet(p, j); diskSet(p, j); }
      setNet(false);
      return j;
    } catch (e) { last = e; if (i < tries) await wait(500 * (i + 1) ** 2); }
  }
  const stale = (useCache && (memGet(p, 864e5) || diskGet(p)));
  if (stale) { setNet(true, 'Showing saved data — reconnecting'); return stale; }
  if (!navigator.onLine) setNet(true, 'You are offline');
  else setNet(true, 'Server is slow — retrying');
  throw last || new Error('failed');
}

/* ---------- ICONS ---------- */
const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M19.4 5.9a4.6 4.6 0 0 0-6.5 0L12 6.8l-.9-.9a4.6 4.6 0 1 0-6.5 6.5l.9.9L12 20l6.5-6.7.9-.9a4.6 4.6 0 0 0 0-6.5z"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 3.5v10.8"/><path d="M8 10.6 12 14.6l4-4"/><path d="M4.5 19h15"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 18.5V6l11-2.2v12.7"/><circle cx="6.4" cy="18.5" r="2.6"/><circle cx="17.4" cy="16.5" r="2.6"/></svg>',
  queue: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h16M4 16h9"/><path d="M17 14.5v6l4.5-3z"/></svg>',
  radio: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.6"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.4"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="17.5" cy="5.5" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="18.5" r="2.6"/><path d="M8.8 10.7 15.2 7M8.8 13.3l6.4 3.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15M9.5 6.5V4.2h5v2.3M6.5 6.5 7.4 20h9.2l.9-13.5"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M14 12 6 6.5v11z" style="fill:currentColor;stroke:none"/><path d="M17.5 6v12" stroke-width="2.2"/></svg>',
};

/* ========================================================= */
const S = {
  view: 'home', stack: [], custom: false,
  queue: [], idx: -1,
  liked: uniqById(LS('liked', [])), recent: uniqById(LS('recent', [])), dls: uniqById(LS('dls', [])), pls: LS('pls', []),
  stats: LS('stats', { secs: 0, plays: 0, artists: {}, modes: {} }),
  shuffle: false, repeat: 'off', autoplay: LS('auto', true),
  q: LS('q', '320'), adapt: LS('adapt', true), dlMax: LS('dlMax', true), lang: LS('lang', 'hindi'),
  mode: LS('mode', 'off'), quick: LS('quick', 'lofi'), eq: LS('eq', [0, 0, 0, 0, 0, 0, 0]), eqPre: LS('eqPre', 'flat'),
  rain: false, kar: false, cmp: LS('cmp', false), fade: true, spin: LS('spin', true),
  theme: LS('theme','venom'), dens: LS('dens','default'), accent: LS('accent','default'), font: LS('font','grotesk'), corner: LS('corner','default'),
  room: null, es: null, host: false, snap: null, me: LS('me', 'Guest' + Math.floor(Math.random() * 900 + 100)),
  tmr: null, tmrEnd: 0, fsTab: 'art',
};
try { if (LS('cmp', false) === true && !LS('cmpMigrated', false)) { SET('cmp', false); SET('cmpMigrated', true); } } catch (e) { }
const save = () => { SET('liked', S.liked.slice(0, 700)); SET('recent', S.recent.slice(0, 120));
  SET('dls', S.dls.slice(0, 400)); SET('pls', S.pls); SET('stats', S.stats); };

/* ================= AUDIO ENGINE ================= */
const au = $('#au');
const EQF = [60, 150, 400, 1000, 2400, 6000, 12000];
let AC, src, eqN = [], lpN, cvN, wetN, dryN, nzN, rnN, panN, cmpN, anN, outN, fxIn, byp,
  wLL, wLR, wRL, wRR, ready = false, ph = 0, panRAF = 0, bypassed = null;

function boot() {
  if (ready) return true;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    src = AC.createMediaElementSource(au);
    // 7-band peaking EQ chain
    eqN = EQF.map((f, i) => { const n = AC.createBiquadFilter();
      n.type = i === 0 ? 'lowshelf' : i === EQF.length - 1 ? 'highshelf' : 'peaking';
      n.frequency.value = f; n.Q.value = 1.1; n.gain.value = 0; return n; });
    lpN = AC.createBiquadFilter(); lpN.type = 'lowpass'; lpN.frequency.value = 22000;
    const sp = AC.createChannelSplitter(2), mg = AC.createChannelMerger(2);
    wLL = AC.createGain(); wLR = AC.createGain(); wRL = AC.createGain(); wRR = AC.createGain();
    wLL.gain.value = wRR.gain.value = 1; wLR.gain.value = wRL.gain.value = 0;
    sp.connect(wLL, 0); sp.connect(wLR, 0); sp.connect(wRR, 1); sp.connect(wRL, 1);
    wLL.connect(mg, 0, 0); wRL.connect(mg, 0, 0); wRR.connect(mg, 0, 1); wLR.connect(mg, 0, 1);
    panN = AC.createStereoPanner();
    cvN = AC.createConvolver(); cvN.buffer = mkIR(2.7, 2.4);
    wetN = AC.createGain(); wetN.gain.value = 0; dryN = AC.createGain(); dryN.gain.value = 1;
    cmpN = AC.createDynamicsCompressor();
    // transparent by default: only catches true peaks, never pumps
    cmpN.threshold.value = 0; cmpN.ratio.value = 1; cmpN.knee.value = 0;
    cmpN.attack.value = 0.004; cmpN.release.value = 0.25;
    anN = AC.createAnalyser(); anN.fftSize = 512; anN.smoothingTimeConstant = .8;
    outN = AC.createGain();
    /* Two parallel routes from the source:
         byp  : source -> analyser -> out            (bit-transparent)
         fxIn : source -> EQ -> filters -> ... -> out (processed)
       Only one carries signal at a time, so untouched playback is literally
       untouched — no filters, no matrix, no convolver in the path. */
    fxIn = AC.createGain(); fxIn.gain.value = 0;
    byp = AC.createGain(); byp.gain.value = 1;
    src.connect(byp); src.connect(fxIn);
    byp.connect(anN);

    let prev = fxIn; eqN.forEach(n => { prev.connect(n); prev = n; });
    prev.connect(lpN); lpN.connect(sp); mg.connect(panN);
    panN.connect(dryN); dryN.connect(cmpN);
    panN.connect(cvN); cvN.connect(wetN); wetN.connect(cmpN);
    cmpN.connect(anN); anN.connect(outN); outN.connect(AC.destination);
    nzN = AC.createGain(); nzN.gain.value = 0;
    rnN = AC.createGain(); rnN.gain.value = 0;
    nzN.connect(outN); rnN.connect(outN);
    ready = true; return true;
  } catch (e) { console.warn('audio', e); return false; }
}
const wake = () => { if (!ready) boot(); if (AC && AC.state === 'suspended') AC.resume(); };
let nzStarted = false, rnStarted = false;
function needNoise() { if (nzStarted || !ready) return; nzStarted = true;
  const ns = AC.createBufferSource(); ns.buffer = mkNoise(5, 'v'); ns.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3300; f.Q.value = .5;
  ns.connect(f); f.connect(nzN); ns.start(); }
function needRain() { if (rnStarted || !ready) return; rnStarted = true;
  const rs = AC.createBufferSource(); rs.buffer = mkNoise(7, 'r'); rs.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 4600;
  rs.connect(f); f.connect(rnN); rs.start(); }
function mkIR(sec, dk) { const n = AC.sampleRate * sec, b = AC.createBuffer(2, n, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, dk); } return b; }
function mkNoise(sec, kind) {
  const ch = kind === 'r' ? 2 : 1, n = AC.sampleRate * sec, b = AC.createBuffer(ch, n, AC.sampleRate);
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); let l = 0;
    for (let i = 0; i < n; i++) { if (kind === 'r') { const w = Math.random() * 2 - 1; l = (l + .026 * w) / 1.026; d[i] = l * 3.5 + w * .055; }
      else d[i] = Math.random() < .0014 ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * .009; } }
  return b;
}

/* ---------- EQ presets ---------- */
const EQP = {
  venom:      [4, 3, -1, 0, 2, 3, 5],
  flat:       [0, 0, 0, 0, 0, 0, 0],
  bass:       [9, 7, 3, 0, -1, 0, 1],
  vocal:      [-3, -2, 2, 5, 4, 2, 0],
  treble:     [-2, -1, 0, 1, 3, 6, 8],
  electronic: [7, 4, 0, -2, 1, 4, 6],
  acoustic:   [3, 2, 1, 2, 3, 3, 2],
  podcast:    [-6, -3, 3, 6, 5, 1, -2],
};

/* ---------- 16 sound modes ---------- */
const MODES = {
  off:     { n: 'Studio Flat', d: 'Reference, untouched',   sp: 100, lp: 22000, re: 0,  no: 0,  pa: 0,  wi: 100, eq: 'flat' },
  lofi:    { n: 'Lo-Fi',       d: 'Slow, warm, crackling',  sp: 85,  lp: 2600,  re: 30, no: 22, pa: 0,  wi: 110, eq: [5, 4, 0, -2, -4, -6, -9] },
  deep:    { n: 'Deep Lo-Fi',  d: 'Heavier body and haze',  sp: 82,  lp: 2000,  re: 46, no: 27, pa: 12, wi: 150, eq: [9, 6, 1, -3, -6, -8, -11] },
  slowrev: { n: 'Slowed + Reverb', d: 'Dreamy and cinematic', sp: 80, lp: 9000, re: 60, no: 0,  pa: 0,  wi: 160, eq: [5, 3, 0, 0, 1, 2, 1] },
  night:   { n: 'Nightcore',   d: 'Fast, bright, energetic', sp: 128, lp: 22000, re: 8, no: 0,  pa: 0,  wi: 125, eq: [2, 1, 0, 1, 3, 5, 6] },
  eight:   { n: '8D Spatial',  d: 'Rotates around your head', sp: 100, lp: 22000, re: 38, no: 0, pa: 55, wi: 185, eq: [4, 2, 0, 1, 2, 3, 3] },
  bass:    { n: 'Bass Cannon', d: 'Club-grade low end',     sp: 100, lp: 22000, re: 4,  no: 0,  pa: 0,  wi: 115, eq: 'bass' },
  club:    { n: 'Club',        d: 'Loud, wide and punchy',  sp: 104, lp: 22000, re: 24, no: 0,  pa: 0,  wi: 172, eq: [8, 5, 0, -1, 2, 5, 6] },
  vocal:   { n: 'Vocal Focus', d: 'Mid-forward clarity',    sp: 100, lp: 22000, re: 5,  no: 0,  pa: 0,  wi: 78,  eq: 'vocal' },
  hall:    { n: 'Concert Hall', d: 'Live venue acoustics',  sp: 100, lp: 17000, re: 72, no: 0,  pa: 0,  wi: 195, eq: [3, 2, 0, 1, 2, 3, 4] },
  tape:    { n: 'Cassette',    d: 'Vintage analogue grit',  sp: 76,  lp: 1600,  re: 22, no: 50, pa: 0,  wi: 88,  eq: [7, 5, 1, -3, -7, -10, -12] },
  radio:   { n: 'AM Radio',    d: 'Narrow retro speaker',   sp: 100, lp: 3600,  re: 10, no: 34, pa: 0,  wi: 22,  eq: [-10, -6, 2, 5, 2, -6, -12] },
  rainy:   { n: 'Rainy Window', d: 'Lo-fi with rainfall',   sp: 88,  lp: 3400,  re: 45, no: 26, pa: 0,  wi: 132, eq: [5, 3, 0, -2, -3, -5, -7], rain: 1 },
  sleep:   { n: 'Sleep',       d: 'Soft, drifting, distant', sp: 82, lp: 1400,  re: 58, no: 9,  pa: 8,  wi: 122, eq: [3, 1, -1, -3, -6, -9, -12] },
  focus:   { n: 'Deep Focus',  d: 'Flat with zero fatigue', sp: 96,  lp: 7200,  re: 12, no: 7,  pa: 0,  wi: 100, eq: [1, 0, 0, 0, -1, -2, -3] },
  gym:     { n: 'Workout',     d: 'Aggressive and hyped',   sp: 108, lp: 22000, re: 6,  no: 0,  pa: 0,  wi: 142, eq: [10, 6, 0, 1, 3, 6, 7] },
};
const FX = { sp: 100, lp: 22000, re: 0, no: 0, pa: 0, wi: 100 };

function applyFX() {
  au.playbackRate = clamp(FX.sp / 100, .25, 4);
  try { const keep = FX.sp === 100;
    au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = keep; } catch (e) { }
  const on = S.mode !== 'off', b = $('#mdBadge');
  if (b) { b.style.display = on ? '' : 'none'; b.textContent = on ? MODES[S.mode].n : ''; }
  $('#eqBtn').classList.toggle('on', on || S.eq.some(v => v !== 0));
  if (!ready) return;
  const t = AC.currentTime, r = .1;

  /* Is any processing actually requested? */
  const touched = on || S.rain || S.kar || S.cmp
    || S.eq.some(v => v !== 0)
    || FX.sp !== 100 || FX.lp < 21000 || FX.re > 0 || FX.no > 0 || FX.pa > 0 || FX.wi !== 100;
  if (touched !== (bypassed === false)) {
    bypassed = !touched;
    byp.gain.setTargetAtTime(touched ? 0 : 1, t, .04);
    fxIn.gain.setTargetAtTime(touched ? 1 : 0, t, .04);
  }
  if (!touched) { au.playbackRate = 1; try { au.preservesPitch = true; } catch (e) { } return; }
  S.eq.forEach((g, i) => eqN[i] && eqN[i].gain.setTargetAtTime(S.kar && i >= 3 && i <= 4 ? g - 8 : g, t, r));
  lpN.frequency.setTargetAtTime(FX.lp, t, r);
  wetN.gain.setTargetAtTime(FX.re / 100 * .9, t, r);
  dryN.gain.setTargetAtTime(1 - FX.re / 340, t, r);
  if (FX.no > 0) needNoise();
  if (S.rain) needRain();
  nzN.gain.setTargetAtTime(FX.no / 100 * .2, t, r);
  rnN.gain.setTargetAtTime(S.rain ? .3 : 0, t, .4);
  // gentle peak limiter, not a loudness compressor
  cmpN.threshold.setTargetAtTime(S.cmp ? -3 : 0, t, r);
  cmpN.ratio.setTargetAtTime(S.cmp ? 6 : 1, t, r);
  cmpN.knee.setTargetAtTime(S.cmp ? 4 : 0, t, r);
  const w = FX.wi / 100, dd = (1 + w) / 2, cc = (1 - w) / 2;
  wLL.gain.setTargetAtTime(dd, t, r); wRR.gain.setTargetAtTime(dd, t, r);
  wLR.gain.setTargetAtTime(cc, t, r); wRL.gain.setTargetAtTime(cc, t, r);
  cancelAnimationFrame(panRAF);
  if (FX.pa > 0) { const s = FX.pa / 100; const lp = () => { ph += .011 * s; panN.pan.value = Math.sin(ph) * .95; panRAF = requestAnimationFrame(lp); }; panRAF = requestAnimationFrame(lp); }
  else if (panN) panN.pan.value = 0;
}
function setMode(k, quiet) {
  if (!MODES[k]) k = 'off';
  S.mode = k; SET('mode', k);
  const m = MODES[k];
  FX.sp = m.sp; FX.lp = m.lp; FX.re = m.re; FX.no = m.no; FX.pa = m.pa; FX.wi = m.wi;
  S.eq = (typeof m.eq === 'string' ? EQP[m.eq] : m.eq).slice();
  S.eqPre = typeof m.eq === 'string' ? m.eq : 'custom';
  S.rain = !!m.rain; SET('eq', S.eq); SET('eqPre', S.eqPre);
  S.stats.modes[k] = (S.stats.modes[k] || 0) + 1; save();
  wake(); $('#swRain').classList.toggle('on', S.rain);
  syncKnobs(); drawEQ(); applyFX(); paintModes(); paintPresets();
  paintQuick();
  if (!quiet) toast(m.n);
}
function setEQPreset(k) {
  S.eq = EQP[k].slice(); S.eqPre = k; SET('eq', S.eq); SET('eqPre', k);
  wake(); drawEQ(); applyFX(); paintPresets(); toast('EQ: ' + k[0].toUpperCase() + k.slice(1));
}
const KNOBS = [['kSp', 'vSp', 'sp', v => v + '%'], ['kRe', 'vRe', 're', v => v + '%'],
['kWi', 'vWi', 'wi', v => v + '%'], ['kPa', 'vPa', 'pa', v => +v ? v + '%' : 'off'], ['kNo', 'vNo', 'no', v => v + '%']];
const syncKnobs = () => KNOBS.forEach(([k, l, key, f]) => { const i = $('#' + k); if (i) { i.value = FX[key]; $('#' + l).textContent = f(FX[key]); } });

/* ---------- EQ UI ---------- */
function buildEQ() {
  const ax = $('#eqAxis'); ax.innerHTML = ['+12', '+6', '0', '−6', '−12'].map(x => `<span>${x}</span>`).join('');
  const bank = $('#eqBars'); bank.innerHTML = '';
  EQF.forEach((f, i) => {
    const w = el('div', 'eqb');
    w.innerHTML = `<div class="eqv">0</div>
      <div class="eqs" data-i="${i}"><div class="rail2"></div><div class="zero" style="bottom:50%"></div>
      <div class="fill"></div><div class="knb"></div></div>
      <div class="eqf">${f >= 1000 ? (f / 1000) + 'K' : f}</div>`;
    bank.appendChild(w);
    const s = w.querySelector('.eqs');
    const set = e => { const r = s.getBoundingClientRect();
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      const pct = 1 - clamp(y / r.height, 0, 1);
      S.eq[i] = Math.round((pct * 24 - 12) * 2) / 2;
      S.eqPre = 'custom'; SET('eq', S.eq); SET('eqPre', 'custom');
      wake(); drawEQ(); applyFX(); paintPresets(); };
    let dg = false;
    const dn = e => { dg = true; s.classList.add('dg'); set(e); e.preventDefault(); };
    const mv = e => dg && set(e);
    const up = () => { dg = false; s.classList.remove('dg'); };
    s.addEventListener('mousedown', dn); s.addEventListener('touchstart', dn, { passive: false });
    addEventListener('mousemove', mv); addEventListener('touchmove', e => { if (dg) { set(e); e.preventDefault(); } }, { passive: false });
    addEventListener('mouseup', up); addEventListener('touchend', up);
    s.addEventListener('dblclick', () => { S.eq[i] = 0; SET('eq', S.eq); drawEQ(); applyFX(); });
  });
  drawEQ();
}
function drawEQ() {
  $$('#eqBars .eqb').forEach((w, i) => {
    const g = S.eq[i] || 0, pct = (g + 12) / 24;
    w.classList.toggle('act', g !== 0);
    w.querySelector('.eqv').textContent = (g > 0 ? '+' : '') + (g % 1 ? g.toFixed(1) : g);
    w.querySelector('.fill').style.height = (pct * 100) + '%';
    w.querySelector('.knb').style.bottom = (pct * 100) + '%';
  });
}
function paintPresets() {
  const c = $('#eqPresets'); c.innerHTML = '';
  const cust = el('button', 'chip' + (S.eqPre === 'custom' ? ' on' : ''), 'Custom');
  cust.onclick = () => toast('Drag any band to make a custom curve'); c.appendChild(cust);
  Object.keys(EQP).forEach(k => { const b = el('button', 'chip' + (S.eqPre === k ? ' on' : ''), k[0].toUpperCase() + k.slice(1));
    b.onclick = () => setEQPreset(k); c.appendChild(b); });
  const r = el('button', 'chip', 'Reset'); r.onclick = () => setEQPreset('flat'); c.appendChild(r);
}
function paintModes() {
  const g = $('#modeGrid'); if (!g) return; g.innerHTML = '';
  for (const k in MODES) { const b = el('button', 'op' + (S.mode === k ? ' on' : ''), `${esc(MODES[k].n)}<span>${esc(MODES[k].d)}</span>`);
    b.onclick = () => setMode(k); g.appendChild(b); }
}

/* ================= QUICK MODE TOGGLE ================= */
function paintQuick() {
  const on = S.mode === S.quick && S.mode !== 'off';
  const b = $('#qMode'), t = $('#qModeT'), m = $('#mMode');
  if (t) t.textContent = MODES[S.quick] ? MODES[S.quick].n : 'Lo-Fi';
  if (b) { b.classList.toggle('on', on);
    b.title = (on ? 'Turn off ' : 'Turn on ') + (MODES[S.quick]?.n || '') + ' — hold to pick a different mode'; }
  if (m) m.classList.toggle('act', on);
}
function toggleQuick() {
  const target = MODES[S.quick] ? S.quick : 'lofi';
  const on = S.mode === target;
  const b = $('#qMode');
  if (b) { b.classList.remove('flash', 'pulse2'); void b.offsetWidth; b.classList.add('flash', 'pulse2'); }
  buzz(12);
  setMode(on ? 'off' : target, true);
  paintQuick();
  const t = $('#toast'); t.classList.add('mode');
  toast(on ? (MODES[target].n + ' off') : (MODES[target].n + ' on'));
  setTimeout(() => t.classList.remove('mode'), 2600);
}
function openQuickPick(anchor) {
  const p = $('#qpick');
  p.innerHTML = `<div class="ph">Quick button controls</div><div class="pg"></div>
    <div class="note">Tap the player button to switch this mode on or off instantly. Hold it to come back here.</div>`;
  const g = p.querySelector('.pg');
  Object.keys(MODES).filter(k => k !== 'off').forEach(k => {
    const b = el('button', 'qmi' + (S.quick === k ? ' on' : ''), `${esc(MODES[k].n)}<span>${esc(MODES[k].d)}</span>`);
    b.onclick = () => { S.quick = k; SET('quick', k); paintQuick(); closeQuickPick();
      if (S.mode !== 'off' && S.mode !== k) setMode(k, true), paintQuick();
      toast('Quick button set to ' + MODES[k].n); };
    g.appendChild(b);
  });
  p.classList.add('open');
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = clamp(r.left + r.width / 2 - w / 2, 10, innerWidth - w - 10) + 'px';
  p.style.top = clamp(r.top - h - 12, 10, innerHeight - h - 10) + 'px';
}
const closeQuickPick = () => $('#qpick').classList.remove('open');

/* ================= QUALITY ================= */
const QUAL = [
  { v: '320', n: 'Studio', s: '320 kbps', d: 'Full fidelity, every detail intact', tag: 'STUDIO' },
  { v: '160', n: 'High', s: '160 kbps', d: 'Great balance of clarity and data', tag: 'HIGH' },
  { v: '96', n: 'Balanced', s: '96 kbps', d: 'Everyday listening, lighter load', tag: 'BAL' },
  { v: '48', n: 'Saver', s: '48 kbps', d: 'Stretches limited mobile data', tag: 'SAVER' },
  { v: '12', n: 'Lite', s: '12 kbps', d: 'Keeps playing on a weak signal', tag: 'LITE' },
];
const qTag = v => (QUAL.find(x => x.v === v) || {}).tag || v;
const QLVL = { '320': 5, '160': 4, '96': 3, '48': 2, '12': 1 };
function paintQPill() {
  const b = $('#qBtn'); if (!b) return;
  const lv = QLVL[S.q] || 3;
  b.className = 'qpill lvl' + lv + (lv <= 2 ? ' lo' : '');
  const l = $('#qLbl'); l.textContent = qTag(S.q); l.classList.remove('roll'); void l.offsetWidth; l.classList.add('roll');
}
function paintQ() {
  const g = $('#qOpts'); g.innerHTML = '';
  QUAL.forEach(q => { const b = el('button', 'op' + (S.q === q.v ? ' on' : ''), `${q.n} · ${q.s}<span>${q.d}</span>`);
    b.style.cssText = 'width:100%;margin-bottom:7px'; b.onclick = () => { setQ(q.v); paintQ(); }; g.appendChild(b); });
}
function setQ(v) {
  S.q = v; SET('q', v); paintQPill();
  const s = S.queue[S.idx];
  if (s) { const t = au.currentTime, p = !au.paused; au.src = surl(s); au.currentTime = t; if (p) au.play().catch(() => { }); }
  toast('Quality: ' + (QUAL.find(x => x.v === v) || {}).n);
}

/* ================= PLAYBACK ================= */
const surl = (s, q) => { const u = (s.u || {})[q || S.q] || s.raw || Object.values(s.u || {}).pop(); return u ? '/stream?u=' + encodeURIComponent(u) : ''; };
let errN = 0;
async function play(list, i) {
  if (list) { S.queue = list.slice(0, 400); S.idx = i; }
  const s = S.queue[S.idx]; if (!s) return;
  if (!s.u || !Object.keys(s.u).length) { try { const d = await api('/api/song?id=' + s.id); if (d.song) Object.assign(s, d.song); } catch (e) { } }
  const url = surl(s); if (!url) { toast('Track unavailable'); return skip(true); }
  wake(); au.src = url;
  const v = $('#vol').value / 100; au.volume = S.fade ? 0 : v;
  try { await au.play(); errN = 0; } catch (e) { toast('Tap play to allow audio'); }
  if (S.fade) fadeTo(v, 600);
  applyFX(); paintNow(s);
  S.recent = uniqById([s, ...S.recent.filter(x => x.id !== s.id)]).slice(0, 120);
  S.stats.plays++; S.stats.artists[s.a] = (S.stats.artists[s.a] || 0) + 1;
  save(); counts(); markRows();
  if ($('#fs').classList.contains('open')) fsRender();
  if (S.room && S.host) rAct('idx', S.idx);
}
let fR; function fadeTo(to, ms) { cancelAnimationFrame(fR); const a = au.volume, t0 = performance.now();
  const st = t => { const k = Math.min(1, (t - t0) / ms); au.volume = a + (to - a) * k; if (k < 1) fR = requestAnimationFrame(st); }; fR = requestAnimationFrame(st); }

function paintNow(s) {
  document.body.classList.add('has-track');
  const lk = isLiked(s.id);
  $('#pImg').src = s.img; $('#pT').textContent = s.t; $('#pA').textContent = s.a;
  $('#mImg').src = s.img; $('#mT').textContent = s.t; $('#mA').textContent = s.a;
  $('#likeB').classList.toggle('on', lk);
  const mp = $('#mLike').querySelector('path'); mp.style.fill = lk ? 'var(--warn)' : 'none'; mp.style.stroke = lk ? 'var(--warn)' : 'currentColor';
  $('#fsBg').style.backgroundImage = `url("${s.img}")`; $('#fsTop').textContent = s.t;
  document.title = s.t + ' · Sonora';
  if ('mediaSession' in navigator) try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: s.t, artist: s.a, album: s.al,
      artwork: [96, 192, 256, 384, 512].map(x => ({ src: s.img, sizes: x + 'x' + x, type: 'image/jpeg' })) });
  } catch (e) { }
}
async function skip(auto) {
  if (S.repeat === 'one' && auto) { au.currentTime = 0; au.play(); return; }
  if (!S.queue.length) return;
  let i = S.shuffle ? Math.floor(Math.random() * S.queue.length) : S.idx + 1;
  if (i >= S.queue.length) { if (S.repeat === 'all' || !auto) i = 0;
    else if (S.autoplay && auto) return autoNext(); else { au.pause(); return; } }
  S.idx = i; play();
}
async function autoNext() {
  const c = S.queue[S.idx]; if (!c) return;
  toast('Finding similar tracks');
  try { let d = await api('/api/similar?id=' + c.id);
    if (!d.songs?.length) d = await api('/api/search?q=' + encodeURIComponent(c.a) + '&n=25');
    const nw = (d.songs || []).filter(x => !S.queue.some(y => y.id === x.id));
    if (!nw.length) { au.pause(); return toast('Queue finished'); }
    S.queue.push(...nw.slice(0, 20)); S.idx++; play(); counts();
  } catch (e) { au.pause(); }
}
const prevTrack = () => { if (au.currentTime > 4) return au.currentTime = 0; S.idx = S.idx <= 0 ? S.queue.length - 1 : S.idx - 1; play(); };
function toggle() {
  if (!S.queue.length) return toast('Nothing queued yet');
  wake();
  if (S.room && !amHost()) {                       // guest: rejoin the room instead
    if (au.paused) { au.play().catch(() => { }); if (S.snap) follow(S.snap, false); }
    else au.pause();
    return;
  }
  au.paused ? au.play() : au.pause();
  if (S.room && amHost()) rAct(au.paused ? 'pause' : 'play');
}

/* ================= LIBRARY ================= */
const isLiked = id => S.liked.some(x => x.id === id);
function like(s) {
  if (isLiked(s.id)) { S.liked = S.liked.filter(x => x.id !== s.id); toast('Removed from Liked'); }
  else { S.liked = [s, ...S.liked]; toast('Added to Liked'); }
  buzz(); save(); counts(); markRows();
  const c = S.queue[S.idx]; if (c && c.id === s.id) paintNow(c);
  if (S.view === 'liked') render();
}
const counts = () => { $('#nL').textContent = S.liked.length || ''; $('#nQ').textContent = S.queue.length || '';
  document.body.classList.toggle('has-track', !!(S.queue.length && S.idx >= 0 && S.queue[S.idx])); };
function markRows() {
  const c = S.queue[S.idx];
  $$('.rw').forEach(r => { const on = c && r.dataset.id === c.id;
    r.classList.toggle('act', on);
    const n = r.querySelector('.rn'); if (n) n.innerHTML = on && !au.paused ? '<div class="eqi"><i></i><i></i><i></i></div>' : (r.dataset.n || '');
    const l = r.querySelector('.mi[data-a=like]'); if (l) l.classList.toggle('lk', isLiked(r.dataset.id)); });
}

/* ================= DOWNLOAD ================= */
async function download(s, q) {
  if (!s.u || !Object.keys(s.u).length) { try { const d = await api('/api/song?id=' + s.id); Object.assign(s, d.song || {}); } catch (e) { } }
  const raw = (s.u || {})[q] || s.raw; if (!raw) return toast('No file available');
  const nm = `${s.t} - ${s.a}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 110) + '.m4a';
  const a = document.createElement('a'); a.href = `/dl?u=${encodeURIComponent(raw)}&name=${encodeURIComponent(nm)}`; a.download = nm;
  document.body.appendChild(a); a.click(); a.remove();
  toast(`Downloading at ${q} kbps`);
  S.dls = [{ ...s, dq: q, at: Date.now() }, ...S.dls.filter(x => x.id !== s.id)]; save();
}
async function dlSheet(s) {
  if (!s.u || !Object.keys(s.u).length) { try { const d = await api('/api/song?id=' + s.id); Object.assign(s, d.song || {}); } catch (e) { } }
  const qs = Object.keys(s.u || {}).sort((a, b) => b - a);
  const size = q => s.d ? ((+q * 1000 / 8) * s.d / 1048576).toFixed(1) + ' MB' : '';
  modal(`<div class="qv"><img src="${s.img}"><div><h3>${esc(s.t)}</h3><div class="sb2">${esc(s.a)}</div></div></div>
    <div class="sb2">Choose a quality — the file saves directly to your device.</div>
    <div class="dlr">${qs.map(q => { const m = QUAL.find(x => x.v === q) || {};
      return `<button class="db" data-q="${q}">${m.n || q}<br><span style="font-weight:600;opacity:.55;font-size:10px">${q} kbps · ${size(q)}</span></button>`; }).join('') || '<span class="sb2">Unavailable</span>'}</div>`,
    m => m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { closeM(); download(s, b.dataset.q); }));
}
async function bulkDownload(list, label) {
  if (!list.length) return toast('Nothing to download');
  const q = S.dlMax ? '320' : S.q;
  let ok = 0, fail = 0, i = 0;
  const total = list.length;
  modal(`<h3>Downloading ${esc(label || 'collection')}</h3>
    <div class="sb2" id="bdSub">Preparing ${total} tracks at ${q} kbps…</div>
    <div class="bdbar"><div class="bdfill" id="bdFill"></div></div>
    <div class="bdstat" id="bdStat">0 of ${total}</div>
    <div class="sb2" style="margin-top:12px;font-size:11.5px;opacity:.7">Your browser may ask permission to save several files. Keep this tab open.</div>
    <button class="wb" id="bdStop">Stop</button>`);
  let stop = false; $('#bdStop').onclick = () => { stop = true; toast('Stopping after this file'); };
  for (const sg of list) {
    if (stop) break;
    i++;
    $('#bdSub') && ($('#bdSub').textContent = sg.t);
    $('#bdStat') && ($('#bdStat').textContent = `${i} of ${total}`);
    $('#bdFill') && ($('#bdFill').style.width = (i / total * 100) + '%');
    try {
      let t = sg;
      if (!t.u || !Object.keys(t.u).length) { const d = await api('/api/song?id=' + t.id, { cache: false }); if (d.song) t = { ...t, ...d.song }; }
      const raw = (t.u || {})[q] || t.raw || Object.values(t.u || {}).pop();
      if (!raw) { fail++; continue; }
      const nm = `${t.t} - ${t.a}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 110) + '.m4a';
      const a = document.createElement('a');
      a.href = `/dl?u=${encodeURIComponent(raw)}&name=${encodeURIComponent(nm)}`;
      a.download = nm; document.body.appendChild(a); a.click(); a.remove();
      S.dls = uniqById([{ ...t, dq: q, at: Date.now() }, ...S.dls]);
      ok++;
      await wait(700);
    } catch (e) { fail++; }
  }
  save();
  const sub = $('#bdSub'); if (sub) sub.textContent = `Finished — ${ok} saved${fail ? ', ' + fail + ' skipped' : ''}`;
  const st = $('#bdStat'); if (st) st.textContent = 'Done';
  const b = $('#bdStop'); if (b) { b.textContent = 'Close'; b.onclick = closeM; }
  toast(`Downloaded ${ok} of ${total}`);
}

function modal(h, after) { const m = $('#sheet');
  m.innerHTML = h + `<div class="dlr"><button class="db" id="mx" style="flex:1;opacity:.7">Close</button></div>`;
  $('#mdl').classList.add('open'); $('#mx').onclick = closeM; after && after(m); }
const closeM = () => $('#mdl').classList.remove('open');

function addToPl(s) {
  modal(`<h3>Add to playlist</h3><div class="sb2">${esc(s.t)}</div>
    <div class="dlr" style="flex-direction:column;align-items:stretch">
    ${S.pls.map((p, i) => `<button class="db" data-i="${i}" style="text-align:left">${esc(p.name)} <span style="opacity:.5">· ${p.songs.length}</span></button>`).join('') || '<span class="sb2">No playlists yet.</span>'}</div>
    <input class="inp" id="pn" placeholder="New playlist name"><button class="wb pri" id="pg">Create and add</button>`, m => {
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const p = S.pls[+b.dataset.i];
      if (p.songs.some(x => x.id === s.id)) return toast('Already in that playlist');
      p.songs.push(s); save(); closeM(); toast('Added to ' + p.name); });
    $('#pg').onclick = () => { const n = $('#pn').value.trim(); if (!n) return toast('Enter a name');
      S.pls.push({ id: Date.now(), name: n, songs: [s] }); save(); closeM(); toast('Created ' + n); };
  });
}

/* ================= BUILDERS ================= */
function cardEl(x, cb, yr) {
  const c = el('div', 'cd', `<div class="th"><img loading="lazy" decoding="async" src="${x.img}" alt="" onload="this.classList.add('rdy')" onerror="this.classList.add('rdy')">
    ${yr && x.y ? `<span class="yr">${esc(x.y)}</span>` : ''}
    <button class="pf">${I.play}</button></div>
    <div class="meta2"><h4>${esc(x.t)}</h4><p>${esc(x.s || x.a || '')}</p></div>`);
  c.onclick = cb; return c;
}
const sGrid = (a, rail, yr) => { const g = el('div', (rail ? 'rail sc' : 'grid') + ' stg'); a.forEach((s, i) => g.appendChild(cardEl(s, () => play(a, i), yr))); return g; };
const cGrid = (a, rail) => { const g = el('div', (rail ? 'rail sc' : 'grid') + ' stg'); a.forEach(x => g.appendChild(cardEl(x, () => x.k === 'artist' ? openArtist(x) : openColl(x)))); return g; };

function rowList(list, onDel, opt) {
  const w = el('div', 'rows');
  const sortable = opt && opt.sortable;
  list.forEach((s, i) => {
    const r = el('div', 'rw'); r.dataset.id = s.id; r.dataset.n = i + 1; r.dataset.pos = i;
    if (sortable) r.draggable = true;
    r.innerHTML = `<div class="rn">${sortable ? '<span class="grip"><svg viewBox="0 0 24 24"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg></span>' : (i + 1)}</div><img class="ra" loading="lazy" decoding="async" src="${s.img}" alt="">
      <div style="min-width:0"><div class="rt cl">${esc(s.t)}</div>
      <div class="rs cl">${esc(s.a)}${s.y ? ' · ' + esc(s.y) : ''}${s.pl ? ' · ' + nf(s.pl) : ''}</div></div>
      <div class="rc"><button class="mi ${isLiked(s.id) ? 'lk' : ''}" data-a="like" title="Like">${I.heart}</button>
      <button class="mi" data-a="dl" title="Download">${I.dl}</button>
      <button class="mi" data-a="more" title="More">${I.dots}</button>
      <span class="dr">${fmt(s.d)}</span></div>`;
    r.onclick = e => { const b = e.target.closest('[data-a]');
      if (b) { e.stopPropagation(); const a = b.dataset.a;
        a === 'like' ? like(s) : a === 'dl' ? dlSheet(s) : ctxMenu(e, s, onDel && (() => onDel(i))); return; }
      play(list, i); };
    r.oncontextmenu = e => { e.preventDefault(); ctxMenu(e, s, onDel && (() => onDel(i))); };
    let lt; r.addEventListener('touchstart', e => { lt = setTimeout(() => { buzz(14); ctxMenu(e.touches[0], s, onDel && (() => onDel(i))); }, 480); }, { passive: true });
    r.addEventListener('touchend', () => clearTimeout(lt)); r.addEventListener('touchmove', () => clearTimeout(lt), { passive: true });
    if (sortable) {
      r.addEventListener('dragstart', e => { dragFrom = i; r.classList.add('dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch (x) { } });
      r.addEventListener('dragend', () => { r.classList.remove('dragging');
        w.querySelectorAll('.rw').forEach(n => n.classList.remove('dropzone')); });
      r.addEventListener('dragover', e => { e.preventDefault();
        w.querySelectorAll('.rw').forEach(n => n.classList.remove('dropzone')); r.classList.add('dropzone'); });
      r.addEventListener('drop', e => { e.preventDefault(); r.classList.remove('dropzone');
        const from = dragFrom, to = i;
        if (from == null || from === to) return;
        opt.onMove(from, to); });
    }
    w.appendChild(r);
  });
  setTimeout(markRows, 0); return w;
}
let dragFrom = null;
function moveInQueue(from, to) {
  const wasPlaying = S.queue[S.idx];
  const [item] = S.queue.splice(from, 1);
  S.queue.splice(to, 0, item);
  S.idx = S.queue.findIndex(x => x === wasPlaying);
  if (S.idx < 0) S.idx = 0;
  counts(); render(); toast('Queue reordered');
}
function ctxMenu(e, s, del) {
  const c = $('#ctx');
  const items = [['p', I.play, 'Play now'], ['n', I.next, 'Play next'], ['q', I.queue, 'Add to queue'],
  ['l', I.heart, isLiked(s.id) ? 'Remove from Liked' : 'Add to Liked'], ['f', I.plus, 'Add to playlist'],
  ['d', I.dl, 'Download'], ['r', I.radio, 'Start radio'], ['a', I.mic, 'More by artist'],
  ['b', I.disc, 'Open album'], ['s', I.share, 'Share'], ...(S.room ? [['m', I.plus, 'Add to room queue'], ['M', I.radio, 'Play in room now']] : []), ...(del ? [['x', I.trash, 'Remove']] : [])];
  c.innerHTML = items.map(([k, ic, t]) => `<button data-k="${k}">${ic}${t}</button>`).join('');
  c.classList.add('open');
  const h = c.offsetHeight || 380;
  c.style.left = clamp(e.clientX, 8, innerWidth - 216) + 'px';
  c.style.top = clamp(e.clientY, 8, innerHeight - h - 10) + 'px';
  c.querySelectorAll('button').forEach(b => b.onclick = () => { c.classList.remove('open'); const k = b.dataset.k;
    if (k === 'p') play([s], 0);
    if (k === 'n') { S.queue.splice(S.idx + 1, 0, s); counts(); toast('Playing next'); }
    if (k === 'q') { S.queue.push(s); counts(); toast('Added to queue'); }
    if (k === 'l') like(s);
    if (k === 'f') addToPl(s);
    if (k === 'd') dlSheet(s);
    if (k === 'r') startRadio(s);
    if (k === 'a') openArtist({ t: s.a.split(',')[0].trim() });
    if (k === 'b') s.alId ? openColl({ id: s.alId, t: s.al, k: 'album' }) : toast('No album linked');
    if (k === 's') { const tx = `${s.t} — ${s.a}`;
      navigator.share ? navigator.share({ title: tx, text: 'Listening on Sonora' }).catch(() => { }) : (navigator.clipboard?.writeText(tx), toast('Copied')); }
    if (k === 'm') roomAdd(s);
    if (k === 'M') roomPlayNow(s);
    if (k === 'x') del();
  });
}
document.addEventListener('click', e => { if (!e.target.closest('#ctx')) $('#ctx').classList.remove('open'); });

async function startRadio(s) {
  toast('Building your radio');
  try { let d = await api('/api/similar?id=' + s.id); let l = d.songs || [];
    if (l.length < 5) { d = await api('/api/search?q=' + encodeURIComponent(s.a) + '&n=30'); l = d.songs || []; }
    play([s, ...l.filter(x => x.id !== s.id)], 0); counts();
  } catch (e) { play([s], 0); }
}
function H(t, b, ac) {
  const w = el('div', 'shead');
  w.innerHTML = `<div class="txt"><h2>${esc(t)}</h2>${b ? `<div class="sub2">${esc(b)}</div>` : ''}</div>`;
  return w;
}
function Hx(t, sub, actions) {         // header with buttons on the right
  const w = H(t, sub);
  if (actions?.length) { const a = el('div', 'act');
    actions.forEach(([lbl, fn]) => { const b = el('button', 'chip', lbl); b.onclick = fn; a.appendChild(b); });
    w.appendChild(a); }
  return w;
}
const skel = n => { const g = el('div', 'grid'); for (let i = 0; i < n; i++) g.appendChild(el('div', 'sk2 skc')); return g; };
const emptyBox = (ic, a, b) => el('div', 'mt', `<div class="ico">${ic}</div><h3>${esc(a)}</h3><p>${esc(b)}</p>`);
function errBox(fn) { const e = el('div', 'er', `<span>Couldn't load that. Check your connection.</span><button>Retry</button>`);
  e.querySelector('button').onclick = fn; return e; }
function playBar(list) {
  const b = el('div', 'chips');
  const mk = (t, on, fn) => { const x = el('button', 'chip' + (on ? ' on' : ''), t); x.onclick = fn; return x; };
  b.append(mk('Play all', 1, () => play(list, 0)),
    mk('Shuffle', 0, () => { S.shuffle = true; $('#shuf').classList.add('on'); play([...list].sort(() => Math.random() - .5), 0); }),
    mk('Start radio', 0, () => list[0] && startRadio(list[0])),
    mk('Add to queue', 0, () => { S.queue.push(...list); counts(); toast(list.length + ' tracks queued'); }),
    mk('Download all', 0, () => confirmBulk(list)),
    ...(S.room ? [mk('Play in room', 0, () => roomPlayList(list))] : []));
  return b;
}
function confirmBulk(list) {
  const q = S.dlMax ? '320' : S.q;
  const mb = list.reduce((a, s) => a + (s.d ? (+q * 1000 / 8) * s.d / 1048576 : 4), 0);
  modal(`<h3>Download ${list.length} tracks</h3>
    <div class="sb2">Quality ${q} kbps · roughly ${mb.toFixed(0)} MB total. Files save one by one.</div>
    <button class="wb pri" id="bdGo">Start download</button>`,
    () => { $('#bdGo').onclick = () => { closeM(); setTimeout(() => bulkDownload(list, list.length + ' tracks'), 260); }; });
}
const gap = h => el('div', '', `<div style="height:${h || 12}px"></div>`);

/* ================= DATA ================= */
const LANGS = ['hindi', 'english', 'punjabi', 'bhojpuri', 'tamil', 'telugu', 'haryanvi', 'marathi', 'bengali', 'kannada', 'malayalam', 'gujarati', 'urdu', 'rajasthani'];
const MOODS = [['Party', 'party dance hits', 210], ['Romance', 'romantic love songs', 340], ['Heartbreak', 'sad emotional breakup', 220],
['Workout', 'gym workout motivation', 30], ['Chill', 'chill relaxing songs', 160], ['Lo-Fi', 'lofi chill beats', 270],
['Devotional', 'bhajan devotional aarti', 40], ['Road Trip', 'travel road trip', 180], ['Sleep', 'sleep soothing calm', 230],
['Deep Focus', 'instrumental study focus', 200], ['Ghazal', 'ghazal jagjit singh', 280], ['Sufi', 'sufi qawwali', 20],
['Bhojpuri', 'bhojpuri superhit', 320], ['Punjabi', 'punjabi hits', 350], ['Wedding', 'shaadi wedding songs', 300], ['Kids', 'kids nursery rhymes hindi', 190]];
const ERAS = [['1950', '1950s', 'Black and white classics'], ['1960', '1960s', 'Rafi, Lata and Mukesh'], ['1970', '1970s', 'The R.D. Burman years'],
['1980', '1980s', 'Disco meets melody'], ['1990', '1990s', 'Kumar Sanu and Alka'], ['2000', '2000s', 'Sonu and Shreya'], ['2010', '2010s', 'The Arijit era']];

function nav(v, push = true) { if (push && S.view !== v) S.stack.push({ v: S.view, c: S.custom });
  S.view = v; S.custom = false; closeSide(); $('#main').scrollTop = 0; render(); }
function render() {
  $$('.nav').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  counts();
  const v = $('#view'); v.innerHTML = '';
  const F = { home: vHome, trend: vTrend, search: vSearch, mood: vMood, era: vEra, studio: vStudio,
    room: vRoom, pls: vPls, stats: vStats, prefs: vPrefs,
    legal: vLegal,
    liked: () => vLib(v, S.liked, 'Liked Songs', 'Nothing liked yet', 'Tap the heart on any track'),
    queue: () => vQueue(v),
    recent: () => vLib(v, S.recent, 'Listening History', 'No history yet', 'Recently played tracks appear here'),
    dls: () => vLib(v, S.dls, 'Downloads', 'No downloads yet', 'Use the download icon on any track') };
  (F[S.view] || vHome)(v);
  v.appendChild(liveStrip());
}
function vQueue(v) {
  const list = S.queue;
  v.appendChild(H('Play Queue', list.length ? `${list.length} tracks · playing ${Math.max(1, S.idx + 1)}` : 'Queue is empty'));
  if (!list.length) return v.appendChild(emptyBox(I.queue, 'Queue is empty', 'Start something to fill it up'));
  v.appendChild(playBar(list));
  const tools = el('div', 'qtools');
  const mk = (t, fn) => { const b = el('button', 'sbtn', t); b.onclick = fn; return b; };
  tools.append(
    mk('Shuffle order', () => { const cur = S.queue[S.idx];
      S.queue = [...S.queue].sort(() => Math.random() - .5);
      S.idx = Math.max(0, S.queue.findIndex(x => x === cur)); render(); toast('Queue shuffled'); }),
    mk('Clear played', () => { if (S.idx <= 0) return toast('Nothing played yet');
      S.queue = S.queue.slice(S.idx); S.idx = 0; counts(); render(); toast('Played tracks removed'); }),
    mk('Clear upcoming', () => { S.queue = S.queue.slice(0, S.idx + 1); counts(); render(); toast('Upcoming cleared'); }),
    mk('Save as playlist', () => modal(`<h3>Save queue as playlist</h3>
      <div class="sb2">${list.length} tracks</div><input class="inp" id="qpn" placeholder="Playlist name">
      <button class="wb pri" id="qpg">Create</button>`, () => {
        $('#qpg').onclick = () => { const n = $('#qpn').value.trim(); if (!n) return toast('Enter a name');
          S.pls.push({ id: Date.now(), name: n, songs: [...list] }); save(); closeM(); toast('Saved as ' + n); }; })),
    mk('Empty queue', () => { S.queue = []; S.idx = -1; au.pause(); counts(); render(); toast('Queue emptied'); }));
  v.appendChild(tools);
  v.appendChild(el('div', 'sb2', 'Drag any row by its handle to reorder.'));
  v.appendChild(rowList(list, i => { S.queue.splice(i, 1); if (i < S.idx) S.idx--; counts(); render(); },
    { sortable: true, onMove: moveInQueue }));
}

function vLib(v, list, ti, e1, e2, isq) {
  v.appendChild(H(ti, list.length ? list.length + ' tracks' : 'Nothing here yet'));
  if (!list.length) return v.appendChild(emptyBox(I.music, e1, e2));
  v.appendChild(playBar(list)); v.appendChild(gap());
  v.appendChild(rowList(list, i => { list.splice(i, 1); if (isq && i < S.idx) S.idx--; save(); render(); }));
}
function langRow(cb) { const c = el('div', 'crow sc');
  LANGS.forEach(l => { const b = el('button', 'chip' + (l === S.lang ? ' on' : ''), l[0].toUpperCase() + l.slice(1));
    b.onclick = () => { S.lang = l; SET('lang', l); cb(); }; c.appendChild(b); }); return c; }

async function vHome(v) {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const hero = el('div', 'hero', `
    <span class="kicker"><svg viewBox="0 0 24 24"><path d="M12 2.5l2.2 6.1 6.3.3-4.9 4 1.7 6.1L12 15.6 6.7 19l1.7-6.1-4.9-4 6.3-.3z"/></svg> No ads · No sign-up</span>
    <h1>${greet}</h1>
    <p>Studio-grade audio in <b>320 kbps</b>, a real seven-band equaliser, lyrics, offline downloads and rooms where friends listen in sync.</p>
    <div class="hact">
      <button class="hb pri" id="hPlay"><svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z"/></svg> Play trending</button>
      <button class="hb" id="hShuf"><svg viewBox="0 0 24 24"><path d="M16 3.5h4.5V8"/><path d="M3.5 20.5 20.5 3.5"/><path d="M20.5 16v4.5H16"/><path d="m15 15 5.5 5.5"/><path d="M3.5 3.5 9 9"/></svg> Shuffle</button>
      <button class="hb" id="hBrowse">Browse catalog</button>
    </div>
    <div class="eqmini"><i></i><i></i><i></i><i></i><i></i></div>`);
  hero.appendChild(langRow(render)); v.appendChild(hero);
  let pool = [];
  $('#hPlay').onclick = () => pool.length ? play(pool, 0) : toast('Still loading — one moment');
  $('#hShuf').onclick = () => { if (!pool.length) return toast('Still loading');
    S.shuffle = true; $('#shuf').classList.add('on'); play([...pool].sort(() => Math.random() - .5), 0); };
  $('#hBrowse').onclick = () => nav('trend');

  if (S.recent.length) { v.appendChild(H('Jump back in', 'Pick up where you left off')); v.appendChild(railWrap(sGrid(S.recent.slice(0, 16), true))); }
  if (S.liked.length > 3) { v.appendChild(H('From your likes', 'Built from the songs you saved')); v.appendChild(railWrap(sGrid([...S.liked].sort(() => Math.random() - .5).slice(0, 16), true))); }
  const slots = {};
  [['trending', 'Trending now', S.lang], ['charts', 'Top charts'], ['playlists', 'Curated playlists'],
  ['albums', 'New releases'], ['radio', 'Stations']].forEach(([k, t, b]) => {
    v.appendChild(H(t, b)); const d = el('div'); d.appendChild(skel(6)); v.appendChild(d); slots[k] = d; });
  try {
    const d = await api('/api/home?lang=' + S.lang);
    pool = (d.trending || []).filter(x => x.u);
    for (const k in slots) { const a = d[k] || []; slots[k].innerHTML = '';
      slots[k].appendChild(a.length ? railWrap(a[0].u ? sGrid(a, true) : cGrid(a, true)) : emptyBox(I.music, 'Nothing here yet', 'Try another language')); }
    if (d.degraded) toast('Running on backup source');
  } catch (e) {
    for (const k in slots) slots[k].innerHTML = '';
    slots.trending.appendChild(errBox(render));
  }
  // Smart mixes built from what this listener actually plays
  const mixes = buildMixes();
  if (mixes.length) {
    v.appendChild(H('Made for you', 'Mixes built from what you play'));
    const mw = el('div', 'mixrow stg');
    mixes.forEach(m => {
      const c = el('div', 'mixcard', `<div class="mimg" style="background-image:url('${esc(m.img)}')"></div>
        <div class="mlbl">${esc(m.lbl)}</div><b>${esc(m.t)}</b><span>${esc(m.s)}</span>`);
      c.onclick = () => openMix(m); mw.appendChild(c);
    });
    v.appendChild(mw);
  }
  v.appendChild(H('Golden era', 'Classics and fresh takes, decade by decade'));
  const g = el('div', 'tiles stg');
  ERAS.forEach(([y, n, d], i) => g.appendChild(tile(n, d, i * 44 + 20, () => openEra(y, n))));
  v.appendChild(g);
}
function railWrap(rail) {
  const w = el('div', 'railwrap'); w.appendChild(rail);
  const mk = (dir, cls) => { const b = el('button', 'rnav ' + cls,
    `<svg viewBox="0 0 24 24"><path d="M${dir < 0 ? '14.5 5 8 12l6.5 7' : '9.5 5 16 12l-6.5 7'}"/></svg>`);
    b.onclick = e => { e.stopPropagation(); rail.scrollBy({ left: dir * rail.clientWidth * .8, behavior: 'smooth' }); }; return b; };
  w.append(mk(-1, 'l'), mk(1, 'r')); return w;
}
function buildMixes() {
  const out = [], seen = new Set();
  const pool = [...S.recent, ...S.liked];
  if (pool.length < 3) return out;
  const byArtist = {};
  pool.forEach(x => { const a = (x.a || '').split(',')[0].trim();
    if (!a) return; (byArtist[a] = byArtist[a] || []).push(x); });
  Object.entries(byArtist).sort((a, b) => b[1].length - a[1].length).slice(0, 3).forEach(([a, list]) => {
    if (seen.has(a)) return; seen.add(a);
    out.push({ kind: 'artist', t: a + ' Radio', s: 'Built around ' + a, lbl: 'Artist mix',
      img: list[0].img, q: a });
  });
  if (S.liked.length >= 4) out.push({ kind: 'liked', t: 'Your Favourites', s: S.liked.length + ' liked tracks, shuffled',
    lbl: 'On repeat', img: S.liked[0].img });
  const langs = {};
  pool.forEach(x => { if (x.lg) langs[x.lg] = (langs[x.lg] || 0) + 1; });
  const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
  if (topLang && pool[0]) out.push({ kind: 'lang', t: topLang[0][0].toUpperCase() + topLang[0].slice(1) + ' Daily',
    s: 'Fresh picks in your top language', lbl: 'Daily mix', img: pool[Math.min(2, pool.length - 1)].img, q: 'top ' + topLang[0] + ' hits' });
  const decades = {};
  pool.forEach(x => { const y = +x.y; if (y > 1940) decades[Math.floor(y / 10) * 10] = (decades[Math.floor(y / 10) * 10] || 0) + 1; });
  const topDec = Object.entries(decades).sort((a, b) => b[1] - a[1])[0];
  if (topDec && +topDec[1] >= 2) out.push({ kind: 'era', t: topDec[0] + 's Rewind',
    s: 'The decade you play the most', lbl: 'Time machine', img: pool[Math.min(1, pool.length - 1)].img, e: topDec[0] });
  return out.slice(0, 5);
}
async function openMix(m) {
  if (m.kind === 'liked') { const l = [...S.liked].sort(() => Math.random() - .5);
    S.shuffle = true; $('#shuf').classList.add('on'); return play(l, 0); }
  if (m.kind === 'era') return openEra(m.e, m.e + 's');
  S.custom = true; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  v.appendChild(H(m.t, m.s));
  const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  try {
    const ep = m.kind === 'artist' ? '/api/mix?a=' + encodeURIComponent(m.q) : '/api/mood?q=' + encodeURIComponent(m.q);
    const d = await api(ep);
    const songs = d.songs || []; b.innerHTML = '';
    if (!songs.length) return b.appendChild(emptyBox(I.music, 'Nothing found', 'Try again shortly'));
    b.appendChild(playBar(songs)); b.appendChild(gap(10));
    b.appendChild(railWrap(sGrid(songs.slice(0, 12), true)));
    b.appendChild(H('All tracks', songs.length + ' in this mix'));
    b.appendChild(rowList(songs));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => openMix(m))); }
  v.appendChild(liveStrip());
}

function tile(title, sub, hue, cb, big) {
  const t = el('div', 'tile', `${big ? `<div class="num">${esc(big)}</div>` : ''}${esc(title)}<small>${esc(sub)}</small>`);
  t.style.setProperty('--h', hue);
  t.querySelector; const b = el('div'); // gradient layer via inline style on ::before not possible → use background
  t.style.background = `linear-gradient(150deg,hsl(${hue} 58% 22%),hsl(${hue + 40} 52% 12%))`;
  t.onclick = cb; return t;
}
async function vTrend(v) {
  v.appendChild(H('Trending', 'The most played tracks right now')); v.appendChild(langRow(render));
  const b = el('div'); b.appendChild(skel(10)); v.appendChild(b);
  try { const [d, t] = await Promise.all([api('/api/home?lang=' + S.lang), api('/api/top').catch(() => ({ items: [] }))]);
    b.innerHTML = '';
    const add = (ti, a) => { if (!a?.length) return; b.appendChild(H(ti)); b.appendChild(a[0].u ? sGrid(a) : cGrid(a)); };
    add('Trending now', d.trending); add('Popular searches', t.items); add('Charts', d.charts);
    add('Curated playlists', d.playlists); add('New albums', d.albums); add('Stations', d.radio);
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(render)); }
}
let sT;
async function vSearch(v) {
  const q = $('#q').value.trim();
  v.appendChild(H('Search', q ? 'Results for \u201c' + q + '\u201d' : 'Find anything in seconds'));
  if (!q) { v.appendChild(emptyBox('<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.8"/><path d="M20 20l-4-4"/></svg>',
      'What do you want to hear?', 'Search songs, artists, albums or playlists'));
    v.appendChild(H('Popular right now', 'Trending searches'));
    const c = el('div', 'chips');
    ['Arijit Singh', 'Kishore Kumar', '90s hits', 'Lo-fi', 'Punjabi', 'Bhojpuri', 'Ghazal', 'Workout', 'Shreya Ghoshal'].forEach(x => {
      const b = el('button', 'chip', x); b.onclick = () => { $('#q').value = x; doSearch(); }; c.appendChild(b); });
    v.appendChild(c); return; }
  const b = el('div'); b.appendChild(skel(8)); v.appendChild(b);
  try { const d = await api('/api/searchall?q=' + encodeURIComponent(q)); b.innerHTML = '';
    if (d.artists?.length) { b.appendChild(H('Artists', 'Matching performers')); b.appendChild(railWrap(cGrid(d.artists, true))); }
    if (d.songs?.length) { b.appendChild(H('Songs', d.songs.length + ' matches')); b.appendChild(playBar(d.songs)); b.appendChild(gap(10)); b.appendChild(rowList(d.songs)); }
    if (d.albums?.length) { b.appendChild(H('Albums', 'Full records')); b.appendChild(railWrap(cGrid(d.albums, true))); }
    if (d.playlists?.length) { b.appendChild(H('Playlists', 'Ready-made collections')); b.appendChild(railWrap(cGrid(d.playlists, true))); }
    if (!d.songs?.length && !d.albums?.length) b.appendChild(emptyBox(I.music, 'No results', 'Try a different spelling'));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => render())); }
}
const doSearch = () => { $('#sug').classList.remove('open'); S.custom = false; if (S.view !== 'search') nav('search'); else render(); };
function vMood(v) {
  v.appendChild(el('div', 'hero', `<h1>Moods &amp; <em>genres</em></h1><p>Pick a feeling and we'll assemble the mix instantly.</p>`));
  v.appendChild(H('Browse', MOODS.length + ' collections, one tap each'));
  const g = el('div', 'tiles stg');
  MOODS.forEach(([n, q, hue]) => g.appendChild(tile(n, 'Tap to play', hue, () => openMood(n, q))));
  v.appendChild(g);
}
function vEra(v) {
  v.appendChild(el('div', 'hero', `<h1>The <em>golden era</em></h1>
    <p>Classics, modern remakes and lo-fi flips side by side. Pick a decade for the originals, or stay up here for the fresh takes.</p>`));

  v.appendChild(H('Decades', 'The original recordings'));
  const g = el('div', 'tiles stg');
  ERAS.forEach(([y, n, d], i) => g.appendChild(tile(n, d, i * 44 + 20, () => openEra(y, n))));
  v.appendChild(g);

  v.appendChild(H('Old songs, new sound', 'Remakes, lo-fi flips and covers'));
  const mixSlots = {};
  ['Modern remakes', 'Lo-fi classics', 'Timeless originals'].forEach(k => {
    v.appendChild(H(k)); const d = el('div'); d.appendChild(skel(6)); v.appendChild(d); mixSlots[k] = d; });
  api('/api/goldmix').then(d => {
    for (const k in mixSlots) { const a = d[k] || []; mixSlots[k].innerHTML = '';
      mixSlots[k].appendChild(a.length ? railWrap(sGrid(a, true, 1)) : emptyBox(I.music, 'Nothing here', 'Try again shortly')); }
  }).catch(() => { for (const k in mixSlots) { mixSlots[k].innerHTML = ''; } mixSlots['Modern remakes'].appendChild(errBox(render)); });

  v.appendChild(H('Legendary voices', 'The artists who defined an era'));
  const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  api('/api/legends').then(d => { b.innerHTML = ''; b.appendChild(railWrap(cGrid(d.items || [], true))); })
    .catch(() => { b.innerHTML = ''; b.appendChild(errBox(render)); });
}

function vStudio(v) {
  v.appendChild(el('div', 'hero', `<h1>Sound <em>Studio</em></h1>
    <p>Sixteen engineered profiles built on a real biquad chain — each one reshapes depth, space, tone and speed in real time.</p>`));
  v.appendChild(H('Sound modes', S.mode !== 'off' ? 'Active: ' + MODES[S.mode].n : 'Sixteen engineered profiles'));
  const g = el('div', 'tiles stg');
  Object.keys(MODES).forEach((k, i) => { const t = tile(MODES[k].n, MODES[k].d, i * 23 + 60, () => { setMode(k); render(); });
    if (S.mode === k) { t.style.background = 'var(--grad)'; t.style.color = 'var(--acd)'; t.style.borderColor = 'transparent'; t.style.boxShadow = 'var(--glow)'; }
    g.appendChild(t); });
  v.appendChild(g);
  v.appendChild(H('Equaliser', 'Seven bands, eight presets — currently ' + S.eqPre));
  const b = el('div', 'chips');
  const o = el('button', 'chip on', 'Open 7-band EQ'); o.onclick = () => openPan('#eqPan'); b.appendChild(o);
  Object.keys(EQP).slice(0, 5).forEach(k => { const x = el('button', 'chip' + (S.eqPre === k ? ' on' : ''), k[0].toUpperCase() + k.slice(1));
    x.onclick = () => { setEQPreset(k); render(); }; b.appendChild(x); });
  v.appendChild(b);
  [['Lo-fi picks', 'lofi chill beats'], ['Slowed and reverb', 'slowed reverb'], ['Built for 8D', '8d audio songs']].forEach(([t, qq]) => {
    v.appendChild(H(t)); const d = el('div'); d.appendChild(skel(6)); v.appendChild(d);
    api('/api/mood?q=' + encodeURIComponent(qq)).then(r => { d.innerHTML = ''; d.appendChild(sGrid(r.songs || [], true)); }).catch(() => d.innerHTML = '');
  });
}
function vStats(v) {
  const st = S.stats, top = Object.entries(st.artists).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topMode = Object.entries(st.modes || {}).sort((a, b) => b[1] - a[1])[0];
  v.appendChild(el('div', 'hero', `<h1>Your <em>insights</em></h1><p>Everything is computed on this device. Nothing ever leaves it.</p>`));
  v.appendChild(H('Overview', 'Everything stays on this device'));
  const g = el('div', 'tiles stg');
  [[st.plays, 'tracks played'], [Math.round(st.secs / 60), 'minutes listened'], [S.liked.length, 'liked songs'],
  [S.dls.length, 'downloads'], [S.pls.length, 'playlists'], [Object.keys(st.artists).length, 'unique artists']]
    .forEach(([n, l], i) => g.appendChild(tile('', l, i * 52 + 30, () => { }, String(n))));
  v.appendChild(g);
  if (topMode) { v.appendChild(H('Favourite sound mode', 'Your go-to profile'));
    v.appendChild(el('div', 'bds', `<span class="bd">${esc(MODES[topMode[0]]?.n || topMode[0])} · used ${topMode[1]}×</span>`)); }
  if (top.length) { v.appendChild(H('Top artists', 'Who you play the most'));
    const w = el('div', 'rows');
    top.forEach(([n, c], i) => { const r = el('div', 'rw'); r.style.gridTemplateColumns = '30px 1fr auto';
      r.innerHTML = `<div class="rn">${i + 1}</div><div class="rt">${esc(n)}</div><div class="dr">${c}</div>`;
      r.onclick = () => openArtist({ t: n }); w.appendChild(r); });
    v.appendChild(w); }
  const b = el('div', 'chips'); const c = el('button', 'chip', 'Reset insights');
  c.onclick = () => { S.stats = { secs: 0, plays: 0, artists: {}, modes: {} }; save(); render(); toast('Insights cleared'); };
  b.appendChild(c); v.appendChild(b);
}
function vPls(v) {
  v.appendChild(H('Your playlists', S.pls.length + ' saved on this device'));
  const b = el('div', 'chips'); const n = el('button', 'chip on', 'New playlist');
  n.onclick = () => modal(`<h3>New playlist</h3><input class="inp" id="pn" placeholder="Name"><button class="wb pri" id="pg">Create</button>`,
    () => { $('#pg').onclick = () => { const nm = $('#pn').value.trim(); if (!nm) return toast('Enter a name');
      S.pls.push({ id: Date.now(), name: nm, songs: [] }); save(); closeM(); render(); }; });
  b.appendChild(n); v.appendChild(b);
  if (!S.pls.length) return v.appendChild(emptyBox(I.queue, 'No playlists yet', 'Create one, then long-press any track to add'));
  const g = el('div', 'grid stg'); g.style.gridTemplateColumns = 'repeat(auto-fill,minmax(210px,1fr))';
  S.pls.forEach((p, i) => { const c = el('div', 'plc', `<h4>${esc(p.name)}</h4><p>${p.songs.length} tracks</p>`);
    c.onclick = () => openPl(i); g.appendChild(c); });
  v.appendChild(g);
}
function openPl(i) {
  S.custom = true; const p = S.pls[i], v = $('#view'); v.innerHTML = '';
  v.appendChild(H(p.name, p.songs.length + ' tracks'));
  const b = el('div', 'chips');
  if (p.songs.length) { const a = el('button', 'chip on', 'Play all'); a.onclick = () => play(p.songs, 0); b.appendChild(a); }
  const d = el('button', 'chip', 'Delete playlist');
  d.onclick = () => { if (confirm('Delete "' + p.name + '"?')) { S.pls.splice(i, 1); save(); nav('pls', false); } };
  b.appendChild(d); v.appendChild(b); v.appendChild(gap());
  v.appendChild(p.songs.length ? rowList(p.songs, j => { p.songs.splice(j, 1); save(); openPl(i); }) : emptyBox(I.music, 'Empty playlist', 'Add tracks from the ⋯ menu'));
}
function vPrefs(v) {
  v.appendChild(el('div', 'hero', `<h1>Settings</h1>
    <p>Every preference lives on this device. Nothing is uploaded, nothing is tracked to you.</p>`));

  // --- grouped setting cards ---
  const group = (title, sub) => { v.appendChild(H(title, sub)); const g = el('div', 'setgrid'); v.appendChild(g); return g; };

  const row = (g, title, desc, control) => {
    const r = el('div', 'setrow');
    r.innerHTML = `<div class="si2"><b>${esc(title)}</b><span>${esc(desc)}</span></div>`;
    r.appendChild(control); g.appendChild(r); return r;
  };
  const btn = (label, fn, pri) => { const b = el('button', 'sbtn' + (pri ? ' pri' : ''), label); b.onclick = fn; return b; };
  const toggle = (on, fn) => { const t = el('div', 'sww' + (on ? ' on' : ''));
    t.onclick = () => { const nv = !t.classList.contains('on'); t.classList.toggle('on', nv); fn(nv); }; return t; };
  const seg = (opts, cur, fn) => { const w = el('div', 'seg');
    opts.forEach(([k, l]) => { const b = el('button', cur === k ? 'on' : '', l);
      b.onclick = () => { fn(k); w.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      w.appendChild(b); }); return w; };

  let g = group('Appearance', 'Make it yours');
  row(g, 'Theme and accent', 'Six themes, six accent colours', btn('Open panel', () => openPan('#thPan'), 1));
  row(g, 'Layout density', 'How much fits on screen', seg([['compact', 'Compact'], ['default', 'Default'], ['cozy', 'Cozy'], ['list', 'List']], S.dens, setDens));
  row(g, 'Corner style', 'Sharp, default or rounded', seg([['sharp', 'Sharp'], ['default', 'Default'], ['round', 'Round']], S.corner, setCorner));
  row(g, 'Typeface', 'Reading style across the app', seg([['grotesk', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['round', 'Round']], S.font, setFont));
  row(g, 'High contrast', 'Stronger text and borders', toggle(document.body.dataset.hc === '1',
    on => { document.body.dataset.hc = on ? '1' : '0'; SET('hc', on); }));
  row(g, 'Animated artwork', 'Spinning disc in full screen', toggle(S.spin, on => { S.spin = on; SET('spin', on); }));

  g = group('Playback', 'How Sonora sounds and behaves');
  row(g, 'Streaming quality', QUAL.find(x => x.v === S.q).n + ' · ' + S.q + ' kbps', btn('Change', () => openPan('#qPan'), 1));
  row(g, 'Equaliser and modes', 'Seven bands, sixteen profiles', btn('Open studio', () => openPan('#eqPan'), 1));
  row(g, 'Autoplay similar', 'Keep going when the queue ends', toggle(S.autoplay, on => { S.autoplay = on; SET('auto', on); $('#autoB').classList.toggle('on', on); }));
  row(g, 'Peak limiter', 'Off keeps the signal untouched', toggle(S.cmp, on => { S.cmp = on; SET('cmp', on); $('#swCmp').classList.toggle('on', on); applyFX(); }));
  row(g, 'Crossfade', 'Blend the gap between tracks', toggle(S.fade, on => { S.fade = on; $('#swFade').classList.toggle('on', on); }));
  row(g, 'Adapt to network', 'Drop quality automatically when slow', toggle(S.adapt, on => { S.adapt = on; SET('adapt', on); $('#swAdapt').classList.toggle('on', on); }));
  row(g, 'Download at max quality', 'Always save at 320 kbps', toggle(S.dlMax, on => { S.dlMax = on; SET('dlMax', on); $('#swDlMax').classList.toggle('on', on); }));
  const qsel = el('select', 'sinp');
  Object.keys(MODES).filter(k => k !== 'off').forEach(k => { const o = el('option'); o.value = k; o.textContent = MODES[k].n;
    if (S.quick === k) o.selected = true; qsel.appendChild(o); });
  qsel.onchange = () => { S.quick = qsel.value; SET('quick', S.quick); paintQuick(); toast('Quick button set to ' + MODES[S.quick].n); };
  row(g, 'Quick button mode', 'What the player-bar toggle switches on', qsel);
  row(g, 'Sleep timer', 'Fade out and stop automatically', btn('Set timer', () => openPan('#tmPan')));

  g = group('Rooms', 'Listening together');
  const nameIn = el('input', 'sinp'); nameIn.value = S.me; nameIn.maxLength = 18;
  nameIn.oninput = () => { S.me = nameIn.value.trim() || 'Guest'; SET('me', S.me); };
  row(g, 'Display name', 'How others see you in a room', nameIn);
  row(g, S.room ? 'Current room' : 'Start a room', S.room ? 'Code ' + S.room : 'Invite friends with one link',
    btn(S.room ? 'Open room' : 'Create', () => S.room ? nav('room') : joinRoom(Math.random().toString(36).slice(2, 7).toUpperCase(), true), 1));

  g = group('Library', 'Your data, your control');
  row(g, 'Liked songs', S.liked.length + ' saved', btn('View', () => nav('liked')));
  row(g, 'Downloads', S.dls.length + ' files', btn('View', () => nav('dls')));
  row(g, 'Export library', 'Save likes, playlists and history as JSON', btn('Export', () => {
    const bl = new Blob([JSON.stringify({ v: 1, liked: S.liked, pls: S.pls, recent: S.recent, stats: S.stats }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(bl);
    a.download = 'sonora-library-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); toast('Library exported'); }));
  row(g, 'Import library', 'Restore from a previous export', btn('Import', () => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.json';
    f.onchange = async () => { try { const j = JSON.parse(await f.files[0].text());
      if (j.liked) S.liked = uniqById(j.liked); if (j.pls) S.pls = j.pls;
      if (j.recent) S.recent = uniqById(j.recent); if (j.stats) S.stats = j.stats;
      save(); render(); toast('Library imported'); } catch { toast('That file could not be read'); } }; f.click(); }));
  row(g, 'Clear history', 'Forget recently played', btn('Clear', () => { S.recent = []; save(); toast('History cleared'); render(); }));
  row(g, 'Reset everything', 'Erase all local Sonora data', btn('Reset', () => {
    if (confirm('Erase all local Sonora data? This cannot be undone.')) { localStorage.clear(); location.reload(); } }));

  g = group('About', 'Sonora');
  row(g, 'Community', (liveData.total || 0) + ' total listeners · ' + (liveData.n || 0) + ' online now',
    btn('Refresh', () => { beat(); toast('Refreshed'); }));
  row(g, 'About and legal', 'Terms, privacy and takedown policy', btn('Read', () => nav('legal')));
  row(g, 'Force update', 'Clear cached files and reload', btn('Update now', async () => {
    try { if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { } sessionStorage.clear(); toast('Updating…'); setTimeout(() => location.reload(true), 500); }));

  v.appendChild(H('Keyboard shortcuts', 'Faster with two hands'));
  const k = el('div', 'bds');
  ['Space play', '← → seek', '↑ ↓ volume', 'N next', 'P previous', 'S shuffle', 'R repeat',
    'L like', 'D download', 'F full screen', 'Y lyrics', 'M mute', 'C room chat', 'Q quick mode', 'K commands', 'Ctrl+K palette', '/ search', '1-9 modes', 'Esc close']
    .forEach(x => k.appendChild(el('span', 'bd', x)));
  v.appendChild(k);
}

function vLegal(v) {
  v.appendChild(el('div', 'hero', `<h1>About <em>Sonora</em></h1>
    <p>A personal, account-free music player. Here is exactly what it is, what it stores, and how to reach us.</p>`));
  const d = el('div', 'doc');
  d.innerHTML = `
    <div class="notice"><b>What Sonora is</b>
      <p>A browser-based player and equaliser. It hosts no audio, artwork or lyrics of its own — it reads
      publicly reachable endpoints and presents them with a nicer interface, a real seven-band EQ and
      synced listening rooms.</p></div>

    <h3>Personal use only</h3>
    <p>Sonora is intended for <b>private listening</b>. Do not use it to redistribute, rebroadcast, sell,
    or publicly perform anything you access. Respect the rights of artists, labels and rights holders
    in your jurisdiction — those rules differ by country and are your responsibility.</p>

    <h3>Privacy</h3>
    <p>There are no accounts and no user database.</p>
    <ul>
      <li>Likes, playlists, history, settings and stats live only in your browser's local storage</li>
      <li>No advertising or tracking cookies are set</li>
      <li>A short random id is generated locally so the live listener counter works. It expires after roughly a minute of inactivity and is never linked to you</li>
      <li>Room chat is held in memory and disappears when the room empties</li>
      <li>Nothing is sold, shared or transmitted to third parties</li>
    </ul>
    <p>Clear your browser data and every trace is gone.</p>

    <h3>Availability</h3>
    <p>The service is provided <b>as-is</b>, with no warranty. Sources can change or stop responding at
    any time, and playback may break without notice.</p>

    <div class="notice warnbox"><b>Copyright and takedown</b>
      <p>If you are a rights holder and believe something reachable through this interface infringes your
      rights, contact the operator of this deployment with the work identified, the exact reference,
      your contact details, and a good-faith statement of authority. Verified requests are honoured
      promptly and the reference is blocked. Notices are generally best directed at the party that
      actually hosts the file rather than at a client application.</p></div>

    <h3>Operator</h3>
    <p>This is a self-hosted deployment. Whoever runs this instance is its operator and the correct
    point of contact. Add your contact details here before sharing it publicly.</p>`;
  v.appendChild(d);
  const c = el('div', 'chips');
  [['Terms', 'terms'], ['Privacy notice', 'privacy'], ['Takedown policy', 'dmca']].forEach(([n, k]) => {
    const b = el('button', 'chip', n); b.onclick = () => showLegalModal(k); c.appendChild(b); });
  const r = el('button', 'chip', 'Review the welcome screen');
  r.onclick = () => { SET('agreed', 0); location.reload(); };
  c.appendChild(r);
  v.appendChild(c);
}

/* ---- detail pages ---- */
async function detail(title, badge, loader, extra) {
  S.custom = true; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  v.appendChild(H(title, badge)); extra && extra(v);
  const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  try { const songs = await loader(); b.innerHTML = '';
    if (!songs?.length) return b.appendChild(emptyBox(I.music, 'Nothing found', 'Try a different selection'));
    b.appendChild(playBar(songs)); b.appendChild(gap(10));
    if (songs.length > 10) { b.appendChild(sGrid(songs.slice(0, 12), true, 1)); b.appendChild(H('All tracks', songs.length + ' in this collection')); }
    b.appendChild(rowList(songs));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => detail(title, badge, loader, extra))); }
  v.appendChild(liveStrip());
}
const openMood = (n, q) => detail(n, 'A mix built around this mood', async () => (await api('/api/mood?q=' + encodeURIComponent(q))).songs);
async function openEra(y, n, flavour) {
  flavour = flavour || 'originals';
  S.custom = true; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  const info = (ERAS.find(e => e[0] === y) || [])[2] || '';
  v.appendChild(el('div', 'erahead', `<div class="eradial"><b>${esc(n.replace(/s$/, ''))}</b></div>
    <div><h3>${esc(n)}</h3><p>${esc(info)} — choose the original recordings or hear how they sound today.</p></div>`));

  const seg = el('div', 'seg');
  [['originals', 'Originals'], ['remakes', 'Modern remakes'], ['lofi', 'Lo-fi flips'], ['covers', 'Unplugged covers']]
    .forEach(([k, lbl]) => { const b = el('button', flavour === k ? 'on' : '', lbl);
      b.onclick = () => openEra(y, n, k); seg.appendChild(b); });
  const wrapSeg = el('div', 'chips'); wrapSeg.appendChild(seg); v.appendChild(wrapSeg);
  v.appendChild(langRow(() => openEra(y, n, flavour)));

  const box = el('div'); box.appendChild(skel(8)); v.appendChild(box);
  try {
    let songs;
    if (flavour === 'originals') songs = (await api('/api/era?e=' + y + '&lang=' + S.lang, { tries: 1 })).songs;
    else {
      const dec = n.replace(/s$/, '');
      const qmap = { remakes: `${dec} bollywood remake recreated`, lofi: `${dec} hindi lofi flip slowed`, covers: `${dec} hindi unplugged cover acoustic` };
      songs = (await api('/api/mood?q=' + encodeURIComponent(qmap[flavour]) + '&n=40')).songs;
    }
    box.innerHTML = '';
    if (!songs?.length) { box.appendChild(emptyBox(I.music, 'Nothing found', 'Try another filter or language')); }
    else {
      box.appendChild(playBar(songs)); box.appendChild(gap(10));
      box.appendChild(railWrap(sGrid(songs.slice(0, 12), true, 1)));
      box.appendChild(H('All tracks', songs.length + ' in this collection'));
      box.appendChild(rowList(songs));
    }
  } catch (e) { box.innerHTML = ''; box.appendChild(errBox(() => openEra(y, n, flavour))); }
  v.appendChild(liveStrip());
}
const openArtist = a => detail(a.t, 'Top tracks by this artist', async () => (await api('/api/search?q=' + encodeURIComponent(a.t) + '&n=45')).songs);
const openColl = x => detail(x.t, x.k === 'artist' ? 'Artist' : x.k === 'playlist' ? 'Playlist' : 'Album', async () => (await api((/playlist|mix|radio/.test(x.k) ? '/api/playlist?id=' : '/api/album?id=') + x.id)).songs);

/* ================= ROOMS ================= */
const avat = n => (String(n || '?').trim()[0] || '?').toUpperCase();
function rAct(a, v, optimistic) {
  if (!S.room) return Promise.resolve(null);
  if (optimistic && S.snap) { try { optimistic(S.snap); paintRoom(S.snap); } catch (e) { } }
  const u = `/api/room/act?c=${S.room}&a=${a}&u=${encodeURIComponent(S.me)}&uid=${MYID}` +
    (v !== undefined ? '&v=' + encodeURIComponent(v) : '');
  return fetch(u).then(r => r.json())
    .then(d => { if (d && d.code) { S.snap = d; paintRoom(d); } return d; })
    .catch(() => { toast('Could not reach the room'); return null; });
}
const amHost = () => S.snap ? S.snap.host === MYID : S.host;

function newCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = '';
  for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }
const inviteURL = c => location.origin + '/?room=' + (c || S.room);

function joinRoom(code, host) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (code.length < 3) return toast('That code looks wrong');
  S.room = code; S.host = !!host;
  if (S.es) { try { S.es.close(); } catch (e) { } }
  S.es = new EventSource('/api/room/sub?c=' + code);
  S.es.addEventListener('state', e => { try { const d = JSON.parse(e.data);
    S.snap = d; paintRoom(d); if (!amHost()) follow(d); } catch (err) { } });
  S.es.onerror = () => { };
  rAct('join');
  if (host && S.queue.length) rAct('queue', JSON.stringify(S.queue.slice(0, 60)));
  if (!S.snap) S.snap = { code, queue: [], idx: 0, playing: false, chat: [], users: [{ n: S.me, id: MYID, host: !!host }], host: host ? MYID : null };
  document.body.classList.add('in-room'); cdSeen = 0;
  toast(host ? 'Room created — ' + code : 'Joined ' + code);
  history.replaceState(null, '', location.pathname);
  if (S.view !== 'room') nav('room'); else render();
}
function leaveRoom() {
  rAct('leave');
  if (S.es) { try { S.es.close(); } catch (e) { } }
  S.es = null; S.room = null; S.host = false; S.snap = null;
  document.body.classList.remove('in-room'); $('#chatDock').classList.remove('open'); cdOpen = false;
  toast('You left the room'); render();
}
let roomSyncing = false, roomLastId = null;
function follow(d, force) {
  if (!d || !d.queue || !d.queue.length) return;
  const t = d.queue[d.idx];
  if (!t) return;
  const cur = S.queue[S.idx];

  // adopt the room queue so Up next / Queue views match everyone else
  S.queue = d.queue; S.idx = d.idx; counts();

  if (force || !cur || cur.id !== t.id || roomLastId !== t.id) {
    roomLastId = t.id;
    roomSyncing = true;
    play().then(() => {
      const target = d.playing ? d.pos : d.at || 0;
      const settle = () => { try { if (isFinite(target) && Math.abs(au.currentTime - target) > 1) au.currentTime = target; } catch (e) { } roomSyncing = false; };
      if (au.readyState >= 2) setTimeout(settle, 260);
      else au.addEventListener('loadeddata', () => setTimeout(settle, 120), { once: true });
      if (!d.playing) setTimeout(() => au.pause(), 400);
    }).catch(() => { roomSyncing = false; });
    return;
  }
  if (roomSyncing) return;
  const drift = Math.abs(au.currentTime - d.pos);
  if (d.playing && drift > 2.2) au.currentTime = d.pos;
  if (d.playing && au.paused) au.play().catch(() => toast('Tap play to join the audio'));
  if (!d.playing && !au.paused) au.pause();
}

/* Guests should not fight the room with local transport controls. */
function roomGuestGuard() {
  if (!S.room || amHost()) return false;
  toast('The host controls playback — use Sync to catch up');
  return true;
}

/* ---- share sheet ---- */
function shareRoom() {
  const url = inviteURL(), code = S.room;
  modal(`<h3>Invite friends</h3>
    <div class="sb2">Anyone with this link joins instantly and hears exactly what you hear.</div>
    <div class="codebox" style="margin-top:14px"><div><div class="lbl2">Room code</div><div class="cd2">${esc(code)}</div></div></div>
    <input class="inp" id="shUrl" value="${esc(url)}" readonly onclick="this.select()">
    <div class="twobtn">
      <button class="wb pri" id="shLink" style="margin:0">Copy link</button>
      <button class="wb" id="shCode" style="margin:0">Copy code</button>
    </div>
    ${navigator.share ? '<button class="wb" id="shNative">Share via apps</button>' : ''}
    <button class="wb" id="shWa">Share on WhatsApp</button>`, m => {
    const cp = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); } catch { const i = $('#shUrl'); i.select(); document.execCommand('copy'); } toast(msg); };
    $('#shLink').onclick = () => cp(url, 'Invite link copied');
    $('#shCode').onclick = () => cp(code, 'Code copied — ' + code);
    const nat = $('#shNative');
    if (nat) nat.onclick = () => navigator.share({ title: 'Join my Sonora room', text: 'Listen with me — code ' + code, url }).catch(() => { });
    $('#shWa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent('Listen with me on Sonora — ' + url), '_blank');
  });
}

/* ---- join confirmation (from an invite link) ---- */
async function askJoin(code) {
  code = String(code || '').toUpperCase();
  let info = null;
  try { info = await api('/api/room/peek?c=' + code, { cache: false, tries: 1 }); } catch (e) { }
  const live = info?.exists;
  modal(`<div class="joinsheet">
    <div class="ring"><svg viewBox="0 0 24 24"><path d="M17 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H8.6A3.6 3.6 0 0 0 5 18.2V20"/><circle cx="11" cy="8" r="3.4"/><path d="M19.5 20v-1.6a3.4 3.4 0 0 0-2.4-3.2M16.2 5.1a3.4 3.4 0 0 1 0 6"/></svg></div>
    <h3>Join this room?</h3>
    <div class="big2">${esc(code)}</div>
    <div class="sb2">${live
      ? esc((info.n || 1) + ' listening · ' + (info.tracks || 0) + ' tracks queued') + (info.now ? '<br>Now playing <b>' + esc(info.now.t) + '</b>' : '')
      : 'This room is empty right now — joining will start it.'}</div>
    <div class="sb2" style="font-size:11.5px;opacity:.7">Your playback will sync with the room. You can leave any time.</div>
    <div class="twobtn">
      <button class="wb" id="jNo" style="margin:0">Cancel</button>
      <button class="wb pri" id="jYes" style="margin:0">Join room</button>
    </div></div>`, m => {
    $('#jNo').onclick = () => { closeM(); history.replaceState(null, '', location.pathname); toast('Invite dismissed'); };
    $('#jYes').onclick = () => { closeM(); joinRoom(code, !live); };
  });
}

/* ---- add-to-room helper used by the context menu ---- */
function roomPlayNow(song) {
  if (!S.room) return toast('Join a room first');
  rAct('playnow', JSON.stringify(song), sn => {
    const i = sn.queue.findIndex(x => x.id === song.id);
    if (i >= 0) sn.idx = i; else { sn.queue.splice(sn.idx + 1, 0, song); sn.idx = sn.idx + 1; }
    sn.playing = true;
  });
  toast('Playing in the room');
}
function roomPlayList(list) {
  if (!S.room) return toast('Join a room first');
  if (!list.length) return toast('Nothing to play');
  modal(`<h3>Play ${list.length} tracks in the room?</h3>
    <div class="sb2">This replaces the room queue. Everyone starts from the first track together.</div>
    <div class="twobtn"><button class="wb" id="rpNo" style="margin:0">Cancel</button>
    <button class="wb pri" id="rpYes" style="margin:0">Play for everyone</button></div>`, () => {
    $('#rpNo').onclick = closeM;
    $('#rpYes').onclick = () => { closeM();
      rAct('queue', JSON.stringify(list.slice(0, 60)), sn => { sn.queue = list.slice(0, 60); sn.idx = 0; sn.playing = true; });
      toast('Playing for the room'); };
  });
}
function roomAdd(song) {
  if (!S.room) return toast('Join a room first');
  rAct('add', JSON.stringify(song));
  toast('Added to the room queue');
}

/* ---- the Rooms page ---- */
function vRoom(v) {
  if (!S.room) {
    v.appendChild(el('div', 'hero', `<h1>Listen <em>together</em></h1>
      <p>Create a room, send one link, and everyone hears the same second of the same song. Shared queue, live chat, instant sync.</p>`));
    v.appendChild(H('Start a session', 'Five characters is all it takes'));
    const w = el('div'); w.style.maxWidth = '440px';
    w.innerHTML = `<button class="wb pri" id="rC">Create a room</button>
      <div class="sb2" style="text-align:center;margin:14px 0 10px;opacity:.6">or join an existing one</div>
      <input class="inp" id="rCode" placeholder="ABCDE" maxlength="5"
        style="text-transform:uppercase;letter-spacing:6px;font-weight:800;text-align:center;font-size:19px">
      <button class="wb" id="rJ">Join room</button>`;
    v.appendChild(w);
    $('#rC').onclick = () => joinRoom(newCode(), true);
    const go = () => { const c = $('#rCode').value.trim().toUpperCase();
      if (c.length < 3) return toast('Enter the 5-character code'); askJoin(c); };
    $('#rJ').onclick = go;
    $('#rCode').onkeydown = e => { if (e.key === 'Enter') go(); };
    $('#rCode').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    v.appendChild(H('How it works', 'Three steps'));
    const g = el('div', 'tiles stg');
    [['Create', 'Get a five-character code'], ['Share', 'Send the link on any app'], ['Sync', 'Everyone plays as one']]
      .forEach(([t, d], i) => g.appendChild(tile(t, d, i * 60 + 70, () => { })));
    v.appendChild(g);
    return;
  }

  const d = S.snap || { users: [], queue: [], chat: [], idx: 0 };
  v.appendChild(H('Room ' + S.room, amHost() ? 'You are hosting' : 'Listening along'));

  const codebox = el('div', 'codebox', `
    <div><div class="lbl2">Room code</div><div class="cd2">${esc(S.room)}</div></div>
    <div class="acts">
      <button class="sbtn pri" id="rShare">Share invite</button>
      <button class="sbtn" id="rCopy">Copy code</button>
      <button class="sbtn" id="rLeave">Leave</button>
    </div>`);
  v.appendChild(codebox);
  $('#rShare').onclick = shareRoom;
  $('#rCopy').onclick = () => { navigator.clipboard?.writeText(S.room); toast('Code copied — ' + S.room); };
  $('#rLeave').onclick = () => modal(`<h3>Leave this room?</h3>
    <div class="sb2">Playback stops syncing. You can rejoin with the same code any time.</div>
    <div class="twobtn"><button class="wb" id="lNo" style="margin:0">Stay</button>
    <button class="wb pri" id="lYes" style="margin:0">Leave room</button></div>`,
    () => { $('#lNo').onclick = closeM; $('#lYes').onclick = () => { closeM(); leaveRoom(); }; });

  const grid = el('div', 'rmwrap'); v.appendChild(grid);

  /* left column — now playing + queue */
  const left = el('div');
  const nowCard = el('div', 'card2'); nowCard.id = 'rNowCard'; left.appendChild(nowCard);
  const qCard = el('div', 'card2'); qCard.style.marginTop = '14px';
  qCard.innerHTML = `<h4>Shared queue <span class="n2" id="rqN">0</span></h4>
    <div class="qsum" id="rqSum"></div>`;
  const findBar = el('div', 'findbar');
  findBar.innerHTML = `<input id="rFind" placeholder="Search a song to play in the room" autocomplete="off">
    <button id="rFindGo">Search</button>`;
  qCard.appendChild(findBar);
  const rres = el('div', 'rres'); rres.id = 'rRes'; qCard.appendChild(rres);
  const doFind = async () => {
    const v = $('#rFind').value.trim(); if (!v) return;
    rres.innerHTML = '<div class="sb2" style="padding:8px 4px;margin:0">Searching…</div>';
    try {
      const d = await api('/api/search?q=' + encodeURIComponent(v) + '&n=12');
      const songs = d.songs || [];
      if (!songs.length) return rres.innerHTML = '<div class="sb2" style="padding:8px 4px;margin:0">No results.</div>';
      rres.innerHTML = songs.map((t, i) => `<div class="rrq" data-i="${i}">
        <img loading="lazy" src="${esc(t.img)}" alt="">
        <div style="min-width:0"><div class="q1 cl">${esc(t.t)}</div><div class="q2 cl">${esc(t.a)}</div></div>
        <button class="rrb" data-a="now" title="Play now">Play</button>
        <button class="rrb" data-a="add" title="Add to queue">+</button></div>`).join('');
      rres.querySelectorAll('.rrq').forEach(row => {
        row.querySelectorAll('[data-a]').forEach(b => b.onclick = e => { e.stopPropagation();
          const sg = songs[+row.dataset.i];
          b.dataset.a === 'now' ? roomPlayNow(sg) : roomAdd(sg);
          row.style.opacity = .45; }); });
    } catch (e) { rres.innerHTML = '<div class="sb2" style="padding:8px 4px;margin:0">Search failed.</div>'; }
  };
  $('#rFindGo').onclick = doFind;
  $('#rFind').onkeydown = e => { if (e.key === 'Enter') doFind(); };

  const qActs = el('div', 'chips'); qActs.style.marginBottom = '12px';
  const mkq = (t, fn, pri) => { const b = el('button', 'sbtn' + (pri ? ' pri' : ''), t); b.onclick = fn; return b; };
  qActs.append(
    mkq('Share my queue', () => { if (!S.queue.length) return toast('Your queue is empty');
      modal(`<h3>Share ${S.queue.length} tracks?</h3>
        <div class="sb2">This replaces the room queue and starts playing for everyone.</div>
        <div class="twobtn"><button class="wb" id="qNo" style="margin:0">Cancel</button>
        <button class="wb pri" id="qYes" style="margin:0">Share queue</button></div>`,
        () => { $('#qNo').onclick = closeM;
          $('#qYes').onclick = () => { closeM(); rAct('queue', JSON.stringify(S.queue.slice(0, 60))); toast('Queue shared'); }; }); }, 1),
    mkq('Play what I am playing', () => { const c = S.queue[S.idx];
      if (!c) return toast('Play something first'); roomPlayNow(c); }),
    mkq('Add my liked', () => { if (!S.liked.length) return toast('Nothing liked yet');
      rAct('addmany', JSON.stringify(S.liked.slice(0, 40))); toast('Added your liked songs'); }),
    mkq('Re-sync', () => { if (S.snap) { follow(S.snap, true); toast('Re-synced with the room'); } }),
    mkq('Clear queue', () => modal(`<h3>Clear the room queue?</h3>
      <div class="sb2">Everyone stops playing and the list empties.</div>
      <div class="twobtn"><button class="wb" id="cNo" style="margin:0">Cancel</button>
      <button class="wb pri" id="cYes" style="margin:0">Clear it</button></div>`,
      () => { $('#cNo').onclick = closeM; $('#cYes').onclick = () => { closeM(); rAct('clear', undefined, sn => { sn.queue = []; sn.idx = 0; sn.playing = false; }); }; })));
  qCard.appendChild(qActs);
  const qList = el('div', 'rq'); qList.id = 'rQList'; qCard.appendChild(qList);
  left.appendChild(qCard);
  grid.appendChild(left);

  /* right column — members + chat */
  const right = el('div');
  const mCard = el('div', 'card2');
  mCard.innerHTML = `<h4>In the room <span class="n2" id="rmN">1</span></h4><div class="mems" id="rMems"></div>`;
  right.appendChild(mCard);
  const cCard = el('div', 'card2'); cCard.style.marginTop = '14px';
  cCard.innerHTML = `<h4>Live chat</h4><div class="chat2" id="rChat2"></div>
    <div class="chatin"><input id="rMsg" placeholder="Say something" maxlength="200"><button id="rSend">Send</button></div>`;
  right.appendChild(cCard);
  grid.appendChild(right);

  const send = () => { const m = $('#rMsg').value.trim(); if (!m) return;
    $('#rMsg').value = '';
    rAct('chat', m, sn => { sn.chat = [...(sn.chat || []), { u: S.me, m, t: Date.now() }].slice(-70); }); };
  $('#rSend').onclick = send;
  $('#rMsg').onkeydown = e => { if (e.key === 'Enter') send(); };

  paintRoom(S.snap);
}

function paintRoom(d) {
  paintDock(d);
  if (!d || S.view !== 'room' || !S.room) return;
  const host = amHost();

  /* now playing + up next */
  const nc = $('#rNowCard');
  if (nc) {
    const q = d.queue || [], cur = q[d.idx], nxt = q[d.idx + 1], after = q[d.idx + 2];
    const done = q.slice(0, d.idx).length, left = Math.max(0, q.length - d.idx - 1);
    nc.innerHTML = `<h4>Now playing ${cur ? `<span class="n2">${d.playing ? 'live' : 'paused'}</span>` : ''}</h4>` + (cur
      ? `<div class="nowbox big3"><img src="${esc(cur.img)}" alt="">
          <div style="min-width:0">
            <div class="t3 cl">${esc(cur.t)}</div>
            <div class="a3 cl">${esc(cur.a)}${cur.al ? ' · ' + esc(cur.al) : ''}</div>
            <div class="rprog"><div class="rpf" id="rpFill"></div></div>
            <div class="rmeta"><span id="rpTime">0:00</span><span>track ${d.idx + 1} of ${q.length}</span></div>
          </div>
          <span class="sync">${d.playing ? 'In sync' : 'Paused'}</span></div>`
      : `<div class="sb2" style="margin:0 0 12px">Nothing playing yet — search below or send a queue.</div>`);
    if (cur) {
      const up = el('div', 'upnext');
      up.innerHTML = `<div class="uphd">Up next</div>` + (nxt
        ? [nxt, after].filter(Boolean).map((t, i) => `<div class="upi">
            <span class="upn">${i + 1}</span><img src="${esc(t.img)}" alt="">
            <div style="min-width:0"><div class="q1 cl">${esc(t.t)}</div><div class="q2 cl">${esc(t.a)}</div></div></div>`).join('')
        : `<div class="sb2" style="margin:0;font-size:11.5px">Nothing after this one. Add a track below.</div>`)
        + `<div class="upsum">${done} played · ${left} still to come</div>`;
      nc.appendChild(up);

      const ctr = el('div', 'chips');
      const b = (t, fn, dis) => { const x = el('button', 'sbtn', t); x.onclick = fn; if (dis) x.style.opacity = .45; return x; };
      ctr.append(
        b('Previous', () => host ? rAct('prev', undefined, sn => { sn.idx = Math.max(0, sn.idx - 1); }) : toast('Only the host can control playback'), !host),
        b(d.playing ? 'Pause' : 'Play', () => host ? rAct(d.playing ? 'pause' : 'play', undefined, sn => { sn.playing = !sn.playing; }) : toast('Only the host can control playback'), !host),
        b('Next', () => host ? rAct('next', undefined, sn => { sn.idx = Math.min((sn.queue?.length || 1) - 1, sn.idx + 1); }) : toast('Only the host can control playback'), !host),
        b('Sync to room', () => { follow(d, true); toast('Syncing with the room'); }));
      nc.appendChild(ctr);
    }
  }

  /* members */
  const mm = $('#rMems');
  if (mm) {
    const us = d.users || [];
    $('#rmN') && ($('#rmN').textContent = us.length || 1);
    mm.innerHTML = us.map((u, i) => `<span class="mem${u.id === MYID ? ' you' : ''}" style="animation-delay:${i * .04}s">
      <span class="av">${esc(avat(u.n))}</span>${esc(u.n)}${u.id === MYID ? ' (you)' : ''}
      ${u.host ? '<svg class="crown" viewBox="0 0 24 24"><path d="M4 18h16M4 18 3 7l5 4 4-6 4 6 5-4-1 11"/></svg>' : ''}</span>`).join('')
      || '<span class="sb2" style="margin:0">Just you for now</span>';
  }

  /* queue */
  const ql = $('#rQList');
  if (ql) {
    const q = d.queue || [];
    $('#rqN') && ($('#rqN').textContent = q.length + (q.length === 1 ? ' track' : ' tracks'));
    const sum = $('#rqSum');
    if (sum) sum.textContent = q.length
      ? `Playing ${d.idx + 1} of ${q.length}. Tap any track to jump — everyone follows.`
      : '';
    if (!q.length) ql.innerHTML = `<div class="howto">
      <div class="hstep"><span class="hn">1</span><div><b>Find music</b><span>Search, or open Trending, Moods or Golden Era.</span></div></div>
      <div class="hstep"><span class="hn">2</span><div><b>Send it to the room</b><span>Hit <em>Play in room</em> on any list, or long-press a single track and choose <em>Play in room now</em>.</span></div></div>
      <div class="hstep"><span class="hn">3</span><div><b>Everyone hears it</b><span>Playback starts for all members at the same second.</span></div></div>
      <button class="wb pri" id="htGo" style="margin-top:14px">Browse music</button></div>`;
    else ql.innerHTML = q.map((t, i) => `<div class="rqi${i === d.idx ? ' on' : ''}${i < d.idx ? ' past' : ''}" data-i="${i}" style="animation-delay:${Math.min(i, 12) * .025}s">
      <span class="qn">${i === d.idx ? '<span class="eqi"><i></i><i></i><i></i></span>' : i + 1}</span>
      <img loading="lazy" src="${esc(t.img)}" alt="">
      <div style="min-width:0"><div class="q1 cl">${esc(t.t)}</div>
        <div class="q2 cl">${i === d.idx ? 'Playing now' : i === d.idx + 1 ? 'Up next · ' + esc(t.a) : i < d.idx ? 'Played · ' + esc(t.a) : esc(t.a)}</div></div>
      <button class="qx" data-rm="${i}" title="Remove"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`).join('');
    const hg = $('#htGo'); if (hg) hg.onclick = () => nav('trend');
    ql.querySelectorAll('.rqi').forEach(r => {
      r.onclick = e => { const x = e.target.closest('[data-rm]');
        if (x) { e.stopPropagation(); const i = +x.dataset.rm;
          r.classList.add('pending');
          rAct('rm', i, sn => { sn.queue.splice(i, 1); if (i < sn.idx) sn.idx--; });
          return; }
        const j = +r.dataset.i;
        rAct('jump', j, sn => { sn.idx = j; sn.playing = true; });
        if (S.snap?.queue?.[j]) { S.queue = S.snap.queue; S.idx = j; play(); } };
    });
  }

  /* chat */
  const ch = $('#rChat2');
  if (ch) {
    const near = ch.scrollHeight - ch.scrollTop - ch.clientHeight < 60;
    ch.innerHTML = (d.chat || []).map(m => m.sys
      ? `<div class="cm sys"><div class="bd2"><div class="txt2">${esc(m.m)}</div></div></div>`
      : `<div class="cm"><span class="av">${esc(avat(m.u))}</span>
          <div class="bd2"><div class="who">${esc(m.u)}</div><div class="txt2">${esc(m.m)}</div></div></div>`).join('')
      || '<div class="sb2" style="margin:0">No messages yet — say hello.</div>';
    if (near) ch.scrollTop = ch.scrollHeight;
  }
}

/* ---- floating chat dock (works on every page) ---- */
let cdSeen = 0, cdOpen = false;
function paintDock(d) {
  const body = $('#cdBody'), fab = $('#chatFab');
  document.body.classList.toggle('in-room', !!S.room);
  if (!S.room) { $('#chatDock').classList.remove('open'); cdOpen = false; return; }
  const chat = (d && d.chat) || (S.snap && S.snap.chat) || [];
  const users = (d && d.users) || (S.snap && S.snap.users) || [];
  const ttl = $('#cdTitle'); if (ttl) ttl.textContent = 'Room ' + S.room;
  const cnt = $('#cdCount'); if (cnt) cnt.textContent = (users.length || 1) + ' online';
  if (!cdOpen) {
    const unread = Math.max(0, chat.filter(m => !m.sys).length - cdSeen);
    fab.classList.toggle('unread', unread > 0);
    $('#chatBadge').textContent = unread > 9 ? '9+' : unread;
  }
  if (!body) return;
  const near = body.scrollHeight - body.scrollTop - body.clientHeight < 70;
  body.innerHTML = chat.length ? chat.map(m => m.sys
    ? `<div class="cm sys"><div class="bd2"><div class="txt2">${esc(m.m)}</div></div></div>`
    : `<div class="cm"><span class="av">${esc(avat(m.u))}</span>
        <div class="bd2"><div class="who">${esc(m.u)}${m.u === S.me ? ' (you)' : ''}</div>
        <div class="txt2">${esc(m.m)}</div></div></div>`).join('')
    : '<div class="sb2" style="margin:0">No messages yet — say hello.</div>';
  if (near || cdOpen) body.scrollTop = body.scrollHeight;
}
function toggleDock(force) {
  if (!S.room) return toast('Join a room to chat');
  const d = $('#chatDock');
  cdOpen = force !== undefined ? force : !d.classList.contains('open');
  d.classList.toggle('open', cdOpen);
  if (cdOpen) { cdSeen = ((S.snap && S.snap.chat) || []).filter(m => !m.sys).length;
    $('#chatFab').classList.remove('unread');
    paintDock(S.snap); setTimeout(() => $('#cdInput').focus(), 120); }
}

/* ================= FULLSCREEN ================= */
const FSTABS = [['art', 'Now Playing', I.disc], ['lyrics', 'Lyrics', I.mic], ['queue', 'Queue', I.queue],
['eq', 'EQ', '<svg viewBox="0 0 24 24"><path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1.5 14h5M9.5 8h5M17.5 16h5"/></svg>'],
['modes', 'Modes', I.radio], ['room', 'Room', '<svg viewBox="0 0 24 24"><path d="M17 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H8.6A3.6 3.6 0 0 0 5 18.2V20"/><circle cx="11" cy="8" r="3.4"/></svg>']];
function openFS() { $('#fs').classList.add('open'); fsRender(); }
function fsRender() {
  const t = $('#fsTabs'); t.innerHTML = '';
  FSTABS.forEach(([k, n, ic]) => { const b = el('button', 'tb' + (S.fsTab === k ? ' on' : ''), ic + n);
    b.onclick = () => { S.fsTab = k; fsRender(); }; t.appendChild(b); });
  const s = S.queue[S.idx], body = $('#fsBody'); body.innerHTML = '';
  $('#fsTop').textContent = s ? s.t : '—';
  if (S.fsTab === 'art') {
    const a = el('div', 'fsart' + (S.spin ? ' disc' : '') + (!au.paused ? ' go' : ''), `<img src="${s ? s.img : ''}" alt="">`);
    body.appendChild(a);
    const c = el('canvas'); c.id = 'viz'; c.width = 700; c.height = 96; body.appendChild(c);
    body.appendChild(el('div', 'fsmeta', `<h2>${esc(s ? s.t : 'Nothing playing')}</h2><p>${esc(s ? s.a + (s.al ? ' · ' + s.al : '') + (s.y ? ' · ' + s.y : '') : '')}</p>`));
    startViz();
  }
  if (S.fsTab === 'lyrics') {
    const p = el('div', 'pane sc');
    p.innerHTML = `<div id="lyrHead"></div><div class="lyrwrap" id="lyrBox"><div class="lyr">Loading lyrics…</div></div>`;
    body.appendChild(p);
    LY.lines = null; LY.el = null; LY.idx = -1;
    if (!s) { $('#lyrBox').innerHTML = '<div class="lyr">Nothing playing.</div>'; }
    else api('/api/lyrics?id=' + s.id).then(d => {
      const box = $('#lyrBox'); if (!box) return;
      if (d.timed && d.timed.length) {
        LY.lines = d.timed;
        box.innerHTML = d.timed.map((l, i) => `<span class="lyrline" data-l="${i}">${esc(l.x || '\u2022')}</span>`).join('');
        LY.el = [...box.querySelectorAll('.lyrline')];
        const h = $('#lyrHead'); if (h) h.innerHTML = '<span class="lyrbadge">Synced</span>';
        tickLyrics(true);
      } else if (d.lyrics) {
        box.innerHTML = `<div class="lyr">${esc(d.lyrics)}</div>`;
      } else box.innerHTML = '<div class="lyr">No lyrics found for this track.</div>';
    }).catch(() => { const b = $('#lyrBox'); if (b) b.innerHTML = '<div class="lyr">Lyrics unavailable.</div>'; });
  }
  if (S.fsTab === 'queue') { const p = el('div', 'pane sc'); p.appendChild(S.queue.length ? rowList(S.queue) : emptyBox(I.queue, 'Queue is empty', 'Add tracks to build it up')); body.appendChild(p); }
  if (S.fsTab === 'eq') {
    const p = el('div', 'pane sc');
    p.innerHTML = `<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:14px" id="fsEqP"></div>
      <div class="eqbank"><div class="eqax">${['+12', '+6', '0', '−6', '−12'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="eqbars">${EQF.map((f, i) => { const pct = ((S.eq[i] || 0) + 12) / 24 * 100;
        return `<div class="eqb"><div class="eqv">${(S.eq[i] > 0 ? '+' : '') + (S.eq[i] || 0)}</div>
        <div class="eqs" data-fi="${i}"><div class="rail2"></div><div class="fill" style="height:${pct}%"></div>
        <div class="knb" style="bottom:${pct}%"></div></div><div class="eqf">${f >= 1000 ? f / 1000 + 'K' : f}</div></div>`; }).join('')}</div></div>`;
    body.appendChild(p);
    const pc = p.querySelector('#fsEqP');
    Object.keys(EQP).forEach(k => { const b = el('button', 'chip' + (S.eqPre === k ? ' on' : ''), k[0].toUpperCase() + k.slice(1));
      b.onclick = () => { setEQPreset(k); fsRender(); }; pc.appendChild(b); });
    p.querySelectorAll('.eqs').forEach(sl => {
      const i = +sl.dataset.fi; let dg = false;
      const set = e => { const r = sl.getBoundingClientRect(); const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        const pct = 1 - clamp(y / r.height, 0, 1); S.eq[i] = Math.round((pct * 24 - 12) * 2) / 2;
        S.eqPre = 'custom'; SET('eq', S.eq); wake(); applyFX(); drawEQ(); paintPresets();
        sl.querySelector('.fill').style.height = pct * 100 + '%'; sl.querySelector('.knb').style.bottom = pct * 100 + '%';
        sl.closest('.eqb').querySelector('.eqv').textContent = (S.eq[i] > 0 ? '+' : '') + S.eq[i]; };
      sl.addEventListener('mousedown', e => { dg = true; set(e); e.preventDefault(); });
      sl.addEventListener('touchstart', e => { dg = true; set(e); e.preventDefault(); }, { passive: false });
      addEventListener('mousemove', e => dg && set(e)); addEventListener('touchmove', e => { if (dg) set(e); }, { passive: false });
      addEventListener('mouseup', () => dg = false); addEventListener('touchend', () => dg = false);
    });
  }
  if (S.fsTab === 'modes') {
    const p = el('div', 'pane sc'); const g = el('div', 'tiles');
    Object.keys(MODES).forEach((k, i) => { const tl = tile(MODES[k].n, MODES[k].d, i * 23 + 60, () => { setMode(k); fsRender(); });
      if (S.mode === k) { tl.style.background = 'var(--grad)'; tl.style.color = 'var(--acd)'; tl.style.boxShadow = 'var(--glow)'; }
      g.appendChild(tl); });
    p.appendChild(g); body.appendChild(p);
  }
  if (S.fsTab === 'room') {
    const p = el('div', 'pane sc');
    if (!S.room) { p.innerHTML = `<div class="sb2" style="text-align:center;margin-bottom:14px">Start a room and listen in sync with friends.</div>
      <button class="wb pri" id="fsRC">Create a room</button>`;
      body.appendChild(p); $('#fsRC').onclick = () => { joinRoom(Math.random().toString(36).slice(2, 7).toUpperCase(), true); fsRender(); }; }
    else { p.innerHTML = `<div class="sb2" style="text-align:center;margin:0">Room code</div><div class="code">${esc(S.room)}</div>
        <div class="chat sc" id="fsChat" style="margin-top:12px"></div>
        <div style="display:flex;gap:8px;margin-top:10px"><input class="inp" id="fsMsg" placeholder="Message" style="margin:0">
        <button class="wb pri" id="fsSend" style="width:auto;margin:0;padding:12px 18px">Send</button></div>`;
      body.appendChild(p);
      const c = $('#fsChat'); c.innerHTML = (S.snap?.chat || []).map(m => `<div class="msg"><b>${esc(m.u)}</b> ${esc(m.m)}</div>`).join('') || '<div class="sb2">No messages yet.</div>';
      c.scrollTop = c.scrollHeight;
      const sd = () => { const m = $('#fsMsg').value.trim(); if (m) { rAct('chat', m); $('#fsMsg').value = ''; } };
      $('#fsSend').onclick = sd; $('#fsMsg').onkeydown = e => { if (e.key === 'Enter') sd(); };
    }
  }
  if (s) $('#fsLike').textContent = isLiked(s.id) ? 'Liked' : 'Like';
}
let vR;
function startViz() {
  const cv = $('#viz'); if (!cv || !anN) return;
  const g = cv.getContext('2d'), n = anN.frequencyBinCount, arr = new Uint8Array(n);
  cancelAnimationFrame(vR);
  const cs = getComputedStyle(document.body);
  const c1 = cs.getPropertyValue('--ac').trim() || '#d4ff3f', c2 = cs.getPropertyValue('--ac2').trim() || '#7ef29d';
  const loop = () => {
    if (!$('#fs').classList.contains('open') || S.fsTab !== 'art') return;
    anN.getByteFrequencyData(arr); g.clearRect(0, 0, cv.width, cv.height);
    const bars = 64, st = Math.floor(n / bars / 1.6), w = cv.width / bars;
    for (let i = 0; i < bars; i++) {
      const v = arr[i * st] / 255, h = Math.max(3, Math.pow(v, .82) * cv.height);
      const gr = g.createLinearGradient(0, cv.height, 0, cv.height - h);
      gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.globalAlpha = .35 + v * .65;
      const bw = w - 3, x = i * w + 1.5, r2 = Math.min(bw / 2, 2.5);
      g.beginPath(); g.roundRect ? g.roundRect(x, cv.height - h, bw, h, r2) : g.rect(x, cv.height - h, bw, h); g.fill();
    }
    g.globalAlpha = 1;
    vR = requestAnimationFrame(loop);
  }; loop();
}

/* ================= LIVE LISTENERS ================= */
const MYID = (() => { let v = LS('uid', null); if (!v) { v = Math.random().toString(36).slice(2, 12); SET('uid', v); } return v; })();
let liveData = { n: 1, top: [] }, liveTimer = 0;
async function beat() {
  try {
    const s = S.queue[S.idx];
    const d = await fetch(`/api/live?id=${MYID}${s ? '&s=' + encodeURIComponent(s.t + ' \u2014 ' + s.a) : ''}${s && !au.paused ? '&p=1' : ''}`)
      .then(r => r.json());
    if (d && typeof d.n === 'number') { liveData = d; paintLive(); }
  } catch (e) { }
}
function paintLive() {
  $$('.livestrip').forEach(w => {
    const n = w.querySelector('.num');
    if (n && n.textContent !== String(liveData.n)) { n.textContent = liveData.n;
      n.classList.remove('roll'); void n.offsetWidth; n.classList.add('roll'); }
    const tt = w.querySelector('.tot'); if (tt) tt.textContent = liveData.total ?? 0;
    const pk = w.querySelector('.pk'); if (pk) pk.textContent = liveData.peak ?? 0;
    const nw = w.querySelector('.now');
    if (nw) nw.innerHTML = liveData.top?.length
      ? liveData.top.slice(0, 3).map(x => `<span><i>${x.n}</i><b>${esc(x.t)}</b></span>`).join('')
      : '<span style="opacity:.6">Nobody is playing anything right now</span>';
  });
}
function liveStrip() {
  const w = el('div', 'livestrip', `
    <div class="lv"><span class="pulse"></span>
      <span class="num">${liveData.n}</span>
      <span class="cap2"><b>Listening right now</b>tuned in across Sonora</span></div>
    <div class="lstats">
      <div class="lst"><b class="tot">${liveData.total || 0}</b><span>total listeners</span></div>
      <div class="lst"><b class="pk">${liveData.peak || 0}</b><span>peak today</span></div>
    </div>
    <div class="now"></div>
    <div class="bars2">${Array.from({ length: 9 }, (_, i) =>
      `<i style="height:${8 + (i * 5 % 19)}px;animation-delay:${(i * .11).toFixed(2)}s"></i>`).join('')}</div>`);
  setTimeout(paintLive, 0); return w;
}

/* ---- synced lyrics ticker ---- */
const LY = { lines: null, el: null, idx: -1 };
function tickLyrics(force) {
  if (!LY.lines || !LY.el || !$('#fs').classList.contains('open') || S.fsTab !== 'lyrics') return;
  const t = au.currentTime;
  let i = -1;
  for (let k = 0; k < LY.lines.length; k++) { if (LY.lines[k].t <= t + .15) i = k; else break; }
  if (i === LY.idx && !force) return;
  LY.idx = i;
  LY.el.forEach((n, k) => { n.classList.toggle('cur', k === i);
    n.classList.toggle('past', k < i); n.classList.toggle('next2', k === i + 1); });
  const cur = LY.el[i];
  if (cur) { const box = $('#lyrBox');
    if (box) box.scrollTo({ top: cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2, behavior: 'smooth' }); }
}

/* ================= COMMAND PALETTE ================= */
let cmdOpen = false, cmdSel = 0, cmdItems = [], cmdT = 0;
const CMD_ICONS = {
  nav: '<svg viewBox="0 0 24 24"><path d="M4 12h16M13 5l7 7-7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z" style="fill:var(--ac);stroke:none"/></svg>',
  fx: '<svg viewBox="0 0 24 24"><path d="M4 20V13M4 9V4M12 20v-8M12 8V4M20 20v-4M20 12V4"/><path d="M1.6 13h4.8M9.6 8h4.8M17.6 16h4.8"/></svg>',
  set: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M19.2 14.8a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7 2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1 2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7 2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.4 1z"/></svg>',
  room: '<svg viewBox="0 0 24 24"><path d="M17 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H8.6A3.6 3.6 0 0 0 5 18.2V20"/><circle cx="11" cy="8" r="3.4"/></svg>',
};
function baseCommands() {
  const c = [];
  const nav2 = [['home', 'Home'], ['trend', 'Trending'], ['era', 'Golden Era'], ['mood', 'Moods'],
    ['studio', 'Sound Studio'], ['room', 'Rooms'], ['liked', 'Liked Songs'], ['pls', 'Playlists'],
    ['queue', 'Play Queue'], ['recent', 'History'], ['dls', 'Downloads'], ['stats', 'Insights'],
    ['prefs', 'Settings'], ['legal', 'About & Legal']];
  nav2.forEach(([v, t]) => c.push({ g: 'Go to', t, k: CMD_ICONS.nav, key: 'nav ' + t, run: () => nav(v) }));
  c.push({ g: 'Playback', t: au.paused ? 'Play' : 'Pause', k: CMD_ICONS.play, ck: 'Space', run: toggle });
  c.push({ g: 'Playback', t: 'Next track', k: CMD_ICONS.play, ck: 'N', run: () => skip(false) });
  c.push({ g: 'Playback', t: 'Previous track', k: CMD_ICONS.play, ck: 'P', run: prevTrack });
  c.push({ g: 'Playback', t: 'Shuffle ' + (S.shuffle ? 'off' : 'on'), k: CMD_ICONS.play, ck: 'S', run: shufFn });
  c.push({ g: 'Playback', t: 'Cycle repeat', k: CMD_ICONS.play, ck: 'R', run: repFn });
  const cur = S.queue[S.idx];
  if (cur) {
    c.push({ g: 'Current track', t: (isLiked(cur.id) ? 'Unlike ' : 'Like ') + cur.t, k: CMD_ICONS.play, ck: 'L', run: () => like(cur) });
    c.push({ g: 'Current track', t: 'Download ' + cur.t, k: CMD_ICONS.play, ck: 'D', run: () => dlSheet(cur) });
    c.push({ g: 'Current track', t: 'Start radio from ' + cur.t, k: CMD_ICONS.play, run: () => startRadio(cur) });
    c.push({ g: 'Current track', t: 'Show lyrics', k: CMD_ICONS.play, ck: 'Y', run: () => { S.fsTab = 'lyrics'; openFS(); } });
    if (S.room) c.push({ g: 'Current track', t: 'Play this in the room', k: CMD_ICONS.room, run: () => roomPlayNow(cur) });
  }
  Object.keys(MODES).forEach(k => c.push({ g: 'Sound mode', t: MODES[k].n, k: CMD_ICONS.fx,
    ck: S.mode === k ? 'active' : '', run: () => setMode(k) }));
  Object.keys(EQP).forEach(k => c.push({ g: 'Equaliser', t: k[0].toUpperCase() + k.slice(1) + ' preset', k: CMD_ICONS.fx, run: () => setEQPreset(k) }));
  QUAL.forEach(q => c.push({ g: 'Quality', t: q.n + ' · ' + q.s, k: CMD_ICONS.set,
    ck: S.q === q.v ? 'active' : '', run: () => setQ(q.v) }));
  THEMES.forEach(([k, n]) => c.push({ g: 'Theme', t: n, k: CMD_ICONS.set, ck: S.theme === k ? 'active' : '', run: () => setTheme(k) }));
  c.push({ g: 'Rooms', t: S.room ? 'Leave room ' + S.room : 'Create a room', k: CMD_ICONS.room,
    run: () => S.room ? leaveRoom() : joinRoom(newCode(), true) });
  if (S.room) { c.push({ g: 'Rooms', t: 'Share room invite', k: CMD_ICONS.room, run: shareRoom });
    c.push({ g: 'Rooms', t: 'Open room chat', k: CMD_ICONS.room, ck: 'C', run: () => toggleDock(true) }); }
  c.push({ g: 'Settings', t: 'Appearance panel', k: CMD_ICONS.set, run: () => openPan('#thPan') });
  c.push({ g: 'Settings', t: 'Equaliser panel', k: CMD_ICONS.set, run: () => openPan('#eqPan') });
  c.push({ g: 'Settings', t: 'Sleep timer', k: CMD_ICONS.set, run: () => openPan('#tmPan') });
  c.push({ g: 'Settings', t: 'Force update and clear cache', k: CMD_ICONS.set, run: async () => {
    try { if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { } location.reload(); } });
  return c;
}
function openCmd() {
  cmdOpen = true; cmdSel = 0;
  $('#cmdk').classList.add('open');
  $('#cmdInput').value = ''; $('#cmdInput').focus();
  renderCmd('');
}
function closeCmd() { cmdOpen = false; $('#cmdk').classList.remove('open'); }
function renderCmd(q) {
  const list = $('#cmdList');
  const all = baseCommands();
  const ql = q.trim().toLowerCase();
  cmdItems = ql ? all.filter(x => (x.t + ' ' + x.g).toLowerCase().includes(ql)).slice(0, 40) : all.slice(0, 30);
  if (!cmdItems.length && !ql) { list.innerHTML = '<div class="cmdempty">No commands</div>'; return; }
  let html = '', lastG = '';
  cmdItems.forEach((x, i) => {
    if (x.g !== lastG) { html += `<div class="cmdgrp">${esc(x.g)}</div>`; lastG = x.g; }
    html += `<div class="cmdi${i === cmdSel ? ' sel' : ''}" data-i="${i}" style="animation-delay:${Math.min(i, 10) * .012}s">
      ${x.img ? `<img src="${esc(x.img)}">` : `<span class="ci">${x.k}</span>`}
      <div style="min-width:0"><b>${esc(x.t)}</b>${x.s ? `<span>${esc(x.s)}</span>` : ''}</div>
      ${x.ck ? `<span class="ck">${esc(x.ck)}</span>` : ''}</div>`;
  });
  if (ql.length >= 2) html += `<div class="cmdgrp">Search</div><div class="cmdempty" id="cmdSearching" style="padding:14px">Searching “${esc(q)}”…</div>`;
  list.innerHTML = html;
  list.querySelectorAll('.cmdi').forEach(n => { n.onclick = () => runCmd(+n.dataset.i); });
  if (ql.length >= 2) {
    clearTimeout(cmdT);
    cmdT = setTimeout(async () => {
      try {
        const d = await api('/api/search?q=' + encodeURIComponent(q) + '&n=8', { tries: 0 });
        if (!cmdOpen || $('#cmdInput').value.trim() !== q) return;
        const songs = d.songs || [];
        const start = cmdItems.length;
        songs.forEach(sg => cmdItems.push({ g: 'Songs', t: sg.t, s: sg.a, img: sg.img, ck: fmt(sg.d), run: () => play(songs, songs.indexOf(sg)) }));
        const box = $('#cmdSearching');
        if (box) box.outerHTML = songs.length
          ? songs.map((sg, i) => `<div class="cmdi" data-i="${start + i}"><img src="${esc(sg.img)}">
              <div style="min-width:0"><b>${esc(sg.t)}</b><span>${esc(sg.a)}</span></div>
              <span class="ck">${fmt(sg.d)}</span></div>`).join('')
          : '<div class="cmdempty" style="padding:14px">No songs found</div>';
        $('#cmdList').querySelectorAll('.cmdi').forEach(n => { n.onclick = () => runCmd(+n.dataset.i); });
      } catch (e) { const box = $('#cmdSearching'); if (box) box.textContent = 'Search failed'; }
    }, 300);
  }
}
function runCmd(i) { const x = cmdItems[i]; if (!x) return; closeCmd(); setTimeout(() => { try { x.run(); } catch (e) { } }, 60); }
function moveCmd(d) {
  if (!cmdItems.length) return;
  cmdSel = (cmdSel + d + cmdItems.length) % cmdItems.length;
  const ns = $$('#cmdList .cmdi');
  ns.forEach(n => n.classList.toggle('sel', +n.dataset.i === cmdSel));
  const cur = ns.find(n => +n.dataset.i === cmdSel);
  cur && cur.scrollIntoView({ block: 'nearest' });
}

/* ================= THEMES ================= */
const THEMES = [['venom', 'Venom', '#07090a,#d4ff3f'], ['cobalt', 'Cobalt', '#05080f,#4d9fff'],
['ember', 'Ember', '#0d0705,#ff8a3d'], ['orchid', 'Orchid', '#0a060f,#c77dff'],
['slate', 'Slate', '#0a0a0b,#e8e8ea'], ['paper', 'Paper', '#f3f5f4,#1f9c5b'],
['sakura', 'Sakura', '#120910,#ff8fc7'], ['carbon', 'Carbon', '#0b0d10,#00e5a0']];
const DENS = [['default', 'Default', 'Balanced grid'], ['compact', 'Compact', 'More on screen'],
['cozy', 'Cozy', 'Large and relaxed'], ['list', 'List', 'Dense text rows']];
function setTheme(t) { document.body.dataset.t = t; S.theme = t; SET('theme', t);
  const bg = { venom: '#07090a', cobalt: '#05080f', ember: '#0d0705', orchid: '#0a060f', slate: '#0a0a0b', paper: '#f3f5f4', sakura: '#120910', carbon: '#0b0d10' }[t];
  document.querySelector('meta[name=theme-color]').content = bg; paintAppearance(); }
function setDens(d) { document.body.dataset.d = d; S.dens = d; SET('dens', d); paintAppearance(); }
const ACCENTS = [['default','',''],['lime','#d4ff3f','#7ef29d'],['ice','#5ad1ff','#a78bfa'],
['rose','#ff6b9d','#ffa07a'],['gold','#ffc93c','#ff8a3d'],['mint','#3ddc97','#7ef29d']];
const FONTS = [['grotesk','Grotesk','Modern sans'],['serif','Serif','Editorial'],['mono','Mono','Technical'],['round','Rounded','Friendly']];
const CORNERS = [['sharp','Sharp'],['default','Default'],['round','Round']];
function setAccent(k) { S.accent = k; SET('accent', k);
  const a = ACCENTS.find(x => x[0] === k);
  if (!a || !a[1]) { document.body.style.removeProperty('--ac'); document.body.style.removeProperty('--ac2'); }
  else { document.body.style.setProperty('--ac', a[1]); document.body.style.setProperty('--ac2', a[2]); }
  paintAppearance(); }
function setFont(f) { document.body.dataset.f = f; S.font = f; SET('font', f); paintAppearance(); }
function setCorner(c) { document.body.dataset.c = c; S.corner = c; SET('corner', c); paintAppearance(); }
function paintAppearance() {
  const g = $('#themeGrid'); g.innerHTML = '';
  THEMES.forEach(([k, n, cs]) => { const [a, b] = cs.split(',');
    const s = el('div', 'sw2' + (S.theme === k ? ' on' : ''), `<b>${n}</b>`);
    s.style.background = `linear-gradient(140deg,${a} 42%,${b})`; s.onclick = () => setTheme(k); g.appendChild(s); });
  const d = $('#densGrid'); d.innerHTML = '';
  DENS.forEach(([k, n, ds]) => { const b = el('button', 'op' + (S.dens === k ? ' on' : ''), `${n}<span>${ds}</span>`);
    b.onclick = () => setDens(k); d.appendChild(b); });
  const ag = $('#acGrid'); if (ag) { ag.innerHTML = '';
    ACCENTS.forEach(([k, c1, c2]) => { const x = el('div', 'acdot' + (S.accent === k ? ' on' : ''));
      x.style.background = c1 ? `linear-gradient(135deg,${c1},${c2})` : 'var(--grad)';
      x.title = k; x.onclick = () => setAccent(k); ag.appendChild(x); }); }
  const fg = $('#fontGrid'); if (fg) { fg.innerHTML = '';
    FONTS.forEach(([k, n, ds]) => { const b = el('button', 'op' + (S.font === k ? ' on' : ''), `${n}<span>${ds}</span>`);
      b.onclick = () => setFont(k); fg.appendChild(b); }); }
  const cg = $('#cornGrid'); if (cg) { cg.innerHTML = '';
    CORNERS.forEach(([k, n]) => { const b = el('button', 'op' + (S.corner === k ? ' on' : ''), n);
      b.onclick = () => setCorner(k); cg.appendChild(b); }); }
}

/* ================= EVENTS ================= */
const closeSide = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); };
const PANS = ['#eqPan', '#thPan', '#qPan', '#tmPan'];
const openPan = id => { PANS.forEach(p => p !== id && $(p).classList.remove('open')); $(id).classList.toggle('open'); };
$$('.nav').forEach(b => b.onclick = () => nav(b.dataset.v));
$$('.tabbar button').forEach(b => b.onclick = () => { buzz(); b.dataset.v === 'search' ? (nav('search'), $('#q').focus()) : nav(b.dataset.v); });
$('#menu').onclick = () => { $('#side').classList.toggle('open'); $('#scrim').classList.toggle('on'); };
$('#scrim').onclick = closeSide;
$('#back').onclick = () => { if ($('#fs').classList.contains('open')) return $('#fs').classList.remove('open');
  const p = S.stack.pop(); if (p) { S.view = p.v; S.custom = false; render(); } else nav('home', false); };
$('#main').addEventListener('scroll', () => $('#topbar').classList.toggle('stuck', $('#main').scrollTop > 8), { passive: true });

let sI = -1;
$('#q').addEventListener('input', e => {
  const q = e.target.value.trim(); clearTimeout(sT);
  if (q.length < 2) return $('#sug').classList.remove('open');
  sT = setTimeout(async () => {
    try { const d = await api('/api/suggest?q=' + encodeURIComponent(q), { tries: 0 });
      const s = $('#sug'); s.innerHTML = ''; sI = -1;
      if (!d.items?.length) return s.classList.remove('open');
      d.items.forEach(it => { const r = el('div', 'sgi', `<img loading="lazy" src="${it.img}">
          <div style="min-width:0"><div class="a cl">${esc(it.t)}</div><div class="b cl">${esc(it.s)}</div></div>
          <span class="c">${esc(it.k)}</span>`);
        r.onclick = () => { s.classList.remove('open');
          if (it.k === 'song') { $('#q').value = it.t; doSearch(); }
          else if (it.k === 'artist') { S.stack.push({ v: S.view }); openArtist({ t: it.t }); }
          else { S.stack.push({ v: S.view }); openColl({ id: it.id, t: it.t, k: it.k }); } };
        s.appendChild(r); });
      s.classList.add('open');
    } catch (e) { }
  }, 240);
});
$('#q').addEventListener('keydown', e => {
  const it = $$('#sug .sgi');
  if (e.key === 'ArrowDown' && it.length) { e.preventDefault(); sI = (sI + 1) % it.length; it.forEach((x, i) => x.classList.toggle('sel', i === sI)); it[sI].scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'ArrowUp' && it.length) { e.preventDefault(); sI = (sI - 1 + it.length) % it.length; it.forEach((x, i) => x.classList.toggle('sel', i === sI)); }
  else if (e.key === 'Enter') { sI >= 0 && it[sI] ? it[sI].click() : (clearTimeout(sT), doSearch(), $('#q').blur()); }
  else if (e.key === 'Escape') $('#sug').classList.remove('open');
});
document.addEventListener('click', e => { if (!e.target.closest('.srch')) $('#sug').classList.remove('open'); });

$('#play').onclick = toggle; $('#play2').onclick = toggle; $('#mPlay').onclick = () => { buzz(); toggle(); };
$('#next').onclick = $('#next2').onclick = () => { if (S.room) { if (amHost()) return rAct('next'); return roomGuestGuard(); } skip(false); };
$('#prev').onclick = $('#prev2').onclick = () => { if (S.room) { if (amHost()) return rAct('prev'); return roomGuestGuard(); } prevTrack(); };
const shufFn = () => { S.shuffle = !S.shuffle; $('#shuf').classList.toggle('on', S.shuffle); $('#shuf2').classList.toggle('on', S.shuffle); toast('Shuffle ' + (S.shuffle ? 'on' : 'off')); };
$('#shuf').onclick = $('#shuf2').onclick = shufFn;
const repFn = () => { S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off';
  [$('#rep'), $('#rep2')].forEach(b => { b.classList.toggle('on', S.repeat !== 'off');
    b.querySelector('.dot')?.remove(); if (S.repeat === 'one') b.appendChild(el('span', 'dot')); });
  toast('Repeat ' + S.repeat); };
$('#rep').onclick = $('#rep2').onclick = repFn;
$('#likeB').onclick = $('#mLike').onclick = () => { const s = S.queue[S.idx]; s && like(s); };
$('#fsLike').onclick = () => { const s = S.queue[S.idx]; if (s) { like(s); fsRender(); } };
$('#fsDl').onclick = () => { const s = S.queue[S.idx]; s ? dlSheet(s) : toast('Nothing playing'); };
$('#fsRadio').onclick = () => { const s = S.queue[S.idx]; s && startRadio(s); };
$('#dlB').onclick = () => { const s = S.queue[S.idx]; s ? dlSheet(s) : toast('Nothing playing'); };
$('#autoB').onclick = e => { S.autoplay = !S.autoplay; SET('auto', S.autoplay); e.currentTarget.classList.toggle('on', S.autoplay); toast('Autoplay ' + (S.autoplay ? 'on' : 'off')); };
$('#autoB').classList.toggle('on', S.autoplay);
$('#lyrB').onclick = () => { S.fsTab = 'lyrics'; openFS(); };
$('#fsB').onclick = () => { S.fsTab = 'art'; openFS(); };
$('#pArt').onclick = $('#pMeta').onclick = $('#mImg').onclick = $('#mMeta').onclick = () => { S.fsTab = 'art'; openFS(); };
$('#fsX').onclick = () => $('#fs').classList.remove('open');
$('#mdl').onclick = e => { if (e.target.id === 'mdl') closeM(); };
$('#vol').oninput = e => { au.volume = e.target.value / 100; au.muted = false; volIcon(); };
$('#mute').onclick = () => { au.muted = !au.muted; volIcon(); toast(au.muted ? 'Muted' : 'Unmuted'); };
function volIcon() { const v = au.muted ? 0 : au.volume;
  $('#vIco').innerHTML = v === 0 ? '<path d="M4 9.4v5.2h3.4L12 18.5v-13L7.4 9.4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>'
    : v < .5 ? '<path d="M4 9.4v5.2h3.4L12 18.5v-13L7.4 9.4z"/><path d="M16 9.6a3.6 3.6 0 0 1 0 4.8"/>'
    : '<path d="M4 9.4v5.2h3.4L12 18.5v-13L7.4 9.4z"/><path d="M16 9.6a3.6 3.6 0 0 1 0 4.8"/><path d="M18.7 7a7.2 7.2 0 0 1 0 10"/>'; }

/* seek bars */
function wireSeek(skId, flId, hdId, tcId) {
  const sk = $(skId); if (!sk) return; let dg = false;
  const pos = e => { const r = sk.getBoundingClientRect(); const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; return clamp(x / r.width, 0, 1); };
  const dn = e => { if (!au.duration) return; dg = true; sk.classList.add('dg'); mv(e); };
  const mv = e => { if (!dg) return; const p = pos(e); $(flId).style.width = p * 100 + '%'; $(hdId).style.left = p * 100 + '%'; $(tcId).textContent = fmt(p * au.duration); };
  const up = e => { if (!dg) return; dg = false; sk.classList.remove('dg');
    au.currentTime = pos(e.changedTouches ? { clientX: e.changedTouches[0].clientX } : e) * au.duration;
    if (S.room && S.host) rAct('seek', au.currentTime); };
  sk.addEventListener('mousedown', dn); addEventListener('mousemove', mv); addEventListener('mouseup', up);
  sk.addEventListener('touchstart', dn, { passive: true }); sk.addEventListener('touchmove', mv, { passive: true }); sk.addEventListener('touchend', up);
}
wireSeek('#sk', '#fl', '#hdl', '#tc'); wireSeek('#sk2', '#fl2', '#hd2', '#tc2');

let lastTick = 0;
function tickAll() { tickRoomProgress(); tickLyrics(); }
function tickRoomProgress() {
  const f = $('#rpFill'); if (!f) return;
  const p = au.duration ? au.currentTime / au.duration : 0;
  f.style.width = (p * 100) + '%';
  const t = $('#rpTime'); if (t) t.textContent = fmt(au.currentTime) + ' / ' + fmt(au.duration);
}
au.ontimeupdate = () => {
  tickAll();
  if (au.duration) { const p = au.currentTime / au.duration;
    if (!$('#sk').classList.contains('dg')) { $('#fl').style.width = p * 100 + '%'; $('#hdl').style.left = p * 100 + '%'; }
    if (!$('#sk2').classList.contains('dg')) { $('#fl2').style.width = p * 100 + '%'; $('#hd2').style.left = p * 100 + '%'; }
    $('#mPrg').style.width = p * 100 + '%'; }
  const c = fmt(au.currentTime), d = fmt(au.duration);
  $('#tc').textContent = c; $('#td').textContent = d; $('#tc2').textContent = c; $('#td2').textContent = d;
  const n = Date.now(); if (n - lastTick > 5000 && !au.paused) { S.stats.secs += 5; lastTick = n; save(); }
};
au.onprogress = () => { try { if (au.buffered.length && au.duration) $('#bf').style.width = (au.buffered.end(au.buffered.length - 1) / au.duration * 100) + '%'; } catch (e) { } };
function icons() { const h = au.paused ? I.play : I.pause;
  $('#pIco').outerHTML = h.replace('<svg', '<svg id="pIco"'); $('#mIco').outerHTML = h.replace('<svg', '<svg id="mIco"');
  $('#pIco2').outerHTML = h.replace('<svg', '<svg id="pIco2" style="width:24px;height:24px;fill:var(--acd);stroke:none"');
  $('#play').classList.toggle('pause', au.paused);
  $('.fsart')?.classList.toggle('go', !au.paused); }
au.onplay = () => { icons(); markRows(); if ($('#fs').classList.contains('open') && S.fsTab === 'art') startViz(); };
au.onpause = () => { icons(); markRows(); };
au.onended = () => {
  if (S.tmrEnd === -1) { S.tmrEnd = 0; return toast('Sleep timer stopped playback'); }
  if (S.room) { if (amHost()) rAct('next'); return; }
  skip(true);
};
au.onerror = () => { if (!au.src) return; errN++;
  if (errN > 3) { au.pause(); errN = 0; return toast('Playback trouble — paused'); }
  if (S.adapt && S.q !== '96') { toast('Network is slow — lowering quality'); return setQ('96'); }
  toast('Stream error, skipping'); setTimeout(() => skip(true), 700); };

(() => {
  const b = $('#qMode'), m = $('#mMode');
  let held = false, tmr = 0;
  const start = () => { held = false; tmr = setTimeout(() => { held = true; buzz(18); openQuickPick(b); }, 480); };
  const end = e => { clearTimeout(tmr); if (!held) toggleQuick(); else e && e.preventDefault(); };
  if (b) {
    b.addEventListener('mousedown', start);
    b.addEventListener('mouseup', end);
    b.addEventListener('mouseleave', () => clearTimeout(tmr));
    b.addEventListener('touchstart', start, { passive: true });
    b.addEventListener('touchend', end);
    b.addEventListener('contextmenu', e => { e.preventDefault(); clearTimeout(tmr); openQuickPick(b); });
  }
  if (m) {
    let mt = 0, mh = false;
    m.addEventListener('touchstart', () => { mh = false; mt = setTimeout(() => { mh = true; buzz(18); openQuickPick(m); }, 480); }, { passive: true });
    m.addEventListener('touchend', () => { clearTimeout(mt); if (!mh) toggleQuick(); });
    m.addEventListener('click', e => { if (e.detail === 0) toggleQuick(); });
  }
  document.addEventListener('click', e => { if (!e.target.closest('#qpick') && !e.target.closest('#qMode') && !e.target.closest('#mMode')) closeQuickPick(); });
})();
$('#cmdInput').addEventListener('input', e => { cmdSel = 0; renderCmd(e.target.value); });
$('#cmdInput').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveCmd(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmd(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdSel); }
  else if (e.key === 'Escape') closeCmd();
});
$('#cmdk').addEventListener('click', e => { if (e.target.id === 'cmdk') closeCmd(); });
$('#chatFab').onclick = () => toggleDock();
$('#cdMin').onclick = () => toggleDock(false);
(() => { const send = () => { const v = $('#cdInput').value.trim(); if (!v) return;
    $('#cdInput').value = '';
    rAct('chat', v, sn => { sn.chat = [...(sn.chat || []), { u: S.me, m: v, t: Date.now() }].slice(-70); });
    cdSeen++; };
  $('#cdSend').onclick = send;
  $('#cdInput').onkeydown = e => { if (e.key === 'Enter') send(); };
})();
$('#eqBtn').onclick = () => openPan('#eqPan');
$('#thBtn').onclick = () => openPan('#thPan');
$('#qBtn').onclick = () => openPan('#qPan');
$('#tmB').onclick = () => openPan('#tmPan');
$('#eqX').onclick = () => $('#eqPan').classList.remove('open');
$('#thX').onclick = () => $('#thPan').classList.remove('open');
$('#qX').onclick = () => $('#qPan').classList.remove('open');
$('#tmX').onclick = () => $('#tmPan').classList.remove('open');
$('#swRain').onclick = e => { S.rain = !S.rain; e.currentTarget.classList.toggle('on', S.rain); wake(); applyFX(); };
$('#swKar').onclick = e => { S.kar = !S.kar; e.currentTarget.classList.toggle('on', S.kar); applyFX(); toast('Vocal reducer ' + (S.kar ? 'on' : 'off')); };
$('#swCmp').onclick = e => { S.cmp = !S.cmp; SET('cmp', S.cmp); e.currentTarget.classList.toggle('on', S.cmp); applyFX();
  toast(S.cmp ? 'Peak limiter on' : 'Peak limiter off — pure signal'); };
$('#swFade').onclick = e => { S.fade = !S.fade; e.currentTarget.classList.toggle('on', S.fade); };
$('#swAdapt').onclick = e => { S.adapt = !S.adapt; SET('adapt', S.adapt); e.currentTarget.classList.toggle('on', S.adapt); };
$('#swDlMax').onclick = e => { S.dlMax = !S.dlMax; SET('dlMax', S.dlMax); e.currentTarget.classList.toggle('on', S.dlMax); };
$('#swSpin').onclick = e => { S.spin = !S.spin; SET('spin', S.spin); e.currentTarget.classList.toggle('on', S.spin); if ($('#fs').classList.contains('open')) fsRender(); };
$('#swMotion').onclick = e => { const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on); document.documentElement.style.setProperty('scroll-behavior', on ? 'auto' : 'smooth');
  document.body.style.setProperty('--ease', on ? 'linear' : 'cubic-bezier(.22,1,.36,1)'); toast('Motion ' + (on ? 'reduced' : 'normal')); };
$('#eqReset').onclick = () => { setMode('off'); setEQPreset('flat'); toast('Audio reset'); };
$('#swHC').onclick = e => { const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on); document.body.dataset.hc = on ? '1' : '0'; SET('hc', on); };
$('#swMiniBar').onclick = e => { const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on); SET('minibar', on);
  document.querySelector('.pbar').style.padding = on ? '6px 20px calc(6px + var(--sbb))' : ''; };
$('#apReset').onclick = () => { setTheme('venom'); setDens('default'); setAccent('default'); setFont('grotesk'); setCorner('default');
  document.body.dataset.hc = '0'; $('#swHC').classList.remove('on'); toast('Appearance reset'); };
$('#netRetry').onclick = () => { MEM.clear(); setNet(false); render(); toast('Retrying'); };
KNOBS.forEach(([k, l, key, f]) => { $('#' + k).oninput = e => { FX[key] = +e.target.value; $('#' + l).textContent = f(e.target.value); wake(); applyFX(); }; });

$$('#tmBtns .op').forEach(b => b.onclick = () => {
  const m = +b.dataset.m; clearInterval(S.tmr);
  $$('#tmBtns .op').forEach(x => x.classList.remove('on')); b.classList.add('on');
  if (!m) { S.tmrEnd = -1; $('#tmState').textContent = 'Playback stops when this track ends.'; return toast('Stopping after this track'); }
  S.tmrEnd = Date.now() + m * 6e4;
  S.tmr = setInterval(() => { const l = S.tmrEnd - Date.now();
    if (l <= 0) { clearInterval(S.tmr); fadeTo(0, 5000); setTimeout(() => { au.pause(); au.volume = $('#vol').value / 100; }, 5200);
      $('#tmState').textContent = 'No timer running.'; return toast('Sleep timer finished'); }
    $('#tmState').textContent = `Fading out in ${fmt(l / 1000)}.`; }, 1000);
  toast('Sleep timer set for ' + m + ' minutes');
});
$('#tmCancel').onclick = () => { clearInterval(S.tmr); S.tmrEnd = 0; $$('#tmBtns .op').forEach(x => x.classList.remove('on'));
  $('#tmState').textContent = 'No timer running.'; toast('Timer cancelled'); };

addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdOpen ? closeCmd() : openCmd(); return; }
  if (cmdOpen && e.key === 'Escape') { closeCmd(); return; }
  const ty = /input|textarea|select/i.test(e.target.tagName);
  if (e.key === '/' && !ty) { e.preventDefault(); return $('#q').focus(); }
  if (e.key === 'Escape') { $('#fs').classList.remove('open'); closeM(); PANS.forEach(p => $(p).classList.remove('open')); closeSide(); $('#ctx').classList.remove('open'); toggleDock(false); }
  if (ty) return;
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.key === 'ArrowRight') au.currentTime += 5;
  if (e.key === 'ArrowLeft') au.currentTime -= 5;
  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Math.min(100, +$('#vol').value + 5); $('#vol').value = v; au.volume = v / 100; volIcon(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(0, +$('#vol').value - 5); $('#vol').value = v; au.volume = v / 100; volIcon(); }
  if (k === 'n') skip(false); if (k === 'p') prevTrack();
  if (k === 's') shufFn(); if (k === 'r') repFn();
  if (k === 'l') { const s = S.queue[S.idx]; s && like(s); }
  if (k === 'd') $('#dlB').click(); if (k === 'm') $('#mute').click();
  if (k === 'k') openCmd();
  if (k === 'c') toggleDock();
  if (k === 'q') toggleQuick();
  if (k === 'y') { S.fsTab = 'lyrics'; openFS(); }
  if (k === 'f') { S.fsTab = 'art'; openFS(); }
  if (k >= '1' && k <= '9') { const ks = Object.keys(MODES); ks[+k - 1] && setMode(ks[+k - 1]); }
});

let tsx = 0, tsy = 0;
$('#mini').addEventListener('touchstart', e => { tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; }, { passive: true });
$('#mini').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tsx, dy = e.changedTouches[0].clientY - tsy;
  if (dy < -60 && Math.abs(dy) > Math.abs(dx)) { S.fsTab = 'art'; return openFS(); }
  if (Math.abs(dx) > 60) { buzz(); dx < 0 ? skip(false) : prevTrack(); }
});
$('#fs').addEventListener('touchstart', e => { tsy = e.touches[0].clientY; }, { passive: true });
$('#fs').addEventListener('touchend', e => { if (e.changedTouches[0].clientY - tsy > 110 && $('#fsBody').scrollTop <= 0) $('#fs').classList.remove('open'); });

if ('mediaSession' in navigator) try {
  navigator.mediaSession.setActionHandler('play', () => au.play());
  navigator.mediaSession.setActionHandler('pause', () => au.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => skip(false));
  navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
  navigator.mediaSession.setActionHandler('seekto', d => { if (d.seekTime != null) au.currentTime = d.seekTime; });
} catch (e) { }
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.room && S.snap && !S.host) follow(S.snap); });

/* ================= ONBOARDING GATE ================= */
function initGate() {
  const done = LS('agreed', 0);
  const g = $('#gate');
  fetch('logo.svg').then(r => r.text()).then(t => { const m = $('#gateMk'); if (m) m.innerHTML = t; }).catch(() => { });
  if (done) return;
  g.classList.add('on');
  const chk = $('#gChk'), btn = $('#gGo');
  let ok = false;
  const flip = e => { if (e.target.tagName === 'A') return;
    ok = !ok; chk.classList.toggle('ok', ok); btn.disabled = !ok; buzz(8); };
  chk.addEventListener('click', flip);
  $('#gTerms').onclick = e => { e.preventDefault(); e.stopPropagation(); g.classList.remove('on'); SET('agreed', 0); nav('legal'); setTimeout(() => g.classList.add('on'), 40); };
  ['gTerms', 'gPriv', 'gDmca'].forEach(id => { const a = $('#' + id);
    if (a) a.onclick = e => { e.preventDefault(); e.stopPropagation(); showLegalModal(id === 'gPriv' ? 'privacy' : id === 'gDmca' ? 'dmca' : 'terms'); }; });
  btn.onclick = () => { if (!ok) return;
    SET('agreed', Date.now()); g.style.transition = 'opacity .4s, transform .4s';
    g.style.opacity = '0'; g.style.transform = 'scale(1.03)';
    setTimeout(() => { g.classList.remove('on'); g.style.cssText = ''; }, 400);
    toast('Welcome to Sonora'); };
}
function showLegalModal(kind) {
  const T = {
    terms: ['Terms of use', `Sonora is a personal music player. By using it you agree to:
• use it for private, personal listening only
• not redistribute, rebroadcast or sell anything you access through it
• respect the rights of artists, labels and rights holders in your country
• accept that the service is provided as-is with no warranty of any kind

Sonora hosts no audio files. It reads publicly reachable streams and shows metadata. Availability can change or stop at any time.`],
    privacy: ['Privacy notice', `Sonora has no accounts and no user database.
• Likes, playlists, history, settings and stats are stored only in your own browser
• No cookies are set for tracking or advertising
• A short anonymous id is generated locally so the live listener count works; it is never linked to you and disappears after about a minute of inactivity
• Room chat is kept in memory only and vanishes when the room empties
• Nothing is sold, shared or sent to third parties

Clear your browser data and every trace is gone.`],
    dmca: ['Copyright and takedown', `Sonora stores and hosts no audio, artwork or lyrics. It is a client that reads publicly reachable endpoints, in the same way a browser does.

If you are a rights holder and believe content reachable through this interface infringes your rights, contact the operator of this deployment with:
• identification of the work
• the exact reference or URL
• your contact details
• a statement of good-faith belief and authority to act

Verified requests are honoured promptly and the reference is blocked.

Please note: takedown notices should generally be directed at the party that actually hosts the file, not at a client application.`],
  }[kind];
  modal(`<h3>${esc(T[0])}</h3><div class="sb2" style="white-space:pre-wrap;line-height:1.75;font-size:12.5px">${esc(T[1])}</div>`);
}

/* ================= INIT ================= */
fetch('logo.svg').then(r => r.text()).then(t => $('#mk').innerHTML = t).catch(() => { });
setTheme(S.theme); setDens(S.dens); setAccent(S.accent); setFont(S.font); setCorner(S.corner);
if (LS('hc', false)) { document.body.dataset.hc = '1'; $('#swHC').classList.add('on'); }
buildEQ(); paintPresets(); paintModes(); paintAppearance(); paintQ(); syncKnobs();
paintQPill();
$('#swSpin').classList.toggle('on', S.spin);
$('#swCmp').classList.toggle('on', S.cmp);
if (S.mode !== 'off') setMode(S.mode, true); else { S.eq = LS('eq', [0, 0, 0, 0, 0, 0, 0]); drawEQ(); }
initGate();
paintQuick();
au.volume = .9; volIcon();
document.body.classList.remove('has-track');
counts(); render();
if ('serviceWorker' in navigator) addEventListener('load', async () => {
  try {
    const r = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    r.update();
    if (r.waiting) r.waiting.postMessage('skip');
    r.addEventListener('updatefound', () => { const w = r.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage('skip'); }); });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
  } catch (e) { }
});
requestAnimationFrame(() => setTimeout(() => $('#boot').classList.add('gone'), 380));
setTimeout(() => {
  const b = $('#boot');
  if (b && !b.classList.contains('gone')) {
    const st = $('#bootSt');
    if (st) st.innerHTML = 'Taking longer than usual — <a href="#" id="bootFix" style="color:var(--ac)">tap to reset</a>';
    const f = $('#bootFix');
    if (f) f.onclick = async e => { e.preventDefault();
      try { if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
        if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (x) {}
      location.reload(); };
  }
  setTimeout(() => $('#boot').classList.add('gone'), 2500);
}, 5000);
beat(); liveTimer = setInterval(() => { if (!document.hidden) beat(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
addEventListener('online', () => { setNet(false); MEM.clear(); });
addEventListener('offline', () => setNet(true, 'You are offline'));
if (!navigator.onLine) setNet(true, 'You are offline');
const rp = new URLSearchParams(location.search).get('room');
if (rp) setTimeout(() => askJoin(rp), 700);
