// Platform test — loads the Get the App page under six different device
// identities and checks each one gets the right card, the right "Your device"
// highlight, and a link that actually resolves on the server.
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
    { url: BASE + '/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, userAgent: o.ua });
  const { window } = dom, doc = window.document;
  // jsdom ignores the userAgent option, so pin it (and platform) by hand
  Object.defineProperty(window.navigator, 'userAgent', { value: o.ua, configurable: true });
  Object.defineProperty(window.navigator, 'platform', { value: o.plat, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: o.touch || 0, configurable: true });
  window.HTMLMediaElement.prototype.play = function () { this.paused = false; return Promise.resolve() };
  window.HTMLMediaElement.prototype.pause = function () { this.paused = true };
  const p = () => ({ value: 0, setTargetAtTime() { }, setValueAtTime() { } });
  const n = () => ({ connect() { return n() }, disconnect() { }, start() { }, stop() { }, gain: p(), pan: p(), frequency: p(), Q: p(), threshold: p(), ratio: p(), knee: p(), attack: p(), release: p(), type: '', buffer: null, fftSize: 256, frequencyBinCount: 128, smoothingTimeConstant: 0, getByteFrequencyData() { } });
  window.AudioContext = function () { return { state: 'running', currentTime: 0, sampleRate: 44100, destination: n(), resume() { }, createMediaElementSource: n, createBiquadFilter: n, createGain: n, createConvolver: n, createDynamicsCompressor: n, createAnalyser: n, createStereoPanner: n, createChannelSplitter: n, createChannelMerger: n, createBufferSource: n, createBuffer: (c, x) => ({ getChannelData: () => new Float32Array(x) }) } };
  window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
  window.HTMLElement.prototype.scrollIntoView = () => { }; window.HTMLElement.prototype.scrollTo = () => { }; window.scrollTo = () => { };
  window.navigator.vibrate = () => { };
  window.requestAnimationFrame = cb => setTimeout(() => cb(1), 8); window.cancelAnimationFrame = clearTimeout;
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() { }, fillRect() { }, beginPath() { }, roundRect() { }, rect() { }, fill() { }, createLinearGradient: () => ({ addColorStop() { } }) });
  window.fetch = (u, i) => fetch(String(u).startsWith('http') ? String(u) : BASE + String(u), i);
  window.localStorage.setItem('sn_agreed', String(Date.now()));
  window.localStorage.setItem('sn_me', JSON.stringify('Tester'));
  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);
  return {
    window, doc, errs, $: s => doc.querySelector(s), $$: s => [...doc.querySelectorAll(s)],
    click(s) { const e = typeof s === 'string' ? doc.querySelector(s) : s; if (!e) throw new Error('missing ' + s); e.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) }
  };
}

