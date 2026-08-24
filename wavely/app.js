/* ==========================================================
   SONORA — client
   ========================================================== */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = s => (!s || !isFinite(s) || s < 0) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const nf = n => n >= 1e7 ? (n / 1e7).toFixed(1) + 'Cr' : n >= 1e5 ? (n / 1e5).toFixed(1) + 'L' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : (n || '');
const LS = (k, d) => { try { const v = localStorage.getItem('so_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const SET = (k, v) => { try { localStorage.setItem('so_' + k, JSON.stringify(v)); } catch (e) { } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let tT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('show'), 2500); };
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } };

async function api(p, tries = 2) {
  for (let i = 0; i <= tries; i++) {
    try {
      const c = new AbortController(), to = setTimeout(() => c.abort(), 15000);
      const r = await fetch(p, { signal: c.signal }); clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === tries) throw e; await sleep(400 * (i + 1)); }
  }
}

/* ============ STATE ============ */
const S = {
  view: 'home', stack: [], detail: null,
  queue: [], idx: -1,
  liked: LS('liked', []), recent: LS('recent', []), dls: LS('dls', []), pls: LS('pls', []),
  stats: LS('stats', { secs: 0, plays: 0, artists: {}, days: {} }),
  shuffle: false, repeat: 'off', autoplay: LS('auto', true),
  q: LS('q', '320'), autoQ: LS('autoQ', true), lang: LS('lang', 'hindi'),
  mode: LS('mode', 'off'), rain: false, kar: false, cmp: true, fade: true,
  theme: LS('theme', 'midnight'), ui: LS('ui', 'default'),
  room: null, es: null, me: LS('me', 'guest' + Math.floor(Math.random() * 900 + 100)),
  tmr: null, tmrEnd: 0,
};
const save = () => { SET('liked', S.liked.slice(0, 600)); SET('recent', S.recent.slice(0, 100)); SET('dls', S.dls.slice(0, 300)); SET('pls', S.pls); SET('stats', S.stats); };

/* ============ AUDIO ENGINE ============ */
const au = $('#au');
let AC, srcN, lpN, baN, trN, cvN, wetN, dryN, nzN, rnN, panN, cmpN, anN, outN,
  wLL, wLR, wRL, wRR, ready = false, phase = 0, panRAF = 0;

function boot() {
  if (ready) return true;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    srcN = AC.createMediaElementSource(au);
    lpN = AC.createBiquadFilter(); lpN.type = 'lowpass'; lpN.frequency.value = 20000;
    baN = AC.createBiquadFilter(); baN.type = 'lowshelf'; baN.frequency.value = 190;
    trN = AC.createBiquadFilter(); trN.type = 'highshelf'; trN.frequency.value = 5200;

    const sp = AC.createChannelSplitter(2), mg = AC.createChannelMerger(2);
    wLL = AC.createGain(); wLR = AC.createGain(); wRL = AC.createGain(); wRR = AC.createGain();
    wLL.gain.value = wRR.gain.value = 1; wLR.gain.value = wRL.gain.value = 0;
    sp.connect(wLL, 0); sp.connect(wLR, 0); sp.connect(wRR, 1); sp.connect(wRL, 1);
    wLL.connect(mg, 0, 0); wRL.connect(mg, 0, 0); wRR.connect(mg, 0, 1); wLR.connect(mg, 0, 1);

    panN = AC.createStereoPanner();
    cvN = AC.createConvolver(); cvN.buffer = ir(2.6, 2.5);
    wetN = AC.createGain(); wetN.gain.value = 0;
    dryN = AC.createGain(); dryN.gain.value = 1;
    cmpN = AC.createDynamicsCompressor(); cmpN.threshold.value = -18; cmpN.ratio.value = 4; cmpN.knee.value = 14;
    anN = AC.createAnalyser(); anN.fftSize = 256; anN.smoothingTimeConstant = .82;
    outN = AC.createGain();

    srcN.connect(lpN); lpN.connect(baN); baN.connect(trN); trN.connect(sp);
    mg.connect(panN);
    panN.connect(dryN); dryN.connect(cmpN);
    panN.connect(cvN); cvN.connect(wetN); wetN.connect(cmpN);
    cmpN.connect(anN); anN.connect(outN); outN.connect(AC.destination);

    nzN = AC.createGain(); nzN.gain.value = 0;
    const ns = AC.createBufferSource(); ns.buffer = crackle(5); ns.loop = true;
    const nf2 = AC.createBiquadFilter(); nf2.type = 'bandpass'; nf2.frequency.value = 3300; nf2.Q.value = .5;
    ns.connect(nf2); nf2.connect(nzN); nzN.connect(outN); ns.start();

    rnN = AC.createGain(); rnN.gain.value = 0;
    const rs = AC.createBufferSource(); rs.buffer = rain(7); rs.loop = true;
    const rf = AC.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 4600;
    rs.connect(rf); rf.connect(rnN); rnN.connect(outN); rs.start();
    ready = true; return true;
  } catch (e) { console.warn(e); return false; }
}
const wake = () => { if (!ready) boot(); if (AC && AC.state === 'suspended') AC.resume(); };
function ir(sec, dk) { const n = AC.sampleRate * sec, b = AC.createBuffer(2, n, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, dk); } return b; }
function crackle(s) { const n = AC.sampleRate * s, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() < .0014 ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * .009; return b; }
function rain(s) { const n = AC.sampleRate * s, b = AC.createBuffer(2, n, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let l = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = (l + .026 * w) / 1.026; d[i] = l * 3.5 + w * .055; } } return b; }

/* ============ 16 SOUND MODES ============ */
const M = {
  off:    { n: 'Normal',      i: '⭕', d: 'Untouched',           sp: 100, to: 20000, ba: 0,  tr: 0,   re: 0,  no: 0,  pa: 0,  wi: 100 },
  lofi:   { n: 'Lo-Fi',       i: '🌙', d: 'Slow, warm, crackly',  sp: 85,  to: 2400,  ba: 6,  tr: -6,  re: 30, no: 22, pa: 0,  wi: 110 },
  deep:   { n: 'Deep Lo-Fi',  i: '🫧', d: 'Extra depth & body',   sp: 82,  to: 1900,  ba: 11, tr: -8,  re: 45, no: 26, pa: 12, wi: 150 },
  slowrev:{ n: 'Slowed+Rev',  i: '💜', d: 'Dreamy cinematic',     sp: 80,  to: 8000,  ba: 5,  tr: -2,  re: 58, no: 0,  pa: 0,  wi: 155 },
  night:  { n: 'Nightcore',   i: '⚡', d: 'Fast & bright 128%',   sp: 128, to: 20000, ba: 2,  tr: 6,   re: 8,  no: 0,  pa: 0,  wi: 125 },
  eight:  { n: '8D Audio',    i: '🌀', d: 'Rotates around you',   sp: 100, to: 20000, ba: 5,  tr: 2,   re: 38, no: 0,  pa: 55, wi: 180 },
  bass:   { n: 'Bass Boost',  i: '🔊', d: 'Club-grade low end',   sp: 100, to: 20000, ba: 15, tr: 2,   re: 4,  no: 0,  pa: 0,  wi: 115 },
  club:   { n: 'Club',        i: '🎉', d: 'Loud, wide, punchy',   sp: 104, to: 20000, ba: 10, tr: 6,   re: 24, no: 0,  pa: 0,  wi: 170 },
  vocal:  { n: 'Vocal',       i: '🎤', d: 'Mid-forward clarity',  sp: 100, to: 20000, ba: -4, tr: 7,   re: 5,  no: 0,  pa: 0,  wi: 75  },
  hall:   { n: 'Concert',     i: '🏛', d: 'Live hall acoustics',  sp: 100, to: 16000, ba: 4,  tr: 3,   re: 70, no: 0,  pa: 0,  wi: 190 },
  tape:   { n: 'Old Tape',    i: '📼', d: 'Heavy vintage grit',   sp: 76,  to: 1500,  ba: 9,  tr: -10, re: 22, no: 50, pa: 0,  wi: 85  },
  radio:  { n: 'AM Radio',    i: '📻', d: 'Tinny retro speaker',  sp: 100, to: 3400,  ba: -8, tr: -4,  re: 10, no: 32, pa: 0,  wi: 20  },
  rainy:  { n: 'Rainy Cafe',  i: '🌧', d: 'Lo-fi + rainfall',     sp: 88,  to: 3200,  ba: 5,  tr: -4,  re: 44, no: 26, pa: 0,  wi: 130, rain: 1 },
  sleep:  { n: 'Sleep',       i: '😴', d: 'Ultra soft, drifting', sp: 82,  to: 1300,  ba: 3,  tr: -11, re: 55, no: 9,  pa: 8,  wi: 120 },
  focus:  { n: 'Focus',       i: '📚', d: 'Flat, zero fatigue',   sp: 96,  to: 6800,  ba: 1,  tr: -3,  re: 12, no: 7,  pa: 0,  wi: 100 },
  gym:    { n: 'Workout',     i: '💪', d: 'Aggressive & hyped',   sp: 108, to: 20000, ba: 12, tr: 8,   re: 6,  no: 0,  pa: 0,  wi: 140 },
};
const FX = { ...M.off };

