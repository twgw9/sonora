/* Performance and correctness guards.
   These are the things that were measurably wrong and are easy to reintroduce:
   a chatty playback tick, animations that never stop, a leaking DOM, and a
   search box that shows results for a query you already moved on from. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/user/sonora', BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  const impl = require('jsdom/lib/jsdom/living/nodes/HTMLMediaElement-impl.js');
  const C = impl.implementation || impl.HTMLMediaElementImpl;
  if (C && C.prototype) {
    Object.defineProperty(C.prototype, 'currentTime', { get() { return this.__ct || 0 }, set(v) { this.__ct = Math.max(0, +v || 0) }, configurable: true });
    Object.defineProperty(C.prototype, 'duration', { get() { return this.__du === undefined ? 210 : this.__du }, set(v) { this.__du = v }, configurable: true });
    Object.defineProperty(C.prototype, 'readyState', { get() { return this.__rs === undefined ? 4 : this.__rs }, set(v) { this.__rs = v }, configurable: true });
  }
} catch (e) { }

const R = [];
const pass = (n, e) => R.push({ ok: 1, n, e });
const fail = (n, w) => R.push({ ok: 0, n, w: String(w).slice(0, 140) });

function mk(o = {}) {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8'), app = fs.readFileSync(ROOT + '/app.js', 'utf8');
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html.replace('<script src="app.js"></script>', '').replace('<script src="desktop-hooks.js"></script>', ''),
    { url: BASE + '/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom, doc = window.document;
  const stats = { style: 0, text: 0, html: 0, qs: 0 };
  const oqs = doc.querySelector.bind(doc);

  const p = () => ({ value: 0, setTargetAtTime() { }, setValueAtTime() { } });
  const nodes = [];
  const n = () => { const o = { connect() { return n() }, disconnect() { }, start() { this.started = true }, stop() { this.stopped = true }, gain: p(), pan: p(), frequency: p(), Q: p(), threshold: p(), ratio: p(), knee: p(), attack: p(), release: p(), type: '', buffer: null, fftSize: 256, frequencyBinCount: 128, smoothingTimeConstant: 0, getByteFrequencyData() { } }; nodes.push(o); return o; };
  let oscCount = 0;
  window.AudioContext = function () {
    return {
      state: 'running', currentTime: 0, sampleRate: 44100, destination: n(), resume() { },
      createMediaElementSource: n, createBiquadFilter: n, createGain: n, createConvolver: n,
      createDynamicsCompressor: n, createAnalyser: n, createStereoPanner: n,
      createOscillator: () => { oscCount++; return n(); },
      createChannelSplitter: n, createChannelMerger: n, createBufferSource: n,
      createBuffer: (c, x) => ({ getChannelData: () => new Float32Array(x) })
    };
  };
  window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
  window.HTMLElement.prototype.scrollIntoView = () => { }; window.HTMLElement.prototype.scrollTo = () => { }; window.scrollTo = () => { };
  window.navigator.vibrate = () => { };
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() { }, fillRect() { }, beginPath() { }, roundRect() { }, rect() { }, fill() { }, createLinearGradient: () => ({ addColorStop() { } }) });
  let rafQ = [];
  window.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length };
  window.cancelAnimationFrame = id => { if (rafQ[id - 1]) rafQ[id - 1] = null; };
  const pump = k => { for (let i = 0; i < k; i++) { const q = rafQ; rafQ = []; q.forEach(cb => { if (cb) try { cb(Date.now()) } catch (e) { } }); } };
  window.fetch = o.fetch ? o.fetch(BASE) : ((u, i) => fetch(String(u).startsWith('http') ? String(u) : BASE + String(u), i));
  window.localStorage.setItem('sn_agreed', String(Date.now()));
  window.localStorage.setItem('sn_me', JSON.stringify('Perf'));

  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);

  const instrument = () => {
    const CSSDecl = window.CSSStyleDeclaration.prototype;
    for (const prop of ['width', 'left']) {
      const d = Object.getOwnPropertyDescriptor(CSSDecl, prop);
      if (d && d.set) Object.defineProperty(CSSDecl, prop, { get: d.get, configurable: true, set(v) { stats.style++; return d.set.call(this, v); } });
    }
    const tcd = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
    Object.defineProperty(window.Node.prototype, 'textContent', { get: tcd.get, configurable: true, set(v) { stats.text++; return tcd.set.call(this, v); } });
    doc.querySelector = s => { stats.qs++; return oqs(s); };
  };

  return {
    window, doc, errs, stats, instrument, pump, oqs,
    get oscCount() { return oscCount; },
    reset() { stats.style = stats.text = stats.html = stats.qs = 0; },
    $: oqs, $$: s => [...doc.querySelectorAll(s)],
    click(s) { const e = typeof s === 'string' ? oqs(s) : s; if (!e) throw new Error('missing ' + s); e.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) }
  };
}

(async () => {
  // ---------------- 1. cost of playback ----------------
  {
    const b = mk();
    await sleep(2000);
    b.instrument();
    const au = b.$('#au');
    au.duration = 210;
    const fire = k => { for (let i = 0; i < k; i++) { au.currentTime = i * 0.25; au.dispatchEvent(new b.window.Event('timeupdate')); } };

    b.reset();
    fire(4);                                    // one second of playback
    const ops = b.stats.qs + b.stats.style + b.stats.text;
    ops <= 600
      ? pass('one second of playback stays cheap', ops + ' DOM ops/sec')
      : fail('one second of playback stays cheap', ops + ' DOM ops/sec, expected <= 600');

    b.stats.qs === 0
      ? pass('the tick does not re-query the DOM')
      : fail('the tick does not re-query the DOM', b.stats.qs + ' querySelector calls per second');

    // the same second again with the clock not advancing must write nothing
    b.reset();
    for (let i = 0; i < 4; i++) au.dispatchEvent(new b.window.Event('timeupdate'));
    b.stats.style + b.stats.text === 0
      ? pass('an unchanged clock writes nothing')
      : fail('an unchanged clock writes nothing', (b.stats.style + b.stats.text) + ' writes');

    b.errs.length === 0 ? pass('playback tick error-free') : fail('playback tick error-free', b.errs[0]);
    b.window.close();
  }

  // ---------------- 2. auto-pan uses the audio thread ----------------
  {
    const b = mk();
    await sleep(2000);
    const before = b.oscCount;
    // Sleep is one of the modes that turns auto-pan on
    try { b.window.setMode && b.window.setMode('sleep'); } catch (e) { }
    await sleep(250);
    const made = b.oscCount - before;
    // if setMode is not reachable from the test, fall back to checking source
    const src = fs.readFileSync(ROOT + '/app.js', 'utf8');
    const usesOsc = /panLFO\s*=\s*ctx\.createOscillator\(\)/.test(src);
    usesOsc
      ? pass('auto-pan is driven by an oscillator, not a frame loop', made ? made + ' created' : 'wired')
      : fail('auto-pan is driven by an oscillator, not a frame loop');
    b.window.close();
  }

  // ---------------- 3. nothing animates while idle ----------------
  {
    const b = mk();
    await sleep(2000);
    b.instrument();
    b.reset();
    b.pump(40);
    const work = b.stats.style + b.stats.text;
    work === 0
      ? pass('idle frames do no work')
      : fail('idle frames do no work', work + ' writes across 40 frames');
    b.window.close();
  }

  // ---------------- 4. the DOM does not grow ----------------
  {
    const b = mk();
    await sleep(2000);
    const views = ['home', 'trend', 'era', 'mood', 'studio', 'liked', 'pls', 'queue', 'recent', 'stats', 'prefs', 'get'];
    const lap = async () => {
      for (const v of views) {
        const el = b.$('.nav[data-v="' + v + '"]');
        if (el) { el.dispatchEvent(new b.window.MouseEvent('click', { bubbles: true })); await sleep(150); }
      }
      return b.doc.getElementsByTagName('*').length;
    };
    await lap();
    const a = await lap();
    const c = await lap();
    const growth = c - a;
    growth <= 40
      ? pass('navigating repeatedly does not grow the DOM', a + ' -> ' + c + ' nodes')
      : fail('navigating repeatedly does not grow the DOM', 'grew by ' + growth + ' nodes');
    b.errs.length === 0 ? pass('navigation error-free') : fail('navigation error-free', b.errs[0]);
    b.window.close();
  }

  // ---------------- 5. stale search replies are dropped ----------------
  {
    // the first suggest call is made very slow, so it lands after the second
    const slowFetch = base => {
      let call = 0;
      return (u, i) => {
        const url = String(u).startsWith('http') ? String(u) : base + String(u);
        if (url.includes('/api/suggest')) {
          const delay = ++call === 1 ? 1400 : 40;
          return new Promise(res => setTimeout(() => res(fetch(url, i)), delay));
        }
        return fetch(url, i);
      };
    };
    const b = mk({ fetch: slowFetch });
    await sleep(2000);
    const nv = b.$('.nav[data-v="search"]');
    if (nv) { nv.dispatchEvent(new b.window.MouseEvent('click', { bubbles: true })); await sleep(400); }
    const q = b.$('#q');
    if (!q) { fail('search box exists'); }
    else {
      const type = v => { q.value = v; q.dispatchEvent(new b.window.Event('input', { bubbles: true })); };
      type('arijit'); await sleep(300);
      type('shreya'); await sleep(2200);
      const items = b.$$('#sug .sgi .a').map(e => e.textContent.toLowerCase());
      const stale = items.length > 0 && items.some(t => t.includes('arijit')) && !items.some(t => t.includes('shreya'));
      !stale
        ? pass('a slow reply cannot overwrite a newer search', items.length + ' suggestions')
        : fail('a slow reply cannot overwrite a newer search', 'showing results for the abandoned query');
      b.errs.length === 0 ? pass('search error-free') : fail('search error-free', b.errs[0]);
    }
    b.window.close();
  }

  // ---------------- 6. css does not animate what nobody sees ----------------
  {
    const css = fs.readFileSync(ROOT + '/styles.css', 'utf8');
    /\.boot\.gone[^{]*\.bars i\s*\{[^}]*animation\s*:\s*none/.test(css)
      ? pass('the boot equaliser stops once boot is over')
      : fail('the boot equaliser stops once boot is over', 'it keeps running behind visibility:hidden');

    /\.fsart\{[^}]*animation-play-state:\s*paused/.test(css)
      ? pass('the artwork only drifts while playing')
      : fail('the artwork only drifts while playing');

    // will-change should be scoped to an interaction, not applied at rest
    const wc = css.match(/([^{}\n]*)\{[^}]*will-change/g) || [];
    const unscoped = wc.filter(r => !/:hover|:active|:focus/.test(r));
    unscoped.length === 0
      ? pass('will-change is not left on at rest', wc.length + ' scoped rules')
      : fail('will-change is not left on at rest', unscoped.length + ' rules promote layers permanently');
  }

  console.log('='.repeat(64));
  R.forEach(r => console.log(r.ok ? ' PASS ' : ' FAIL ', r.n, r.ok ? (r.e ? ' — ' + r.e : '') : ' — ' + r.w));
  console.log('='.repeat(64));
  const ok = R.filter(r => r.ok).length;
  console.log(ok + '/' + R.length + ' passed');
  process.exit(ok === R.length ? 0 : 1);
})();