const DEVICES = [
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'iPhone', 5, 'iPhone and iPad'],
  ['iPad', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'MacIntel', 5, 'iPhone and iPad'],
  ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36', 'Linux armv8l', 5, 'Android'],
  ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Win32', 0, 'Windows'],
  ['macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'MacIntel', 0, 'macOS'],
  ['Linux', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Linux x86_64', 0, 'Linux']
];

(async () => {
  // every advertised build must actually be served
  try {
    const d = await (await fetch(BASE + '/api/downloads')).json();
    const builds = d.builds || [];
    builds.length >= 5 ? pass('server advertises every platform', builds.length + ' builds')
      : fail('server advertises every platform', builds.length + ' builds');
    for (const b of builds) {
      const remote = !b.file.startsWith('/');
      const url = remote ? b.file : BASE + b.file;
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      const len = Number(r.headers.get('content-length') || 0);
      // a GitHub release asset redirects to a CDN that may omit content-length
      const ok = r.ok && (len > 1e6 || (remote && len === 0));
      ok ? pass('serves the ' + b.label + ' build', b.ext + ' ' + b.size + (remote ? ' (release)' : ''))
        : fail('serves the ' + b.label + ' build', r.status + ' len=' + len);
    }
  } catch (e) { fail('server advertises every platform', e.message); }

  for (const [name, ua, plat, touch, expect] of DEVICES) {
    let b = null;
    try {
      b = mk({ ua, plat, touch });
      await sleep(1800);

      // the home hero strip should name the visitor's own platform
      const gsT = b.$('#gsTitle');
      const heroTxt = gsT ? gsT.textContent : '';
      const heroOK = expect === 'iPhone and iPad'
        ? /Home Screen/i.test(heroTxt)
        : new RegExp(expect === 'Linux' ? 'Linux' : expect, 'i').test(heroTxt) || /Get the app/i.test(heroTxt);
      heroOK ? pass(name + ': home strip names the platform', heroTxt)
        : fail(name + ': home strip names the platform', heroTxt);

      b.click('.nav[data-v="get"]');
      await sleep(2200);

      const cards = b.$$('#view .dlcard');
      cards.length >= 6 ? pass(name + ': all platform cards shown', cards.length)
        : fail(name + ': all platform cards shown', cards.length);

      const mineCard = b.$('#view .dlcard.mine');
      const mineLabel = mineCard ? mineCard.querySelector('h4').textContent : '(none)';
      mineLabel === expect ? pass(name + ': highlights the right build', mineLabel)
        : fail(name + ': highlights the right build', 'got ' + mineLabel + ', wanted ' + expect);

      // the highlighted card must be first, so it is what the eye lands on
      cards[0] === mineCard ? pass(name + ': own build is listed first')
        : fail(name + ': own build is listed first', 'first is ' + (cards[0] ? cards[0].querySelector('h4').textContent : '?'));

      const go = mineCard && mineCard.querySelector('.go');
      const goText = go ? go.textContent.trim() : '';
      go && goText !== 'Coming soon' ? pass(name + ': highlighted card is actionable', goText)
        : fail(name + ': highlighted card is actionable', goText || 'no button');

      // no card anywhere should be a dead end
      const dead = cards.filter(c => ((c.querySelector('.go') || {}).textContent || '').trim() === 'Coming soon')
        .map(c => c.querySelector('h4').textContent);
      dead.length === 0 ? pass(name + ': no unbuilt platforms listed')
        : fail(name + ': no unbuilt platforms listed', dead.join(', '));

      if (expect === 'iPhone and iPad') {
        const before = b.errs.length;
        b.click(go); await sleep(600);
        const txt = b.doc.body.textContent;
        /Add to Home Screen/i.test(txt) && /Safari/i.test(txt)
          ? pass(name + ': install guide explains Safari and Home Screen')
          : fail(name + ': install guide explains Safari and Home Screen', 'guide text not found');
        b.errs.length === before ? pass(name + ': install guide error-free')
          : fail(name + ': install guide error-free', b.errs[before]);
      } else {
        const href = go ? go.getAttribute('href') || '' : '';
        const abs = href.startsWith('/') ? BASE + href : href;
        const r = /^https?:|^\//.test(href)
          ? await fetch(abs, { method: 'HEAD', redirect: 'follow' }) : null;
        r && r.ok ? pass(name + ': download link resolves', href)
          : fail(name + ': download link resolves', href + ' -> ' + (r ? r.status : 'no link'));

        // a cross-origin release asset must not carry the download attribute
        const hasDl = go.hasAttribute('download');
        const wantDl = href.startsWith('/');
        hasDl === wantDl ? pass(name + ': download attribute is correct', wantDl ? 'same-origin' : 'cross-origin')
          : fail(name + ': download attribute is correct', 'download=' + hasDl + ' for ' + href);
      }

      b.errs.length === 0 ? pass(name + ': no runtime errors')
        : fail(name + ': no runtime errors', b.errs[0]);
    } catch (e) {
      fail(name + ': page renders', e.message);
    } finally { try { b && b.window.close(); } catch (e) { } }
  }

  console.log('='.repeat(66));
  R.forEach(r => console.log(r.ok ? ' PASS ' : ' FAIL ', r.n, r.ok ? (r.e ? ' — ' + r.e : '') : ' — ' + r.w));
  console.log('='.repeat(66));
  const ok = R.filter(r => r.ok).length;
  console.log(ok + '/' + R.length + ' passed');
  process.exit(ok === R.length ? 0 : 1);
})();