function applyFX() {
  au.playbackRate = Math.max(.25, Math.min(4, FX.sp / 100));
  try { au.preservesPitch = au.mozPreservesPitch = au.webkitPreservesPitch = false; } catch (e) { }
  const b = $('#mBadge'), on = S.mode !== 'off';
  if (b) { b.style.display = on ? '' : 'none'; b.textContent = on ? M[S.mode].n : ''; }
  $('#fxBtn').classList.toggle('on', on);
  if (!ready) return;
  const t = AC.currentTime, r = .1;
  lpN.frequency.setTargetAtTime(FX.to, t, r);
  baN.gain.setTargetAtTime(FX.ba, t, r);
  trN.gain.setTargetAtTime(S.kar ? FX.tr + 5 : FX.tr, t, r);
  wetN.gain.setTargetAtTime(FX.re / 100 * .9, t, r);
  dryN.gain.setTargetAtTime(1 - FX.re / 340, t, r);
  nzN.gain.setTargetAtTime(FX.no / 100 * .2, t, r);
  rnN.gain.setTargetAtTime(S.rain ? .3 : 0, t, .4);
  cmpN.threshold.setTargetAtTime(S.cmp ? -18 : 0, t, r);
  cmpN.ratio.setTargetAtTime(S.cmp ? 4 : 1, t, r);
  const w = FX.wi / 100, dd = (1 + w) / 2, cc = (1 - w) / 2;
  wLL.gain.setTargetAtTime(dd, t, r); wRR.gain.setTargetAtTime(dd, t, r);
  wLR.gain.setTargetAtTime(cc, t, r); wRL.gain.setTargetAtTime(cc, t, r);
  cancelAnimationFrame(panRAF);
  if (FX.pa > 0) { const sp = FX.pa / 100; const lp = () => { phase += .011 * sp; panN.pan.value = Math.sin(phase) * .95; panRAF = requestAnimationFrame(lp); }; panRAF = requestAnimationFrame(lp); }
  else panN.pan.value = 0;
}
function setMode(m, quiet) {
  if (!M[m]) m = 'off';
  S.mode = m; SET('mode', m); Object.assign(FX, M[m]); S.rain = !!M[m].rain;
  wake(); $('#swRain').classList.toggle('on', S.rain);
  knobs(); applyFX(); paintModes();
  if (!quiet) toast(M[m].i + ' ' + M[m].n + ' mode');
}
const KN = [['kSp', 'vSp', 'sp', v => v + '%'], ['kTo', 'vTo', 'to', v => (v / 1000).toFixed(1) + ' kHz'],
['kBa', 'vBa', 'ba', v => (v > 0 ? '+' : '') + v + ' dB'], ['kTr', 'vTr', 'tr', v => (v > 0 ? '+' : '') + v + ' dB'],
['kRe', 'vRe', 're', v => v + '%'], ['kWi', 'vWi', 'wi', v => v + '%'],
['kPa', 'vPa', 'pa', v => +v ? v + '%' : 'off'], ['kNo', 'vNo', 'no', v => v + '%']];
const knobs = () => KN.forEach(([k, l, key, f]) => { const i = $('#' + k); if (i) { i.value = FX[key]; $('#' + l).textContent = f(FX[key]); } });
function paintModes() {
  const g = $('#modes'); if (!g) return; g.innerHTML = '';
  for (const k in M) { const b = el('button', 'opt' + (S.mode === k ? ' on' : ''), `${M[k].i} ${esc(M[k].n)}<span>${esc(M[k].d)}</span>`); b.onclick = () => setMode(k); g.appendChild(b); }
}

/* ============ PLAYBACK ============ */
const surl = (s, q) => { const u = (s.u || {})[q || S.q] || s.raw || Object.values(s.u || {}).pop(); return u ? '/stream?u=' + encodeURIComponent(u) : ''; };
let curErr = 0;

async function play(list, i) {
  if (list) { S.queue = list.slice(0, 300); S.idx = i; }
  const s = S.queue[S.idx]; if (!s) return;
  if (!s.u || !Object.keys(s.u).length) { try { const d = await api('/api/song?id=' + s.id); if (d.song) Object.assign(s, d.song); } catch (e) { } }
  const url = surl(s);
  if (!url) { toast('Track unavailable, skipping'); return skip(true); }
  wake();
  au.src = url;
  const v = $('#vol').value / 100;
  au.volume = S.fade ? 0 : v;
  try { await au.play(); curErr = 0; } catch (e) { toast('Tap ▶ to start'); }
  if (S.fade) fade(v, 600);
  applyFX(); nowPlaying(s);
  S.recent = [s, ...S.recent.filter(x => x.id !== s.id)].slice(0, 100);
  S.stats.plays++; S.stats.artists[s.a] = (S.stats.artists[s.a] || 0) + 1;
  save(); counts();
  if ($('#fs').classList.contains('open')) lyrics(s);
  if (S.room && S.roomHost) rAct('idx', S.idx);
  markRows();
}
let fR; function fade(to, ms) { cancelAnimationFrame(fR); const a = au.volume, t0 = performance.now();
  const st = t => { const k = Math.min(1, (t - t0) / ms); au.volume = a + (to - a) * k; if (k < 1) fR = requestAnimationFrame(st); }; fR = requestAnimationFrame(st); }

function nowPlaying(s) {
  const isL = S.liked.some(x => x.id === s.id);
  $('#pImg').src = s.img; $('#pT').textContent = s.t; $('#pA').textContent = s.a;
  $('#mImg').src = s.img; $('#mT').textContent = s.t; $('#mA').textContent = s.a;
  $('#likeB').classList.toggle('on', isL);
  $('#mLike').querySelector('path').style.fill = isL ? 'var(--warn)' : 'none';
  $('#mLike').querySelector('path').style.stroke = isL ? 'var(--warn)' : 'currentColor';
  $('#fsImg').src = s.img; $('#fsBg').style.backgroundImage = `url("${s.img}")`;
  $('#fsT').textContent = s.t; $('#fsA').textContent = s.a + (s.al ? ' · ' + s.al : '') + (s.y ? ' · ' + s.y : '');
  document.title = s.t + ' — Sonora';
  if ('mediaSession' in navigator) try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: s.t, artist: s.a, album: s.al, artwork: [96, 256, 512].map(x => ({ src: s.img, sizes: x + 'x' + x, type: 'image/jpeg' })) });
  } catch (e) { }
}
async function skip(auto) {
  if (S.repeat === 'one' && auto) { au.currentTime = 0; au.play(); return; }
  if (!S.queue.length) return;
  let i = S.shuffle ? Math.floor(Math.random() * S.queue.length) : S.idx + 1;
  if (i >= S.queue.length) {
    if (S.repeat === 'all' || !auto) i = 0;
    else if (S.autoplay && auto) return radioNext();
    else { au.pause(); return; }
  }
  S.idx = i; play();
}
async function radioNext() {
  const c = S.queue[S.idx]; if (!c) return;
  toast('🔄 Finding similar tracks…');
  try {
    let d = await api('/api/similar?id=' + c.id);
    if (!d.songs?.length) d = await api('/api/search?q=' + encodeURIComponent(c.a) + '&n=25');
    const nw = (d.songs || []).filter(x => !S.queue.some(y => y.id === x.id));
    if (!nw.length) { au.pause(); return toast('Queue finished'); }
    S.queue.push(...nw.slice(0, 20)); S.idx++; play(); counts();
  } catch (e) { au.pause(); }
}
const back = () => { if (au.currentTime > 4) return au.currentTime = 0; S.idx = S.idx <= 0 ? S.queue.length - 1 : S.idx - 1; play(); };
function toggle() { if (!S.queue.length) return toast('Nothing queued'); wake(); au.paused ? au.play() : au.pause(); if (S.room && S.roomHost) rAct(au.paused ? 'pause' : 'play'); }

/* ============ LIBRARY ============ */
const isL = id => S.liked.some(x => x.id === id);
function like(s) {
  if (isL(s.id)) { S.liked = S.liked.filter(x => x.id !== s.id); toast('Removed'); }
  else { S.liked = [s, ...S.liked]; toast('❤ Liked'); }
  haptic(); save(); counts(); markRows();
  const c = S.queue[S.idx]; if (c && c.id === s.id) nowPlaying(c);
  if (['liked'].includes(S.view)) render();
}
const counts = () => { $('#cL').textContent = S.liked.length || ''; $('#cQ').textContent = S.queue.length || ''; };
function markRows() {
  const c = S.queue[S.idx];
  $$('.row').forEach(r => { const on = c && r.dataset.id === c.id; r.classList.toggle('pl', on);
    const n = r.querySelector('.rn'); if (n) n.innerHTML = on && !au.paused ? '<div class="eq"><i></i><i></i><i></i></div>' : (r.dataset.n || '');
    const lk = r.querySelector('.mn[data-a=like]'); if (lk) lk.classList.toggle('liked', isL(r.dataset.id)); });
}

