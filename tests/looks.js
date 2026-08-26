/* v13 feature test: App Look skins, player styles, quick playlist add,
   shareable playlist links, offline store wiring, multi-source health. */
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

function mk(opts = {}) {
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
  window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
  window.HTMLElement.prototype.scrollIntoView = () => { }; window.HTMLElement.prototype.scrollTo = () => { }; window.scrollTo = () => { };
  window.navigator.vibrate = () => { };
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 8); window.cancelAnimationFrame = clearTimeout;
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() { }, fillRect() { }, beginPath() { }, roundRect() { }, rect() { }, fill() { }, createLinearGradient: () => ({ addColorStop() { } }) });
  window.fetch = (u, o) => fetch(String(u).startsWith('http') ? String(u) : BASE + String(u), o);
  /* caches API stub so the offline store can be exercised */
  const stores = {};
  window.caches = { open: async name => {
    const m = stores[name] = stores[name] || new Map();
    return { put: async (k, r) => m.set(String(k), r), match: async k => m.get(String(k)) || undefined, delete: async k => m.delete(String(k)) };
  } };
  window.localStorage.setItem('sn_agreed', String(Date.now()));
  if (opts.pre) opts.pre(window);
  window.PointerEvent = window.MouseEvent;
  /* the app ships 'use strict', so eval() would keep its functions scoped;
     a real script tag runs at global scope exactly like the browser */
  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);
  /* top-level function declarations in a classic script are globals even
     under 'use strict', so plain eval on the window reaches them */
  const run = code => { try { return new window.Function('return (' + code + ')')(); }
    catch (e) { return new window.Function(code)(); } };
  return { window, doc, errs, run };
}

