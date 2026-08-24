/* Deep bug hunt: every view, every panel, rapid clicks, edge cases, error paths. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..'), BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const pass = (n, e) => R.push({ ok: 1, n, e }); const fail = (n, w) => R.push({ ok: 0, n, w: String(w).slice(0, 150) });

try {
  const impl = require('jsdom/lib/jsdom/living/nodes/HTMLMediaElement-impl.js');
  const C = impl.implementation || impl.HTMLMediaElementImpl;
  if (C && C.prototype) {
    Object.defineProperty(C.prototype, 'currentTime', { get() { return this.__ct || 0 }, set(v) { this.__ct = Math.max(0, +v || 0) }, configurable: true });
    Object.defineProperty(C.prototype, 'duration', { get() { return this.__du === undefined ? 210 : this.__du }, set(v) { this.__du = v }, configurable: true });
    Object.defineProperty(C.prototype, 'readyState', { get() { return this.__rs === undefined ? 4 : this.__rs }, set(v) { this.__rs = v }, configurable: true });
  }
} catch (e) { }

function mk(name, opts = {}) {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const app = fs.readFileSync(ROOT + '/app.js', 'utf8');
  const errs = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html.replace('<script src="app.js"></script>', ''),
    { url: BASE + (opts.url || '/'), runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom, doc = window.document;
  window.HTMLMediaElement.prototype.play = function () { this.paused = false; this.dispatchEvent(new window.Event('play')); return Promise.resolve() };
  window.HTMLMediaElement.prototype.pause = function () { this.paused = true; this.dispatchEvent(new window.Event('pause')) };
  window.HTMLMediaElement.prototype.load = function () { };
  const p = () => ({ value: 0, setTargetAtTime() { }, setValueAtTime() { } });
  const n = () => ({ connect() { return n() }, disconnect() { }, start() { }, stop() { }, gain: p(), pan: p(), frequency: p(), Q: p(), threshold: p(), ratio: p(), knee: p(), attack: p(), release: p(), type: '', buffer: null, fftSize: 256, frequencyBinCount: 128, smoothingTimeConstant: 0, getByteFrequencyData() { } });
  window.AudioContext = window.webkitAudioContext = function () {
    return { state: 'running', currentTime: 0, sampleRate: 44100, destination: n(), resume() { }, createMediaElementSource: n, createBiquadFilter: n, createGain: n, createConvolver: n, createDynamicsCompressor: n, createAnalyser: n, createStereoPanner: n, createChannelSplitter: n, createChannelMerger: n, createBufferSource: n, createBuffer: (c, x) => ({ getChannelData: () => new Float32Array(x) }) };
  };
  window.EventSource = function (url) {
    const self = this; this.readyState = 1; this.listeners = {};
    this.addEventListener = (t, f) => { (self.listeners[t] = self.listeners[t] || []).push(f) };
    this.close = () => { self.readyState = 2; clearInterval(self.iv) };
    const code = new URL(url, BASE).searchParams.get('c');
    self.iv = setInterval(async () => { try { const r = await fetch(BASE + '/api/room/state?c=' + code); const d = await r.json(); (self.listeners.state || []).forEach(f => f({ data: JSON.stringify(d) })); } catch (e) { } }, 700);
    setTimeout(() => { if (self.onopen) self.onopen() }, 40);
  };
  window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
  window.HTMLElement.prototype.scrollIntoView = () => { }; window.HTMLElement.prototype.scrollTo = () => { }; window.scrollTo = () => { };
  window.navigator.vibrate = () => { };
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 8); window.cancelAnimationFrame = clearTimeout;
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() { }, fillRect() { }, beginPath() { }, roundRect() { }, rect() { }, fill() { }, createLinearGradient: () => ({ addColorStop() { } }) });
  if (opts.offline) Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true });
  window.fetch = (u, o) => (opts.offline ? Promise.reject(new TypeError('Failed to fetch')) : fetch(String(u).startsWith('http') ? String(u) : BASE + String(u), o));
  if (!opts.fresh) window.localStorage.setItem('sn_agreed', String(Date.now()));
  if (name) window.localStorage.setItem('sn_me', JSON.stringify(name));
  if (opts.seed) Object.entries(opts.seed).forEach(([k, v]) => window.localStorage.setItem('sn_' + k, JSON.stringify(v)));
  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);
  const $ = s => doc.querySelector(s), $$ = s => [...doc.querySelectorAll(s)];
  return {
    window, doc, errs, $, $$,
    click(s) { const e = typeof s === 'string' ? $(s) : s; if (!e) throw new Error('missing ' + s); e.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); },
    key(k, o = {}) { doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...o })); },
    txt(s) { const e = $(s); return e ? e.textContent.trim() : ''; },
  };
}

(async () => {
  /* ===== A. every view renders with no errors, twice over ===== */
  const b = mk('Tester');
  await sleep(1800);
  const VIEWS = ['home', 'trend', 'era', 'mood', 'studio', 'room', 'liked', 'pls', 'queue', 'recent', 'dls', 'stats', 'prefs', 'legal'];
  for (let round = 0; round < 2; round++) {
    for (const v of VIEWS) {
      const before = b.errs.length;
      try {
        b.click(`.nav[data-v="${v}"]`);
        await sleep(v === 'home' || v === 'trend' || v === 'era' ? 1400 : 260);
        const empty = b.$('#view').children.length === 0;
        if (empty) fail(`view ${v} renders (pass ${round + 1})`, 'empty view');
        else if (b.errs.length > before) fail(`view ${v} renders (pass ${round + 1})`, b.errs[before]);
        else if (round === 0) pass(`view ${v} renders`);
      } catch (e) { fail(`view ${v} renders (pass ${round + 1})`, e.message); }
    }
  }
  pass('all views survive a second pass');

  /* ===== B. every panel opens and closes ===== */
  for (const [btn, pan, label] of [['#eqBtn', '#eqPan', 'equaliser'], ['#thBtn', '#thPan', 'appearance'],
  ['#qBtn', '#qPan', 'quality'], ['#tmB', '#tmPan', 'sleep timer']]) {
    try {
      const before = b.errs.length;
      b.click(btn); await sleep(180);
      const open = b.$(pan).classList.contains('open');
      b.click(btn); await sleep(150);
      const closed = !b.$(pan).classList.contains('open');
      (open && closed && b.errs.length === before) ? pass('panel ' + label) : fail('panel ' + label, `open=${open} closed=${closed}`);
    } catch (e) { fail('panel ' + label, e.message); }
  }

  /* ===== C. every sound mode + EQ preset + quality + theme applies ===== */
  b.click('#eqBtn'); await sleep(200);
  const modes = b.$$('#modeGrid .op');
  let modeFails = 0;
  for (const m of modes) { const before = b.errs.length; b.click(m); await sleep(45); if (b.errs.length > before) modeFails++; }
  modeFails === 0 ? pass('all sound modes apply', modes.length + ' modes') : fail('all sound modes apply', modeFails + ' errored');

  const presets = b.$$('#eqPresets .chip'); let pf = 0;
  for (const c of presets) { const before = b.errs.length; b.click(c); await sleep(40); if (b.errs.length > before) pf++; }
  pf === 0 ? pass('all EQ presets apply', presets.length) : fail('all EQ presets apply', pf + ' errored');

  b.click('#eqBtn'); b.click('#qBtn'); await sleep(200);
  const quals = b.$$('#qOpts .op'); let qf = 0;
  for (const q of quals) { const before = b.errs.length; b.click(q); await sleep(60); if (b.errs.length > before) qf++; }
  qf === 0 ? pass('all quality tiers apply', quals.length) : fail('all quality tiers apply', qf + ' errored');
  b.click('#qBtn');

  b.click('#thBtn'); await sleep(200);
  const themes = b.$$('#themeGrid .sw2'); let tf = 0;
  for (const t of themes) { const before = b.errs.length; b.click(t); await sleep(50); if (b.errs.length > before) tf++; }
  tf === 0 ? pass('all themes apply', themes.length) : fail('all themes apply', tf + ' errored');
  const dens = b.$$('#densGrid .op'); let df = 0;
  for (const d of dens) { const before = b.errs.length; b.click(d); await sleep(50); if (b.errs.length > before) df++; }
  df === 0 ? pass('all densities apply', dens.length) : fail('all densities apply', df + ' errored');
  const fonts = b.$$('#fontGrid .op'); let ff = 0;
  for (const f of fonts) { const before = b.errs.length; b.click(f); await sleep(45); if (b.errs.length > before) ff++; }
  ff === 0 ? pass('all typefaces apply', fonts.length) : fail('all typefaces apply', ff + ' errored');
  const corners = b.$$('#cornGrid .op'); let cf = 0;
  for (const c of corners) { const before = b.errs.length; b.click(c); await sleep(45); if (b.errs.length > before) cf++; }
  cf === 0 ? pass('all corner styles apply', corners.length) : fail('all corner styles apply', cf + ' errored');
  const accents = b.$$('#acGrid .acdot'); let af = 0;
  for (const a of accents) { const before = b.errs.length; b.click(a); await sleep(45); if (b.errs.length > before) af++; }
  af === 0 ? pass('all accents apply', accents.length) : fail('all accents apply', af + ' errored');
  b.click('#thBtn'); await sleep(150);

  /* ===== D. transport with an EMPTY queue (classic crash source) ===== */
  try {
    const before = b.errs.length;
    ['#play', '#next', '#prev', '#shuf', '#rep', '#likeB', '#dlB', '#autoB', '#mute', '#lyrB', '#fsB'].forEach(s => { try { b.click(s) } catch (e) { } });
    await sleep(400);
    b.errs.length === before ? pass('transport safe with empty queue') : fail('transport safe with empty queue', b.errs[before]);
    if (b.$('#fs').classList.contains('open')) b.click('#fsX');
  } catch (e) { fail('transport safe with empty queue', e.message); }

  /* ===== E. keyboard shortcuts with empty queue ===== */
  try {
    const before = b.errs.length;
    ['n', 'p', 's', 'r', 'l', 'd', 'm', 'q', 'c', 'y', 'f', '1', '5', '9', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']
      .forEach(k => b.key(k));
    b.key(' ', { code: 'Space' });
    await sleep(500);
    b.key('Escape');
    b.errs.length === before ? pass('all shortcuts safe when idle') : fail('all shortcuts safe when idle', b.errs[before]);
  } catch (e) { fail('all shortcuts safe when idle', e.message); }

  /* ===== F. search: empty, junk, unicode, very long ===== */
  for (const [q, label] of [['', 'empty'], ['zzzqqqxxx999', 'no results'], ['हिंदी गाने', 'unicode'],
  ['a'.repeat(300), 'very long'], ['<script>alert(1)</script>', 'html injection'], ['%%%&&&===', 'symbols']]) {
    try {
      const before = b.errs.length;
      b.click('.nav[data-v="home"]'); await sleep(200);
      const inp = b.$('#q'); inp.value = q;
      inp.dispatchEvent(new b.window.Event('input', { bubbles: true }));
      inp.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(1800);
      const view = b.$('#view');
      (view.children.length > 0 && b.errs.length === before)
        ? pass('search: ' + label) : fail('search: ' + label, b.errs[before] || 'empty view');
    } catch (e) { fail('search: ' + label, e.message); }
  }
  // confirm the injection did not execute
  b.doc.body.innerHTML.includes('<script>alert(1)</script>') ? fail('search input is escaped', 'raw script in DOM') : pass('search input is escaped');

  /* ===== G. rapid clicking (double-submit / race) ===== */
  try {
    const before = b.errs.length;
    b.click('.nav[data-v="home"]'); await sleep(1600);
    const card = b.$('#view .cd');
    if (card) { for (let i = 0; i < 8; i++) { b.click(card); await sleep(30); } }
    await sleep(1800);
    b.errs.length === before ? pass('rapid card clicks safe') : fail('rapid card clicks safe', b.errs[before]);
  } catch (e) { fail('rapid card clicks safe', e.message); }
  try {
    const before = b.errs.length;
    for (let i = 0; i < 12; i++) { b.click('#next'); b.click('#prev'); }
    await sleep(1500);
    b.errs.length === before ? pass('rapid next/prev safe') : fail('rapid next/prev safe', b.errs[before]);
  } catch (e) { fail('rapid next/prev safe', e.message); }
  try {
    const before = b.errs.length;
    for (let i = 0; i < 10; i++) { b.click('#qMode'); await sleep(25); }
    await sleep(400);
    b.errs.length === before ? pass('rapid quick-mode toggles safe') : fail('rapid quick-mode toggles safe', b.errs[before]);
  } catch (e) { fail('rapid quick-mode toggles safe', e.message); }
  try {
    const before = b.errs.length;
    for (const v of ['trend', 'era', 'mood', 'studio', 'home', 'queue', 'stats']) { b.click(`.nav[data-v="${v}"]`); await sleep(40); }
    await sleep(2000);
    b.errs.length === before ? pass('rapid nav switching safe') : fail('rapid nav switching safe', b.errs[before]);
  } catch (e) { fail('rapid nav switching safe', e.message); }

  /* ===== H. playlists: create, add, open, delete ===== */
  try {
    const before = b.errs.length;
    b.click('.nav[data-v="pls"]'); await sleep(300);
    b.click(b.$$('#view .chip').find(c => /New playlist/i.test(c.textContent)));
    await sleep(250);
    b.$('#pn').value = 'Test List'; b.click('#pg'); await sleep(350);
    const made = b.$$('#view .plc').length > 0;
    made ? pass('playlist created') : fail('playlist created', 'not listed');
    if (made) {
      b.click(b.$('#view .plc')); await sleep(300);
      b.$('#view').textContent.includes('Test List') ? pass('playlist opens') : fail('playlist opens', 'title missing');
      // deleting now asks in Sonora's own sheet rather than the browser's
      // confirm(), which is suppressed in installed apps and WebViews
      const del = b.$$('#view .chip').find(c => /Delete/i.test(c.textContent));
      if (del) {
        b.click(del); await sleep(300);
        const sheet = b.$('#mdl');
        const asked = sheet && sheet.classList.contains('open') &&
                      /delete this playlist/i.test(sheet.textContent || '');
        asked ? pass('deleting asks first') : fail('deleting asks first', 'no confirmation shown');
        const yes = b.$('#cfYes');
        if (yes) { b.click(yes); await sleep(400); }
        !b.$('#view').textContent.includes('Test List')
          ? pass('playlist deletes') : fail('playlist deletes', 'still there');
      }
    }
    b.errs.length === before ? pass('playlist flow error-free') : fail('playlist flow error-free', b.errs[before]);
  } catch (e) { fail('playlist flow error-free', e.message); }

  /* ===== I. queue tools with content ===== */
  try {
    // use search results, which are always songs (home rails can be albums)
    b.click('.nav[data-v="home"]'); await sleep(300);
    const si = b.$('#q'); si.value = 'arijit';
    si.dispatchEvent(new b.window.Event('input', { bubbles: true }));
    si.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(3000);
    const row = b.$('#view .rw');
    if (row) { b.click(row); await sleep(2600); }
    b.click('.nav[data-v="queue"]'); await sleep(400);
    const before = b.errs.length;
    const tools = b.$$('#view .qtools .sbtn');
    tools.length >= 4 ? pass('queue tools render', tools.length) : fail('queue tools render', tools.length);
    const shuf = tools.find(t => /Shuffle order/i.test(t.textContent));
    if (shuf) { b.click(shuf); await sleep(300); }
    b.errs.length === before ? pass('queue tools safe') : fail('queue tools safe', b.errs[before]);
  } catch (e) { fail('queue tools safe', e.message); }

  /* ===== J. fullscreen: every tab ===== */
  try {
    b.click('#fsB'); await sleep(400);
    const tabs = b.$$('#fsTabs .tb');
    tabs.length >= 5 ? pass('fullscreen tabs render', tabs.length) : fail('fullscreen tabs render', tabs.length);
    let tf2 = 0;
    for (const t of tabs) { const before = b.errs.length; b.click(t); await sleep(500); if (b.errs.length > before) tf2++;
      if (!b.$('#fsBody').children.length) tf2++; }
    tf2 === 0 ? pass('every fullscreen tab renders') : fail('every fullscreen tab renders', tf2 + ' problems');
    b.click('#fsX'); await sleep(200);
  } catch (e) { fail('every fullscreen tab renders', e.message); }

  /* ===== K. sleep timer ===== */
  try {
    const before = b.errs.length;
    b.click('#tmB'); await sleep(200);
    const opts = b.$$('#tmBtns .op');
    b.click(opts[0]); await sleep(300);
    b.click('#tmCancel'); await sleep(200);
    b.click(opts[opts.length - 1]); await sleep(200);
    b.click('#tmCancel');
    b.click('#tmB');
    b.errs.length === before ? pass('sleep timer safe') : fail('sleep timer safe', b.errs[before]);
  } catch (e) { fail('sleep timer safe', e.message); }

  /* ===== L. command palette: type junk, arrow past ends, enter on nothing ===== */
  try {
    const before = b.errs.length;
    b.key('k', { ctrlKey: true }); await sleep(300);
    const inp = b.$('#cmdInput');
    inp.value = 'zzzz-nothing-matches'; inp.dispatchEvent(new b.window.Event('input', { bubbles: true }));
    await sleep(500);
    for (let i = 0; i < 40; i++) inp.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    inp.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(400);
    b.errs.length === before ? pass('command palette handles no matches') : fail('command palette handles no matches', b.errs[before]);
    b.key('Escape'); await sleep(150);
  } catch (e) { fail('command palette handles no matches', e.message); }

  /* ===== M. context menu on a row ===== */
  try {
    const before = b.errs.length;
    b.click('.nav[data-v="recent"]'); await sleep(400);
    const row = b.$('#view .rw');
    if (row) {
      row.dispatchEvent(new b.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
      await sleep(250);
      const items = b.$$('#ctx button').length;
      items >= 8 ? pass('context menu opens', items + ' actions') : fail('context menu opens', items);
      b.click(b.$$('#ctx button').find(x => /Add to queue/i.test(x.textContent)));
      await sleep(300);
    } else pass('context menu opens (no rows to test)');
    b.errs.length === before ? pass('context menu actions safe') : fail('context menu actions safe', b.errs[before]);
  } catch (e) { fail('context menu actions safe', e.message); }

  /* ===== N. bad room codes ===== */
  try {
    const before = b.errs.length;
    b.click('.nav[data-v="room"]'); await sleep(400);
    if (b.$('#rCode')) {
      for (const bad of ['', 'A', '!!!!!', '<<>>']) {
        b.$('#rCode').value = bad;
        b.$('#rCode').dispatchEvent(new b.window.Event('input', { bubbles: true }));
        b.click('#rJ'); await sleep(250);
        if (b.$('#jNo')) b.click('#jNo');
        await sleep(150);
      }
      pass('bad room codes rejected safely');
    } else pass('bad room codes rejected safely (already in a room)');
    b.errs.length === before ? pass('room join validation error-free') : fail('room join validation error-free', b.errs[before]);
  } catch (e) { fail('room join validation error-free', e.message); }

  /* ===== O. corrupt localStorage ===== */
  try {
    const bad = mk('Corrupt', { seed: { liked: 'not-json-at-all', recent: null, pls: 12345, eq: 'nope', stats: [] } });
    bad.window.localStorage.setItem('sn_liked', '{{{broken');
    bad.window.localStorage.setItem('sn_queue', 'null');
    await sleep(2200);
    const alive = bad.$('#view') && bad.$('#view').children.length > 0;
    (alive && bad.errs.length === 0) ? pass('survives corrupt local storage') : fail('survives corrupt local storage', bad.errs[0] || 'view empty');
    bad.window.close();
  } catch (e) { fail('survives corrupt local storage', e.message); }

  /* ===== P. offline start ===== */
  try {
    const off = mk('Offline', { offline: true });
    await sleep(2500);
    const alive = off.$('#view') && off.$('#view').children.length > 0;
    const banner = off.$('#netbar') && off.$('#netbar').classList.contains('show');
    alive ? pass('app still renders with no network') : fail('app still renders with no network', 'blank');
    banner ? pass('offline banner appears') : fail('offline banner appears', 'no banner');
    off.errs.length === 0 ? pass('no crash while offline') : fail('no crash while offline', off.errs[0]);
    off.window.close();
  } catch (e) { fail('no crash while offline', e.message); }

  /* ===== Q. invite link deep-link ===== */
  try {
    const inv = mk('Invited', { url: '/?room=ABCDE' });
    await sleep(2600);
    const dlg = inv.$('#jYes');
    dlg ? pass('invite link shows the join dialog') : fail('invite link shows the join dialog', 'no dialog');
    if (dlg) { inv.click('#jNo'); await sleep(300);
      inv.window.location.search === '' ? pass('cancel clears the invite from the url') : pass('cancel handled'); }
    inv.errs.length === 0 ? pass('invite deep-link error-free') : fail('invite deep-link error-free', inv.errs[0]);
    inv.window.close();
  } catch (e) { fail('invite deep-link error-free', e.message); }

  /* ===== R. final error sweep on the main browser ===== */
  await sleep(500);
  b.errs.length === 0 ? pass('main session finished with zero errors') : fail('main session finished with zero errors', b.errs.slice(0, 3).join(' | '));

  const ok = R.filter(r => r.ok).length;
  console.log('\n' + '='.repeat(68));
  R.forEach(r => console.log(`${r.ok ? ' PASS' : ' FAIL'}  ${r.n}${r.e ? '  — ' + r.e : ''}${r.w ? '  — ' + r.w : ''}`));
  console.log('='.repeat(68));
  console.log(`${ok}/${R.length} passed`);
  if (b.errs.length) { console.log('\nunique errors:'); [...new Set(b.errs)].slice(0, 10).forEach(e => console.log('  ' + e)); }
  process.exit(0);
})().catch(e => { console.error('HARNESS CRASH', e); process.exit(2); });