/* ============ DOWNLOAD ============ */
async function dl(s, q) {
  if (!s.u || !Object.keys(s.u).length) { try { const d = await api('/api/song?id=' + s.id); Object.assign(s, d.song || {}); } catch (e) { } }
  const raw = (s.u || {})[q] || s.raw; if (!raw) return toast('No file available');
  const nm = `${s.t} - ${s.a}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 110) + '.m4a';
  const a = document.createElement('a');
  a.href = `/dl?u=${encodeURIComponent(raw)}&name=${encodeURIComponent(nm)}`; a.download = nm;
  document.body.appendChild(a); a.click(); a.remove();
  toast(`⬇ Saving ${q} kbps…`);
  S.dls = [{ ...s, dq: q, at: Date.now() }, ...S.dls.filter(x => x.id !== s.id)]; save();
}
async function dlSheet(s) {
  if (!s.u || !Object.keys(s.u).length) { try { const d = await api('/api/song?id=' + s.id); Object.assign(s, d.song || {}); } catch (e) { } }
  const qs = Object.keys(s.u || {}).sort((a, b) => b - a);
  const est = q => s.d ? ((+q * 1000 / 8) * s.d / 1048576).toFixed(1) + ' MB' : '';
  const lbl = { '320': 'Best', '160': 'High', '96': 'Good', '48': 'Saver', '12': 'Tiny' };
  modal(`<div class="qv"><img src="${s.img}"><div><h3>${esc(s.t)}</h3><div class="sub">${esc(s.a)}</div></div></div>
    <div class="sub">Pick a quality — saves straight to your device.</div>
    <div class="dlr">${qs.map(q => `<button class="dlb" data-q="${q}">${q} kbps · ${lbl[q] || ''}<br><span style="font-weight:500;opacity:.55;font-size:10px">${est(q)}</span></button>`).join('') || '<span class="sub">Unavailable</span>'}</div>`,
    m => m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { closeM(); dl(s, b.dataset.q); }));
}
function modal(h, after) { const m = $('#sheet'); m.innerHTML = h + `<div class="dlr"><button class="dlb" id="mx" style="opacity:.65;flex:1">Close</button></div>`;
  $('#mdl').classList.add('open'); $('#mx').onclick = closeM; after && after(m); }
const closeM = () => $('#mdl').classList.remove('open');

/* ============ PLAYLISTS ============ */
function toPl(s) {
  modal(`<h3>Add to playlist</h3><div class="sub">${esc(s.t)}</div>
    <div class="dlr" style="flex-direction:column;align-items:stretch">
    ${S.pls.map((p, i) => `<button class="dlb" data-i="${i}" style="text-align:left">${esc(p.name)} <span style="opacity:.5">· ${p.songs.length}</span></button>`).join('') || '<span class="sub">No playlists yet.</span>'}</div>
    <input class="inp" id="pn" placeholder="New playlist name…"><button class="wbtn pri" id="pg">+ Create &amp; add</button>`, m => {
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const p = S.pls[+b.dataset.i];
      if (p.songs.some(x => x.id === s.id)) return toast('Already there');
      p.songs.push(s); save(); closeM(); toast('Added to ' + p.name); });
    $('#pg').onclick = () => { const n = $('#pn').value.trim(); if (!n) return toast('Enter a name');
      S.pls.push({ id: Date.now(), name: n, songs: [s] }); save(); closeM(); toast('Created "' + n + '"'); };
  });
}

/* ============ UI BUILDERS ============ */
function card(x, cb, showY) {
  const c = el('div', 'card', `<div class="thumb"><img loading="lazy" decoding="async" src="${x.img}" alt="">
    ${showY && x.y ? `<span class="yb">${esc(x.y)}</span>` : ''}
    <div class="fab"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
    <h4 class="clip2">${esc(x.t)}</h4><p class="clip">${esc(x.s || x.a || '')}</p>`);
  c.onclick = cb; return c;
}
const sGrid = (a, rail, y) => { const g = el('div', rail ? 'rail scroll' : 'grid'); a.forEach((s, i) => g.appendChild(card(s, () => play(a, i), y))); return g; };
const cGrid = (a, rail) => { const g = el('div', rail ? 'rail scroll' : 'grid'); a.forEach(x => g.appendChild(card(x, () => x.k === 'artist' ? openArtist(x) : openColl(x)))); return g; };

function rows(list, onDel) {
  const w = el('div', 'rows');
  list.forEach((s, i) => {
    const r = el('div', 'row'); r.dataset.id = s.id; r.dataset.n = i + 1;
    r.innerHTML = `<div class="rn">${i + 1}</div><img class="rart" loading="lazy" decoding="async" src="${s.img}" alt="">
      <div style="min-width:0"><div class="rt clip">${esc(s.t)}</div>
      <div class="rs clip">${esc(s.a)}${s.y ? ' · ' + esc(s.y) : ''}${s.pl ? ' · ' + nf(s.pl) : ''}</div></div>
      <div class="ract">
        <button class="mn ${isL(s.id) ? 'liked' : ''}" data-a="like"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z"/></svg></button>
        <button class="mn" data-a="dl"><svg viewBox="0 0 24 24"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/></svg></button>
        <button class="mn" data-a="more"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg></button>
        <span class="dur">${fmt(s.d)}</span></div>`;
    r.onclick = e => { const b = e.target.closest('[data-a]');
      if (b) { e.stopPropagation(); const a = b.dataset.a;
        if (a === 'like') like(s); else if (a === 'dl') dlSheet(s); else menu(e, s, onDel && (() => onDel(i))); return; }
      play(list, i); };
    r.oncontextmenu = e => { e.preventDefault(); menu(e, s, onDel && (() => onDel(i))); };
    w.appendChild(r);
  });
  setTimeout(markRows, 0); return w;
}
function menu(e, s, del) {
  const c = $('#ctx');
  c.innerHTML = [['p', '▶ Play now'], ['n', '⏭ Play next'], ['q', '➕ Add to queue'],
  ['l', isL(s.id) ? '💔 Unlike' : '❤ Like'], ['f', '📁 Add to playlist'], ['d', '⬇ Download'],
  ['r', '📻 Start radio'], ['a', '🎤 More by artist'], ['b', '💿 Open album'], ['s', '🔗 Share'],
  ...(del ? [['x', '🗑 Remove']] : [])].map(([k, t]) => `<button data-k="${k}">${t}</button>`).join('');
  c.classList.add('open');
  const w = 200, h = c.offsetHeight || 340;
  c.style.left = Math.max(8, Math.min(e.clientX, innerWidth - w - 10)) + 'px';
  c.style.top = Math.max(8, Math.min(e.clientY, innerHeight - h - 10)) + 'px';
  c.querySelectorAll('button').forEach(b => b.onclick = () => { c.classList.remove('open'); const k = b.dataset.k;
    if (k === 'p') play([s], 0);
    if (k === 'n') { S.queue.splice(S.idx + 1, 0, s); counts(); toast('⏭ Up next'); }
    if (k === 'q') { S.queue.push(s); counts(); toast('➕ Queued'); }
    if (k === 'l') like(s);
    if (k === 'f') toPl(s);
    if (k === 'd') dlSheet(s);
    if (k === 'r') radio(s);
    if (k === 'a') openArtist({ t: s.a.split(',')[0].trim() });
    if (k === 'b') s.alId ? openColl({ id: s.alId, t: s.al, k: 'album' }) : toast('No album info');
    if (k === 's') { const tx = `${s.t} — ${s.a}`; if (navigator.share) navigator.share({ title: tx, text: 'Listening on Sonora' }).catch(() => { });
      else { navigator.clipboard?.writeText(tx); toast('Copied'); } }
    if (k === 'x') del();
  });
}
document.addEventListener('click', e => { if (!e.target.closest('#ctx')) $('#ctx').classList.remove('open'); });

async function radio(s) {
  toast('📻 Building radio…');
  try { let d = await api('/api/similar?id=' + s.id); let l = d.songs || [];
    if (l.length < 5) { d = await api('/api/search?q=' + encodeURIComponent(s.a) + '&n=30'); l = d.songs || []; }
    play([s, ...l.filter(x => x.id !== s.id)], 0); counts();
  } catch (e) { play([s], 0); }
}
const sec = (t, b) => el('h2', 'sec', `${esc(t)}${b ? `<span class="pill">${esc(b)}</span>` : ''}`);
const skel = n => { const g = el('div', 'grid'); for (let i = 0; i < n; i++) g.appendChild(el('div', 'skel skc')); return g; };
const empty = (i, a, b) => el('div', 'empty', `<div class="bg">${i}</div><h3>${esc(a)}</h3><p style="margin-top:6px;font-size:13px">${esc(b)}</p>`);
function errBox(retry) { const e = el('div', 'err', `<span>⚠️</span><span>Couldn't load. Check your connection.</span><button>Retry</button>`);
  e.querySelector('button').onclick = retry; return e; }