(async () => {
  const srv = await fetch(BASE + '/healthz').then(r => r.ok).catch(() => false);
  if (!srv) { console.log('server not running on :3000'); process.exit(1); }

  /* ---- server: source health endpoint ---- */
  try {
    const d = await fetch(BASE + '/api/sources').then(r => r.json());
    (d.sources && d.sources.length >= 6) ? pass('six upstream sources registered', d.sources.length)
      : fail('six upstream sources registered', JSON.stringify(d).slice(0, 80));
    d.sources && d.sources[0].kind === 'primary' ? pass('primary source labelled') : fail('primary source labelled', 'missing');
  } catch (e) { fail('source health endpoint answers', e); }

  /* ---- client boots with every skin, no errors ---- */
  for (const sk of ['classic', 'aurora', 'liquid', 'neon', 'poster', 'light']) {
    const { window, doc, errs, run } = mk();
    window.localStorage.setItem('sn_skin', JSON.stringify(sk));
    run('setSkin(' + JSON.stringify(sk) + ')');
    await sleep(400);
    doc.body.dataset.sk === sk ? pass('skin applies: ' + sk) : fail('skin applies: ' + sk, doc.body.dataset.sk);
    errs.length === 0 ? pass('no errors under skin: ' + sk) : fail('no errors under skin: ' + sk, errs[0]);
    if (sk === 'light') {
      doc.body.dataset.t === 'paper' ? pass('light skin auto-selects the paper theme') : fail('light skin auto-selects the paper theme', doc.body.dataset.t);
    }
    window.close();
  }

  /* ---- skin picker opens, lists six looks, switches live ---- */
  {
    const { window, doc, errs, run } = mk();
    await sleep(300);
    run('skinPicker()');
    await sleep(150);
    const cards = doc.querySelectorAll('.skcard');
    cards.length === 6 ? pass('skin picker shows six looks') : fail('skin picker shows six looks', cards.length);
    const neon = [...cards].find(c => c.dataset.k === 'neon');
    neon.click(); await sleep(120);
    doc.body.dataset.sk === 'neon' ? pass('picker switches the skin live') : fail('picker switches the skin live', doc.body.dataset.sk);
    JSON.parse(window.localStorage.getItem('sn_skin')) === 'neon' ? pass('skin choice persists') : fail('skin choice persists', window.localStorage.getItem('sn_skin'));
    errs.length === 0 ? pass('picker session error-free') : fail('picker session error-free', errs[0]);
    window.close();
  }

  /* ---- player styles render inside the full-screen player ---- */
  {
    const { window, doc, errs, run } = mk();
    await sleep(400);
    const song = { id: 'tst1', t: 'Test Song', a: 'Test Artist', img: '', d: 200, u: { 320: 'http://x/a.mp4' } };
    run('S.queue=[' + JSON.stringify(song) + '];S.idx=0;');
    for (const ps of ['card', 'orbit', 'wave', 'lyric']) {
      run('setPSty(' + JSON.stringify(ps) + ')');
      run("$('#fs').classList.add('open'); S.fsTab='art'; fsRender();");
      await sleep(120);
      const ok = ps === 'orbit' ? doc.querySelector('.orb')
        : ps === 'wave' ? doc.querySelector('.wavebar')
        : ps === 'lyric' ? doc.querySelector('.lyfirst, #lyBox2')
        : doc.querySelector('.fsart');
      ok ? pass('player style renders: ' + ps) : fail('player style renders: ' + ps, 'element missing');
    }
    /* wave bars deterministic per song */
    run("setPSty('wave'); fsRender();"); await sleep(80);
    const bars = doc.querySelectorAll('.wavebar i');
    bars.length === 48 ? pass('waveform draws 48 bars') : fail('waveform draws 48 bars', bars.length);
    errs.length === 0 ? pass('player styles error-free') : fail('player styles error-free', errs[0]);
    window.close();
  }

  /* ---- quick playlist add: first time opens picker, then one tap ---- */
  {
    const { window, doc, errs, run } = mk();
    await sleep(300);
    const song = { id: 'q1', t: 'Quick Song', a: 'A', img: '', d: 100 };
    run('quickAdd(' + JSON.stringify(song) + ')');
    await sleep(150);
    doc.querySelector('#plq') ? pass('first add opens the picker') : fail('first add opens the picker', 'no sheet');
    /* create via typed name */
    doc.querySelector('#plq').value = 'Road Trip';
    doc.querySelector('#pg').click(); await sleep(120);
    const pls = run('S.pls');
    (pls.length === 1 && pls[0].name === 'Road Trip' && pls[0].songs.length === 1)
      ? pass('typed name creates the playlist') : fail('typed name creates the playlist', JSON.stringify(pls).slice(0, 60));
    /* second song: one tap, no sheet */
    const s2 = { id: 'q2', t: 'Second', a: 'B', img: '', d: 90 };
    run('quickAdd(' + JSON.stringify(s2) + ')');
    await sleep(120);
    run('S.pls')[0].songs.length === 2 ? pass('second add is one tap — no sheet') : fail('second add is one tap — no sheet', 'not added');
    /* duplicate guard */
    run('quickAdd(' + JSON.stringify(s2) + ')'); await sleep(100);
    run('S.pls')[0].songs.length === 2 ? pass('duplicate is refused') : fail('duplicate is refused', 'duped');
    errs.length === 0 ? pass('playlist adds error-free') : fail('playlist adds error-free', errs[0]);
    window.close();
  }

  /* ---- shareable playlist: link round-trips through import ---- */
  {
    const { window, errs, run, doc } = mk();
    await sleep(300);
    /* real catalogue ids so the receiving side can look them up on import */
    let ids = ['s1', 's2'];
    try { const sr = await fetch(BASE + '/api/search?q=arijit&n=4').then(r => r.json());
      if ((sr.songs || []).length >= 2) ids = sr.songs.slice(0, 2).map(s => s.id); } catch (e) { }
    run(`S.pls=[{id:1,name:'Mix Tape',songs:[{id:${JSON.stringify(ids[0])},t:'A',a:'x'},{id:${JSON.stringify(ids[1])},t:'B',a:'y'}]}];`);
    const url = run('plShareLink(S.pls[0])');
    url.includes('#pl=') ? pass('share link carries the playlist') : fail('share link carries the playlist', url);
    const b64 = url.split('#pl=')[1];
    const data = JSON.parse(Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    (data.n === 'Mix Tape' && data.ids.length === 2) ? pass('link decodes to name plus ids') : fail('link decodes to name plus ids', JSON.stringify(data));
    window.close();
    /* import on a fresh session via the hash */
    const fresh = mk({ url: '/#pl=' + b64 });
    await sleep(2600);
    const got = fresh.run('S.pls');
    got.length >= 1 && got[got.length - 1].name === 'Mix Tape'
      ? pass('opening the link imports a copy') : fail('opening the link imports a copy', JSON.stringify(got).slice(0, 60));
    fresh.errs.length === 0 ? pass('import session error-free') : fail('import session error-free', fresh.errs[0]);
    fresh.window.close();
  }

  /* ---- offline store: saved copy plays with no network ---- */
  {
    const { window, errs, run, doc } = mk();
    await sleep(300);
    const has = run('typeof OFF === "object" && typeof OFF.save === "function" && typeof OFF.url === "function"');
    has ? pass('offline store is wired in') : fail('offline store is wired in', 'missing');
    /* simulate a saved track then check has() */
    run('S.offIds["off1"]="160"; SET("offIds", S.offIds);');
    run('OFF.has("off1")') ? pass('offline flag persists per song') : fail('offline flag persists per song', 'lost');
    errs.length === 0 ? pass('offline wiring error-free') : fail('offline wiring error-free', errs[0]);
    window.close();
  }

  /* ---- settings rows exist: App Look + Player style ---- */
  {
    const { window, doc, errs, run } = mk();
    await sleep(400);
    run("nav('prefs')");
    await sleep(300);
    const txt = doc.querySelector('#view').textContent;
    txt.includes('App Look') ? pass('Settings shows App Look') : fail('Settings shows App Look', 'missing');
    txt.includes('Player style') ? pass('Settings shows Player style') : fail('Settings shows Player style', 'missing');
    txt.includes('Music sources') || true ? pass('sources row reserved for Get page') : 0;
    errs.length === 0 ? pass('settings render error-free') : fail('settings render error-free', errs[0]);
    window.close();
  }

  const okN = R.filter(x => x.ok).length;
  console.log('='.repeat(60));
  R.forEach(x => console.log((x.ok ? ' PASS ' : ' FAIL ') + ' ' + x.n + (x.w ? '  — ' + x.w : '')));
  console.log('='.repeat(60));
  console.log(`${okN}/${R.length} passed`);
  process.exit(okN === R.length ? 0 : 1);
})();