function bar(list) {
  const b = el('div', 'chips');
  const p = el('button', 'chip on', '▶ Play all'); p.onclick = () => play(list, 0);
  const s = el('button', 'chip', '🔀 Shuffle'); s.onclick = () => { S.shuffle = true; $('#shuf').classList.add('on'); play([...list].sort(() => Math.random() - .5), 0); };
  const r = el('button', 'chip', '📻 Radio'); r.onclick = () => list[0] && radio(list[0]);
  const q = el('button', 'chip', '➕ Queue all'); q.onclick = () => { S.queue.push(...list); counts(); toast(list.length + ' queued'); };
  b.append(p, s, r, q); return b;
}

/* ============ VIEWS ============ */
const LANGS = ['hindi', 'english', 'punjabi', 'bhojpuri', 'tamil', 'telugu', 'haryanvi', 'marathi', 'bengali', 'kannada', 'malayalam', 'gujarati', 'urdu', 'rajasthani'];
const MOODS = [['Party', 'party dance hits', '#ff512f,#dd2476'], ['Romantic', 'romantic love songs', '#f857a6,#ff5858'],
['Sad', 'sad emotional breakup', '#4b6cb7,#182848'], ['Workout', 'gym workout motivation', '#f7971e,#ffd200'],
['Chill', 'chill relaxing songs', '#00b09b,#96c93d'], ['Lo-Fi', 'lofi chill beats', '#654ea3,#eaafc8'],
['Devotional', 'bhajan devotional aarti', '#f2994a,#f2c94c'], ['Travel', 'travel road trip', '#11998e,#38ef7d'],
['Sleep', 'sleep soothing calm', '#141e30,#243b55'], ['Focus', 'instrumental study focus', '#3a7bd5,#3a6073'],
['Ghazal', 'ghazal jagjit singh', '#8e2de2,#4a00e0'], ['Sufi', 'sufi qawwali', '#f46b45,#eea849'],
['Bhojpuri', 'bhojpuri superhit', '#ee0979,#ff6a00'], ['Punjabi', 'punjabi hits', '#fc466b,#3f5efb'],
['Wedding', 'shaadi wedding songs', '#e96443,#904e95'], ['Kids', 'kids nursery rhymes hindi', '#56ccf2,#2f80ed']];
const ERAS = [['1950', '50s', 'Golden black & white'], ['1960', '60s', 'Rafi · Lata · Mukesh'], ['1970', '70s', 'R.D. Burman era'],
['1980', '80s', 'Disco & melody'], ['1990', '90s', 'Kumar Sanu · Alka'], ['2000', '2000s', 'Sonu · Shreya'], ['2010', '2010s', 'Arijit era']];

function nav(v, push = true) {
  if (push && S.view !== v) S.stack.push({ v: S.view, d: S.detail });
  S.view = v; S.detail = null; closeSide(); $('#main').scrollTop = 0; render();
}
function render() {
  $$('.nb').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  $$('.mobnav button').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
  counts();
  const v = $('#view'); v.innerHTML = '';
  const F = { home: vHome, trend: vTrend, search: vSearch, moods: vMoods, retro: vRetro, studio: vStudio,
    room: vRoom, pls: vPls, stats: vStats, settings: vSet,
    liked: () => lib(v, S.liked, '❤️ Liked Songs', 'Nothing liked yet', 'Tap the heart on any song'),
    queue: () => lib(v, S.queue, '▶ Queue', 'Queue is empty', 'Play something first', 1),
    recent: () => lib(v, S.recent, '🕘 History', 'No history yet', 'Your plays land here'),
    dls: () => lib(v, S.dls, '⬇ Downloads', 'No downloads', 'Use ⬇ on any track') };
  (F[S.view] || vHome)(v);
}
function lib(v, list, ti, e1, e2, isq) {
  v.appendChild(sec(ti, list.length ? list.length + ' tracks' : ''));
  if (!list.length) return v.appendChild(empty('🎵', e1, e2));
  v.appendChild(bar(list)); v.appendChild(el('div', '', '<div style="height:12px"></div>'));
  v.appendChild(rows(list, i => { list.splice(i, 1); if (isq && i < S.idx) S.idx--; save(); render(); }));
}
function langRow(cb) {
  const c = el('div', 'chiprow scroll');
  LANGS.forEach(l => { const b = el('button', 'chip' + (l === S.lang ? ' on' : ''), l[0].toUpperCase() + l.slice(1));
    b.onclick = () => { S.lang = l; SET('lang', l); cb(); }; c.appendChild(b); });
  return c;
}
async function vHome(v) {
  const h = new Date().getHours();
  const hero = el('div', 'hero', `<h1>Good ${h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'} 👋</h1>
    <p>Your sound, your way — studio-grade audio modes, offline saves and rooms to listen with friends.</p>`);
  hero.appendChild(langRow(render)); v.appendChild(hero);

  if (S.recent.length) { v.appendChild(sec('Jump back in')); v.appendChild(sGrid(S.recent.slice(0, 14), true)); }
  if (S.liked.length > 3) { v.appendChild(sec('From your likes')); v.appendChild(sGrid([...S.liked].sort(() => Math.random() - .5).slice(0, 14), true)); }

  const slots = {};
  [['trending', '🔥 Trending now', S.lang], ['charts', '📊 Top charts'], ['playlists', '🎧 Curated playlists'],
  ['albums', '💿 New releases'], ['radio', '📻 Stations']].forEach(([k, t, b]) => {
    v.appendChild(sec(t, b)); const d = el('div'); d.appendChild(skel(6)); v.appendChild(d); slots[k] = d; });
  try {
    const d = await api('/api/home?lang=' + S.lang);
    for (const k in slots) { const a = d[k] || []; slots[k].innerHTML = '';
      slots[k].appendChild(a.length ? (a[0].u ? sGrid(a, true) : cGrid(a, true)) : empty('—', 'Nothing here', 'Try another language')); }
  } catch (e) { for (const k in slots) { slots[k].innerHTML = ''; slots[k].appendChild(errBox(render)); break; }
    for (const k in slots) slots[k].innerHTML = slots[k].innerHTML; }
  v.appendChild(sec('🕰 Golden era'));
  const eg = el('div', 'mgrid');
  ERAS.forEach(([y, n, d], i) => { const m = el('div', 'mood', `${n}<small>${esc(d)}</small>`);
    m.style.background = `linear-gradient(135deg,hsl(${i * 45 + 15} 70% 45%),hsl(${i * 45 + 60} 70% 35%))`;
    m.onclick = () => openEra(y, n); eg.appendChild(m); });
  v.appendChild(eg);
}
async function vTrend(v) {
  v.appendChild(sec('🔥 Trending', S.lang)); v.appendChild(langRow(render));
  const b = el('div'); b.appendChild(skel(10)); v.appendChild(b);
  try {
    const [d, t] = await Promise.all([api('/api/home?lang=' + S.lang), api('/api/top').catch(() => ({ items: [] }))]);
    b.innerHTML = '';
    const add = (ti, a) => { if (!a?.length) return; b.appendChild(sec(ti)); b.appendChild(a[0].u ? sGrid(a) : cGrid(a)); };
    add('Trending', d.trending); add('Hot searches', t.items); add('Charts', d.charts);
    add('Playlists', d.playlists); add('New albums', d.albums); add('Stations', d.radio);
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(render)); }
}
async function vSearch(v) {
  const q = $('#q').value.trim();
  v.appendChild(sec('🔎 Search', q ? `"${q}"` : ''));
  if (!q) { v.appendChild(empty('🎧', 'What do you want to hear?', 'Search songs, artists, albums or playlists'));
    v.appendChild(sec('Try these')); const c = el('div', 'chips');
    ['Arijit Singh', 'Kishore Kumar', '90s hits', 'Lofi', 'Punjabi', 'Bhojpuri', 'Ghazal', 'Workout'].forEach(x => {
      const b = el('button', 'chip', x); b.onclick = () => { $('#q').value = x; doSearch(); }; c.appendChild(b); });
    v.appendChild(c); return; }
  const b = el('div'); b.appendChild(skel(8)); v.appendChild(b);
  try {
    const d = await api('/api/searchall?q=' + encodeURIComponent(q)); b.innerHTML = '';
    if (d.artists?.length) { b.appendChild(sec('Artists')); b.appendChild(cGrid(d.artists, true)); }
    if (d.songs?.length) { b.appendChild(sec('Songs', d.songs.length + '')); b.appendChild(bar(d.songs));
      b.appendChild(el('div', '', '<div style="height:10px"></div>')); b.appendChild(rows(d.songs)); }
    if (d.albums?.length) { b.appendChild(sec('Albums')); b.appendChild(cGrid(d.albums, true)); }
    if (d.playlists?.length) { b.appendChild(sec('Playlists')); b.appendChild(cGrid(d.playlists, true)); }
    if (!d.songs?.length && !d.albums?.length) b.appendChild(empty('🤷', 'No results', 'Try a different spelling'));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => vSearch(v))); }
}
const doSearch = () => { $('#sug').classList.remove('open'); S.detail = null; if (S.view !== 'search') nav('search'); else render(); };

function vMoods(v) {
  v.appendChild(el('div', 'hero', `<h1>🎭 Moods &amp; Genres</h1><p>Pick a feeling — we build the mix instantly.</p>`));
  v.appendChild(sec('Browse all', MOODS.length + ''));
  const g = el('div', 'mgrid');
  MOODS.forEach(([n, q, gr]) => { const [a, b2] = gr.split(',');
    const m = el('div', 'mood', `${esc(n)}<small>Tap to play</small>`);
    m.style.background = `linear-gradient(135deg,${a},${b2})`;
    m.onclick = () => openMood(n, q); g.appendChild(m); });
  v.appendChild(g);
}
function vRetro(v) {
  v.appendChild(el('div', 'hero', `<h1>🕰 Golden Era</h1>
    <p>Timeless classics decade by decade — from black-and-white melodies to the 2010s.</p>`));
  v.appendChild(sec('Pick a decade'));
  const g = el('div', 'mgrid');
  ERAS.forEach(([y, n, d], i) => { const m = el('div', 'mood', `${n}<small>${esc(d)}</small>`);
    m.style.background = `linear-gradient(135deg,hsl(${i * 45 + 15} 68% 44%),hsl(${i * 45 + 60} 68% 33%))`;
    m.onclick = () => openEra(y, n); g.appendChild(m); });
  v.appendChild(g);
  v.appendChild(sec('👑 Legendary voices'));
  const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  api('/api/legends').then(d => { b.innerHTML = ''; b.appendChild(cGrid(d.items || [], true)); })
    .catch(() => { b.innerHTML = ''; b.appendChild(errBox(render)); });
  v.appendChild(sec('Evergreen picks'));
  const c = el('div'); c.appendChild(skel(6)); v.appendChild(c);
  api('/api/mood?q=' + encodeURIComponent('old hindi evergreen classics')).then(d => { c.innerHTML = ''; c.appendChild(sGrid(d.songs || [], true, 1)); })
    .catch(() => c.innerHTML = '');
}
function vStudio(v) {
  v.appendChild(el('div', 'hero', `<h1>🎛 Sound Studio</h1>
    <p>16 engineered modes. Depth, space, warmth and speed all reshape in real time — no re-buffering.</p>`));
  v.appendChild(sec('Choose a sound', S.mode !== 'off' ? M[S.mode].n : 'normal'));
  const g = el('div', 'mgrid');
  for (const k in M) { const m = el('div', 'mood', `${M[k].i} ${esc(M[k].n)}<small>${esc(M[k].d)}</small>`);
    const hue = Object.keys(M).indexOf(k) * 23;
    m.style.background = S.mode === k ? 'var(--grad)' : `linear-gradient(135deg,hsl(${hue} 58% 38%),hsl(${hue + 40} 58% 26%))`;
    if (S.mode === k) m.style.color = '#08080d';
    m.onclick = () => { setMode(k); render(); }; g.appendChild(m); }
  v.appendChild(g);
  const b = el('div', 'chips'); const o = el('button', 'chip on', '🎚 Fine-tune controls');
  o.onclick = () => $('#fxPan').classList.add('open'); b.appendChild(o);
  v.appendChild(b);
  ['lofi chill beats', 'slowed reverb', '8d audio songs'].forEach((qq, i) => {
    v.appendChild(sec(['Lo-Fi picks', 'Slowed + reverb', 'Made for 8D'][i]));
    const d = el('div'); d.appendChild(skel(6)); v.appendChild(d);
    api('/api/mood?q=' + encodeURIComponent(qq)).then(r => { d.innerHTML = ''; d.appendChild(sGrid(r.songs || [], true)); }).catch(() => d.innerHTML = '');
  });
}
function vStats(v) {
  const st = S.stats, top = Object.entries(st.artists).sort((a, b) => b[1] - a[1]).slice(0, 8);
  v.appendChild(el('div', 'hero', `<h1>📊 Your Stats</h1><p>Everything stays on this device — nothing is uploaded.</p>`));
  v.appendChild(sec('Overview'));
  const g = el('div', 'mgrid');
  [['🎵', st.plays, 'tracks played'], ['⏱', Math.round(st.secs / 60), 'minutes listened'], ['❤️', S.liked.length, 'liked songs'],
  ['⬇', S.dls.length, 'downloads'], ['📁', S.pls.length, 'playlists'], ['🎤', Object.keys(st.artists).length, 'artists']]
    .forEach(([i, n, l], k) => { const m = el('div', 'mood', `${i} ${n}<small>${l}</small>`);
      m.style.background = `linear-gradient(135deg,hsl(${k * 55} 55% 40%),hsl(${k * 55 + 40} 55% 28%))`; g.appendChild(m); });
  v.appendChild(g);
  if (top.length) { v.appendChild(sec('Top artists'));
    const w = el('div', 'rows');
    top.forEach(([n, c], i) => { const r = el('div', 'row'); r.style.gridTemplateColumns = '28px 1fr auto';
      r.innerHTML = `<div class="rn">${i + 1}</div><div class="rt">${esc(n)}</div><div class="dur">${c} plays</div>`;
      r.onclick = () => openArtist({ t: n }); w.appendChild(r); });
    v.appendChild(w); }
  const b = el('div', 'chips'); const c = el('button', 'chip', '🗑 Reset stats');
  c.onclick = () => { S.stats = { secs: 0, plays: 0, artists: {}, days: {} }; save(); render(); toast('Stats reset'); };
  b.appendChild(c); v.appendChild(b);
}
function vPls(v) {
  v.appendChild(sec('📁 Playlists', S.pls.length + ''));
  const b = el('div', 'chips'); const n = el('button', 'chip on', '+ New playlist');
  n.onclick = () => modal(`<h3>New playlist</h3><input class="inp" id="pn" placeholder="Name…"><button class="wbtn pri" id="pg">Create</button>`,
    () => { $('#pg').onclick = () => { const nm = $('#pn').value.trim(); if (!nm) return toast('Enter a name');
      S.pls.push({ id: Date.now(), name: nm, songs: [] }); save(); closeM(); render(); }; });
  b.appendChild(n); v.appendChild(b);
  if (!S.pls.length) return v.appendChild(empty('📁', 'No playlists', 'Create one, then long-press any song → Add to playlist'));
  const g = el('div', 'grid'); g.style.gridTemplateColumns = 'repeat(auto-fill,minmax(200px,1fr))';
  S.pls.forEach((p, i) => { const c = el('div', 'plc', `<h4>${esc(p.name)}</h4><p>${p.songs.length} tracks</p>`);
    c.onclick = () => openPl(i); g.appendChild(c); });
  v.appendChild(g);
}
function openPl(i) {
  S.detail = 1; const p = S.pls[i], v = $('#view'); v.innerHTML = '';
  v.appendChild(sec('📁 ' + p.name, p.songs.length + ' tracks'));
  const b = el('div', 'chips');
  if (p.songs.length) { const a = el('button', 'chip on', '▶ Play all'); a.onclick = () => play(p.songs, 0); b.appendChild(a); }
  const d = el('button', 'chip', '🗑 Delete'); d.onclick = () => { if (!confirm('Delete "' + p.name + '"?')) return;
    S.pls.splice(i, 1); save(); nav('pls', false); };
  b.appendChild(d); v.appendChild(b); v.appendChild(el('div', '', '<div style="height:12px"></div>'));
  v.appendChild(p.songs.length ? rows(p.songs, j => { p.songs.splice(j, 1); save(); openPl(i); }) : empty('🎵', 'Empty', 'Add songs from the ⋮ menu'));
}
function vSet(v) {
  v.appendChild(el('div', 'hero', `<h1>⚙️ Settings</h1><p>Sonora · everything saved locally on this device.</p>`));
  v.appendChild(sec('Appearance'));
  const b = el('div', 'chips'); const t = el('button', 'chip on', '🎨 Themes & layout');
  t.onclick = () => $('#thPan').classList.add('open'); b.appendChild(t);
  const f = el('button', 'chip', '🎛 Sound studio'); f.onclick = () => $('#fxPan').classList.add('open'); b.appendChild(f);
  const q = el('button', 'chip', '◆ Quality'); q.onclick = () => $('#qPan').classList.add('open'); b.appendChild(q);
  v.appendChild(b);
  v.appendChild(sec('Your name in rooms'));
  const i = el('input', 'inp'); i.value = S.me; i.maxLength = 18;
  i.oninput = () => { S.me = i.value.trim() || 'guest'; SET('me', S.me); };
  i.style.maxWidth = '320px'; v.appendChild(i);
  v.appendChild(sec('Data'));
  const d = el('div', 'chips');
  [['📤 Export library', () => { const blob = new Blob([JSON.stringify({ liked: S.liked, pls: S.pls, recent: S.recent }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sonora-library.json'; a.click(); toast('Exported'); }],
  ['📥 Import', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async () => { try { const j = JSON.parse(await inp.files[0].text());
      if (j.liked) S.liked = j.liked; if (j.pls) S.pls = j.pls; if (j.recent) S.recent = j.recent;
      save(); render(); toast('Imported'); } catch (e) { toast('Bad file'); } }; inp.click(); }],
  ['🧹 Clear history', () => { S.recent = []; save(); toast('History cleared'); }],
  ['💣 Reset everything', () => { if (confirm('Erase all local data?')) { localStorage.clear(); location.reload(); } }]]
    .forEach(([n, fn]) => { const x = el('button', 'chip', n); x.onclick = fn; d.appendChild(x); });
  v.appendChild(d);
  v.appendChild(sec('Shortcuts'));
  const k = el('div', 'badges');
  ['Space play', '← → seek', '↑ ↓ volume', 'N next', 'P prev', 'S shuffle', 'R repeat', 'L like', 'D download',
    'F fullscreen', 'Y lyrics', 'M mute', '/ search', '1-9 modes', 'Esc close'].forEach(x => k.appendChild(el('span', 'bdg', x)));
  v.appendChild(k);
}

/* ---- detail pages ---- */
async function openMood(n, q) {
  S.detail = 1; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  v.appendChild(sec('🎭 ' + n, 'mix')); const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  try { const d = await api('/api/mood?q=' + encodeURIComponent(q)); b.innerHTML = '';
    if (!d.songs?.length) return b.appendChild(empty('—', 'Nothing found', ''));
    b.appendChild(bar(d.songs)); b.appendChild(el('div', '', '<div style="height:12px"></div>')); b.appendChild(rows(d.songs));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => openMood(n, q))); }
}
async function openEra(y, n) {
  S.detail = 1; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  v.appendChild(sec('🕰 ' + n, S.lang)); v.appendChild(langRow(() => openEra(y, n)));
  const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  try { const d = await api('/api/era?e=' + y + '&lang=' + S.lang, 1); b.innerHTML = '';
    if (!d.songs?.length) return b.appendChild(empty('—', 'Nothing found', 'Try another language'));
    b.appendChild(bar(d.songs)); b.appendChild(el('div', '', '<div style="height:8px"></div>'));
    b.appendChild(sGrid(d.songs.slice(0, 12), true, 1));
    b.appendChild(sec('All ' + n + ' tracks', d.songs.length + '')); b.appendChild(rows(d.songs));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => openEra(y, n))); }
}
async function openColl(x) {
  S.detail = 1; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  v.appendChild(sec(x.t, x.k)); const b = el('div'); b.appendChild(skel(4)); v.appendChild(b);
  try { const ep = /playlist|mix|radio/.test(x.k) ? '/api/playlist?id=' : '/api/album?id=';
    const d = await api(ep + x.id); b.innerHTML = '';
    if (!d.songs?.length) return b.appendChild(empty('—', 'No tracks', ''));
    b.appendChild(bar(d.songs)); b.appendChild(el('div', '', '<div style="height:12px"></div>')); b.appendChild(rows(d.songs));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => openColl(x))); }
}
async function openArtist(a) {
  S.detail = 1; const v = $('#view'); v.innerHTML = ''; $('#main').scrollTop = 0;
  v.appendChild(sec('🎤 ' + a.t, 'artist')); const b = el('div'); b.appendChild(skel(6)); v.appendChild(b);
  try { const d = await api('/api/search?q=' + encodeURIComponent(a.t) + '&n=45'); b.innerHTML = '';
    if (!d.songs?.length) return b.appendChild(empty('—', 'No songs', ''));
    b.appendChild(bar(d.songs)); b.appendChild(el('div', '', '<div style="height:8px"></div>'));
    b.appendChild(sGrid(d.songs.slice(0, 12), true));
    b.appendChild(sec('All tracks')); b.appendChild(rows(d.songs));
  } catch (e) { b.innerHTML = ''; b.appendChild(errBox(() => openArtist(a))); }
}

/* ============ ROOMS ============ */
function vRoom(v) {
  v.appendChild(el('div', 'hero', `<h1>👥 Listen Together</h1>
    <p>Create a room, share the 5-letter code, and everyone hears the same song at the same second — with live chat.</p>`));
  if (!S.room) {
    v.appendChild(sec('Start or join'));
    const w = el('div'); w.style.maxWidth = '420px';
    w.innerHTML = `<button class="wbtn pri" id="rCreate">✨ Create a room</button>
      <input class="inp" id="rCode" placeholder="Enter room code…" maxlength="5" style="text-transform:uppercase">
      <button class="wbtn" id="rJoin">→ Join room</button>`;
    v.appendChild(w);
    $('#rCreate').onclick = () => joinRoom(Math.random().toString(36).slice(2, 7).toUpperCase(), true);
    $('#rJoin').onclick = () => { const c = $('#rCode').value.trim().toUpperCase(); if (c.length < 3) return toast('Enter a code'); joinRoom(c, false); };
    return;
  }
  v.appendChild(sec('Room ' + S.room, S.roomHost ? 'host' : 'guest'));
  const b = el('div', 'chips');
  const cp = el('button', 'chip on', '🔗 Copy code'); cp.onclick = () => { navigator.clipboard?.writeText(S.room); toast('Code copied: ' + S.room); };
  const sy = el('button', 'chip', '🔄 Re-sync'); sy.onclick = syncRoom;
  const pu = el('button', 'chip', '📤 Push my queue'); pu.onclick = () => { if (!S.queue.length) return toast('Queue empty');
    rAct('queue', encodeURIComponent(JSON.stringify(S.queue.slice(0, 40)))); toast('Queue shared'); };
  const lv = el('button', 'chip', '🚪 Leave'); lv.onclick = leaveRoom;
  b.append(cp, sy, pu, lv); v.appendChild(b);
  const info = el('div', 'badges', `<span class="bdg" id="rUsers">…</span><span class="bdg">You: ${esc(S.me)}</span>`);
  v.appendChild(info);
  v.appendChild(sec('Live chat'));
  const box = el('div'); box.style.cssText = 'max-width:560px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px';
  box.innerHTML = `<div class="chat scroll" id="rChat"></div>
    <div style="display:flex;gap:8px"><input class="inp" id="rMsg" placeholder="Say something…" style="margin:0" maxlength="180">
    <button class="wbtn pri" id="rSend" style="width:auto;margin:0;padding:11px 18px">Send</button></div>`;
  v.appendChild(box);
  const send = () => { const m = $('#rMsg').value.trim(); if (!m) return; rAct('chat', encodeURIComponent(m)); $('#rMsg').value = ''; };
  $('#rSend').onclick = send; $('#rMsg').onkeydown = e => { if (e.key === 'Enter') send(); };
  v.appendChild(sec('Room queue'));
  const rq = el('div', '', ''); rq.id = 'rQueue'; v.appendChild(rq);
  paintRoom(S.lastSnap);
}
const rAct = (a, v) => S.room && fetch(`/api/room/act?c=${S.room}&a=${a}&u=${encodeURIComponent(S.me)}${v !== undefined ? '&v=' + v : ''}`).catch(() => { });
function joinRoom(code, host) {
  S.room = code; S.roomHost = host;
  if (S.es) S.es.close();
  S.es = new EventSource('/api/room/sub?c=' + code);
  S.es.addEventListener('state', e => { const d = JSON.parse(e.data); S.lastSnap = d; paintRoom(d); if (!S.roomHost) followRoom(d); });
  S.es.onerror = () => { };
  rAct('join');
  if (host && S.queue.length) rAct('queue', encodeURIComponent(JSON.stringify(S.queue.slice(0, 40))));
  toast(host ? '✨ Room created: ' + code : '→ Joined ' + code);
  render();
}
function leaveRoom() { if (S.es) S.es.close(); S.es = null; S.room = null; S.roomHost = false; toast('Left the room'); render(); }
function syncRoom() { if (S.lastSnap) followRoom(S.lastSnap, true); }
function followRoom(d, force) {
  if (!d.queue?.length) return;
  const target = d.queue[d.idx]; if (!target) return;
  const cur = S.queue[S.idx];
  if (force || !cur || cur.id !== target.id) { S.queue = d.queue; S.idx = d.idx; play(); setTimeout(() => { au.currentTime = d.pos; }, 700); return; }
  if (Math.abs(au.currentTime - d.pos) > 2.5) au.currentTime = d.pos;
  if (d.playing && au.paused) au.play().catch(() => { });
  if (!d.playing && !au.paused) au.pause();
}
function paintRoom(d) {
  if (!d || S.view !== 'room') return;
  const u = $('#rUsers'); if (u) u.textContent = (d.users?.length || 1) + ' listening';
  const c = $('#rChat');
  if (c) { c.innerHTML = (d.chat || []).map(m => `<div class="msg"><b>${esc(m.u)}</b> ${esc(m.m)}</div>`).join('') || '<div class="sub">No messages yet.</div>'; c.scrollTop = c.scrollHeight; }
  const q = $('#rQueue');
  if (q) { q.innerHTML = ''; q.appendChild(d.queue?.length ? rows(d.queue) : empty('🎵', 'Room queue empty', 'Host can push a queue')); }
}

/* ============ LYRICS / FULLSCREEN / VIZ ============ */
async function lyrics(s) {
  const t = $('#fsLyr'); if (!s) return t.textContent = 'Nothing playing.';
  t.textContent = 'Loading lyrics…';
  try { const d = await api('/api/lyrics?id=' + s.id); t.textContent = d.lyrics || 'No lyrics found for this track.'; }
  catch { t.textContent = 'Lyrics unavailable.'; }
}
function openFS() {
  $('#fs').classList.add('open');
  const c = $('#fsChips'); c.innerHTML = '';
  ['off', 'lofi', 'deep', 'slowrev', 'night', 'eight', 'bass', 'hall'].forEach(k => {
    const b = el('button', 'chip' + (S.mode === k ? ' on' : ''), M[k].i + ' ' + M[k].n);
    b.onclick = () => { setMode(k); openFS(); }; c.appendChild(b); });
  const s = S.queue[S.idx]; if (s) lyrics(s);
  $('#vinyl').classList.toggle('go', !au.paused);
  viz();
}
let vR; function viz() {
  const cv = $('#viz'); if (!cv || !anN) return;
  const g = cv.getContext('2d'), n = anN.frequencyBinCount, a = new Uint8Array(n);
  cancelAnimationFrame(vR);
  const lp = () => { if (!$('#fs').classList.contains('open')) return;
    anN.getByteFrequencyData(a); g.clearRect(0, 0, cv.width, cv.height);
    const bars = 60, st = Math.floor(n / bars), w = cv.width / bars;
    for (let i = 0; i < bars; i++) { const v = a[i * st] / 255, h = Math.max(3, v * cv.height);
      const gr = g.createLinearGradient(0, cv.height, 0, cv.height - h);
      gr.addColorStop(0, getComputedStyle(document.body).getPropertyValue('--a1').trim() || '#7c5cff');
      gr.addColorStop(1, getComputedStyle(document.body).getPropertyValue('--a2').trim() || '#20e3b2');
      g.fillStyle = gr; g.fillRect(i * w + 1, cv.height - h, w - 2, h); }
    vR = requestAnimationFrame(lp); }; lp();
}

/* ============ THEMES / UI ============ */
const THEMES = [['midnight', 'Midnight', '#08080d,#7c5cff'], ['aurora', 'Aurora', '#04121a,#00d4ff'],
['sunset', 'Sunset', '#160a12,#ff6b6b'], ['forest', 'Forest', '#0a1410,#4ade80'],
['mono', 'Mono', '#0a0a0a,#ffffff'], ['daylight', 'Daylight', '#f5f6fb,#6d4aff']];
const UIS = [['default', 'Default', 'Balanced grid'], ['compact', 'Compact', 'More on screen'],
['cozy', 'Cozy', 'Big & relaxed'], ['list', 'List', 'Dense text rows']];
function setTheme(t) { document.body.dataset.t = t; S.theme = t; SET('theme', t);
  const c = { midnight: '#08080d', aurora: '#04121a', sunset: '#160a12', forest: '#0a1410', mono: '#0a0a0a', daylight: '#f5f6fb' }[t];
  document.querySelector('meta[name=theme-color]').content = c; paintTheme(); }
function setUI(u) { document.body.dataset.ui = u; S.ui = u; SET('ui', u); paintTheme(); }
function paintTheme() {
  const g = $('#themes'); g.innerHTML = '';
  THEMES.forEach(([k, n, cs]) => { const [a, b] = cs.split(',');
    const s = el('div', 'swatch' + (S.theme === k ? ' on' : ''), `<b>${n}</b>`);
    s.style.background = `linear-gradient(135deg,${a} 45%,${b})`; s.onclick = () => setTheme(k); g.appendChild(s); });
  const u = $('#uis'); u.innerHTML = '';
  UIS.forEach(([k, n, d]) => { const b = el('button', 'opt' + (S.ui === k ? ' on' : ''), `${n}<span>${d}</span>`);
    b.onclick = () => setUI(k); u.appendChild(b); });
}
function paintQ() {
  const g = $('#qOpts'); g.innerHTML = '';
  [['320', 'Extreme', '320 kbps · best fidelity'], ['160', 'High', '160 kbps · balanced'],
  ['96', 'Normal', '96 kbps · light data'], ['48', 'Saver', '48 kbps · very light'], ['12', 'Minimal', '12 kbps · emergency']]
    .forEach(([v, n, d]) => { const b = el('button', 'opt' + (S.q === v ? ' on' : ''), `${n}<span>${d}</span>`);
      b.style.width = '100%'; b.style.marginBottom = '7px';
      b.onclick = () => { setQ(v); paintQ(); }; g.appendChild(b); });
}
function setQ(v) {
  S.q = v; SET('q', v); $('#qLbl').textContent = v;
  const s = S.queue[S.idx];
  if (s) { const t = au.currentTime, p = !au.paused; au.src = surl(s); au.currentTime = t; if (p) au.play().catch(() => { }); }
  toast('Quality: ' + v + ' kbps');
}

/* ============ EVENTS ============ */
const closeSide = () => { $('#sb').classList.remove('open'); $('#scrim').classList.remove('on'); };
$$('.nb').forEach(b => b.onclick = () => nav(b.dataset.v));
$$('.mobnav button').forEach(b => b.onclick = () => { haptic(); if (b.dataset.v === 'search') { nav('search'); $('#q').focus(); } else nav(b.dataset.v); });
$('#menu').onclick = () => { $('#sb').classList.toggle('open'); $('#scrim').classList.toggle('on'); };
$('#scrim').onclick = closeSide;
$('#back').onclick = () => { if ($('#fs').classList.contains('open')) return $('#fs').classList.remove('open');
  const p = S.stack.pop(); if (p) { S.view = p.v; S.detail = null; render(); } else nav('home', false); };

/* search */
let sT, sI = -1;
$('#q').addEventListener('input', e => {
  const q = e.target.value.trim(); clearTimeout(sT);
  if (q.length < 2) return $('#sug').classList.remove('open');
  sT = setTimeout(async () => {
    try { const d = await api('/api/suggest?q=' + encodeURIComponent(q), 0);
      const s = $('#sug'); s.innerHTML = ''; sI = -1;
      if (!d.items?.length) return s.classList.remove('open');
      d.items.forEach(it => { const r = el('div', 'si', `<img loading="lazy" src="${it.img}"><div style="min-width:0">
          <div class="a clip">${esc(it.t)}</div><div class="b clip">${esc(it.s)}</div></div><span class="c">${esc(it.k)}</span>`);
        r.onclick = () => { s.classList.remove('open');
          if (it.k === 'song') { $('#q').value = it.t; doSearch(); }
          else if (it.k === 'artist') { S.stack.push({ v: S.view }); openArtist({ t: it.t }); }
          else { S.stack.push({ v: S.view }); openColl({ id: it.id, t: it.t, k: it.k }); } };
        s.appendChild(r); });
      s.classList.add('open');
    } catch (e) { }
  }, 250);
});
$('#q').addEventListener('keydown', e => {
  const it = $$('#sug .si');
  if (e.key === 'ArrowDown' && it.length) { e.preventDefault(); sI = (sI + 1) % it.length; it.forEach((x, i) => x.classList.toggle('sel', i === sI)); it[sI].scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'ArrowUp' && it.length) { e.preventDefault(); sI = (sI - 1 + it.length) % it.length; it.forEach((x, i) => x.classList.toggle('sel', i === sI)); }
  else if (e.key === 'Enter') { if (sI >= 0 && it[sI]) it[sI].click(); else { clearTimeout(sT); doSearch(); $('#q').blur(); } }
  else if (e.key === 'Escape') $('#sug').classList.remove('open');
});
document.addEventListener('click', e => { if (!e.target.closest('.sw')) $('#sug').classList.remove('open'); });

/* transport */
$('#play').onclick = toggle; $('#mPlay').onclick = () => { haptic(); toggle(); };
$('#next').onclick = () => skip(false); $('#prev').onclick = back;
$('#shuf').onclick = e => { S.shuffle = !S.shuffle; e.currentTarget.classList.toggle('on', S.shuffle); toast('Shuffle ' + (S.shuffle ? 'on' : 'off')); };
$('#rep').onclick = e => { S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off';
  e.currentTarget.classList.toggle('on', S.repeat !== 'off'); toast('Repeat: ' + S.repeat); };
$('#likeB').onclick = () => { const s = S.queue[S.idx]; s && like(s); };
$('#mLike').onclick = () => { const s = S.queue[S.idx]; s && like(s); };
$('#dlB').onclick = () => { const s = S.queue[S.idx]; s ? dlSheet(s) : toast('Nothing playing'); };
$('#autoB').onclick = e => { S.autoplay = !S.autoplay; SET('auto', S.autoplay); e.currentTarget.classList.toggle('on', S.autoplay); toast('Autoplay ' + (S.autoplay ? 'on' : 'off')); };
$('#autoB').classList.toggle('on', S.autoplay);
$('#lyrB').onclick = openFS; $('#fsB').onclick = openFS;
$('#pMeta').onclick = openFS; $('#pImg').onclick = openFS;
$('#mImg').onclick = openFS; $('#mMeta').onclick = openFS;
$('#fsX').onclick = () => $('#fs').classList.remove('open');
$('#mdl').onclick = e => { if (e.target.id === 'mdl') closeM(); };
$('#vol').oninput = e => { au.volume = e.target.value / 100; au.muted = false; };
$('#mute').onclick = () => { au.muted = !au.muted; toast(au.muted ? 'Muted' : 'Unmuted'); };

/* seek (mouse + touch) */
const sk = $('#sk');
let drag = false;
const seekAt = e => { const r = sk.getBoundingClientRect(); const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  return Math.max(0, Math.min(1, x / r.width)); };
const startDrag = e => { if (!au.duration) return; drag = true; sk.classList.add('drag'); moveDrag(e); };
const moveDrag = e => { if (!drag) return; const p = seekAt(e); $('#fil').style.width = p * 100 + '%'; $('#hd').style.left = p * 100 + '%'; $('#tc').textContent = fmt(p * au.duration); };
const endDrag = e => { if (!drag) return; drag = false; sk.classList.remove('drag'); au.currentTime = seekAt(e.changedTouches ? { clientX: e.changedTouches[0].clientX } : e) * au.duration;
  if (S.room && S.roomHost) rAct('seek', au.currentTime); };
sk.addEventListener('mousedown', startDrag); addEventListener('mousemove', moveDrag); addEventListener('mouseup', endDrag);
sk.addEventListener('touchstart', startDrag, { passive: true }); sk.addEventListener('touchmove', moveDrag, { passive: true }); sk.addEventListener('touchend', endDrag);

let lastT = 0;
au.ontimeupdate = () => {
  if (!drag && au.duration) { const p = au.currentTime / au.duration;
    $('#fil').style.width = p * 100 + '%'; $('#hd').style.left = p * 100 + '%'; $('#mBar').style.width = p * 100 + '%'; }
  $('#tc').textContent = fmt(au.currentTime); $('#td').textContent = fmt(au.duration);
  const n = Date.now(); if (n - lastT > 5000 && !au.paused) { S.stats.secs += 5; lastT = n; save(); }
};
au.onprogress = () => { try { if (au.buffered.length && au.duration) $('#buf').style.width = (au.buffered.end(au.buffered.length - 1) / au.duration * 100) + '%'; } catch (e) { } };
const ico = () => { const h = au.paused ? '<path d="M8 5v14l11-7z"/>' : '<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>';
  $('#pIco').innerHTML = h; $('#mIco').innerHTML = h; $('#vinyl').classList.toggle('go', !au.paused); };
au.onplay = () => { ico(); markRows(); };
au.onpause = () => { ico(); markRows(); };
au.onended = () => { if (S.tmrEnd === -1) { S.tmrEnd = 0; return toast('😴 Sleep timer — stopped'); } skip(true); };
au.onerror = () => { if (!au.src) return; curErr++;
  if (curErr > 3) { toast('Playback trouble — paused'); au.pause(); curErr = 0; return; }
  if (S.autoQ && S.q !== '96') { toast('Switching to a lighter quality…'); setQ('96'); return; }
  toast('Stream error — skipping'); setTimeout(() => skip(true), 700); };
au.onwaiting = () => { if (S.autoQ && S.q === '320') { /* soft hint only */ } };

/* panels */
const pans = ['#fxPan', '#thPan', '#qPan', '#tmPan'];
const togglePan = id => { pans.forEach(p => p !== id && $(p).classList.remove('open')); $(id).classList.toggle('open'); };
$('#fxBtn').onclick = () => togglePan('#fxPan');
$('#thBtn').onclick = () => togglePan('#thPan');
$('#qBtn').onclick = () => togglePan('#qPan');
$('#tmB').onclick = () => togglePan('#tmPan');
$('#fxX').onclick = () => $('#fxPan').classList.remove('open');
$('#thX').onclick = () => $('#thPan').classList.remove('open');
$('#qX').onclick = () => $('#qPan').classList.remove('open');
$('#tmX').onclick = () => $('#tmPan').classList.remove('open');
$('#swRain').onclick = e => { S.rain = !S.rain; e.currentTarget.classList.toggle('on', S.rain); wake(); applyFX(); };
$('#swKar').onclick = e => { S.kar = !S.kar; e.currentTarget.classList.toggle('on', S.kar); applyFX(); toast('Vocal reducer ' + (S.kar ? 'on' : 'off')); };
$('#swCmp').onclick = e => { S.cmp = !S.cmp; e.currentTarget.classList.toggle('on', S.cmp); applyFX(); };
$('#swFade').onclick = e => { S.fade = !S.fade; e.currentTarget.classList.toggle('on', S.fade); };
$('#swAuto').onclick = e => { S.autoQ = !S.autoQ; SET('autoQ', S.autoQ); e.currentTarget.classList.toggle('on', S.autoQ); };
$('#fxReset').onclick = () => setMode('off');
KN.forEach(([k, l, key, f]) => { $('#' + k).oninput = e => { FX[key] = +e.target.value; $('#' + l).textContent = f(e.target.value); wake(); applyFX(); }; });

/* sleep timer */
$$('#tmBtns .opt').forEach(b => b.onclick = () => {
  const m = +b.dataset.m; clearInterval(S.tmr);
  $$('#tmBtns .opt').forEach(x => x.classList.remove('on')); b.classList.add('on');
  if (!m) { S.tmrEnd = -1; $('#tmState').textContent = 'Stops when this track ends.'; return toast('😴 Stops after this track'); }
  S.tmrEnd = Date.now() + m * 6e4;
  S.tmr = setInterval(() => { const l = S.tmrEnd - Date.now();
    if (l <= 0) { clearInterval(S.tmr); fade(0, 5000); setTimeout(() => { au.pause(); au.volume = $('#vol').value / 100; }, 5200);
      $('#tmState').textContent = 'No timer running.'; return toast('😴 Sleep timer done'); }
    $('#tmState').textContent = `Fading out in ${fmt(l / 1000)}.`; }, 1000);
  toast('😴 Sleep timer: ' + m + ' min');
});
$('#tmCancel').onclick = () => { clearInterval(S.tmr); S.tmrEnd = 0; $$('#tmBtns .opt').forEach(x => x.classList.remove('on'));
  $('#tmState').textContent = 'No timer running.'; toast('Timer cancelled'); };

/* keyboard */
addEventListener('keydown', e => {
  const ty = /input|textarea|select/i.test(e.target.tagName);
  if (e.key === '/' && !ty) { e.preventDefault(); return $('#q').focus(); }
  if (e.key === 'Escape') { $('#fs').classList.remove('open'); closeM(); pans.forEach(p => $(p).classList.remove('open')); closeSide(); }
  if (ty) return;
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.key === 'ArrowRight') au.currentTime += 5;
  if (e.key === 'ArrowLeft') au.currentTime -= 5;
  if (e.key === 'ArrowUp') { e.preventDefault(); const v = Math.min(100, +$('#vol').value + 5); $('#vol').value = v; au.volume = v / 100; }
  if (e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(0, +$('#vol').value - 5); $('#vol').value = v; au.volume = v / 100; }
  if (k === 'n') skip(false); if (k === 'p') back();
  if (k === 's') $('#shuf').click(); if (k === 'r') $('#rep').click();
  if (k === 'l') { const s = S.queue[S.idx]; s && like(s); }
  if (k === 'd') $('#dlB').click(); if (k === 'm') $('#mute').click();
  if (k === 'y' || k === 'f') openFS();
  if (k >= '1' && k <= '9') { const ks = Object.keys(M); ks[+k - 1] && setMode(ks[+k - 1]); }
});

/* swipe on mini player */
let tx = 0, ty2 = 0;
$('#miniBar').addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty2 = e.touches[0].clientY; }, { passive: true });
$('#miniBar').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty2;
  if (Math.abs(dy) > 60 && dy < 0) return openFS();
  if (Math.abs(dx) > 60) { haptic(); dx < 0 ? skip(false) : back(); }
});

if ('mediaSession' in navigator) try {
  navigator.mediaSession.setActionHandler('play', () => au.play());
  navigator.mediaSession.setActionHandler('pause', () => au.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => skip(false));
  navigator.mediaSession.setActionHandler('previoustrack', back);
  navigator.mediaSession.setActionHandler('seekto', d => { if (d.seekTime != null) au.currentTime = d.seekTime; });
} catch (e) { }

addEventListener('online', () => toast('🌐 Back online'));
addEventListener('offline', () => toast('📴 You are offline'));
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.room && S.lastSnap && !S.roomHost) followRoom(S.lastSnap); });

/* ============ INIT ============ */
setTheme(S.theme); setUI(S.ui);
paintModes(); paintTheme(); paintQ(); knobs();
$('#qLbl').textContent = S.q;
if (S.mode !== 'off') setMode(S.mode, true);
au.volume = .9; counts(); render();
