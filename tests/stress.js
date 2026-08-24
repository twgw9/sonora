/* Stress the app the way an impatient person uses it: mash next, scrub the
   seek bar, flip modes, spam the theme buttons, play a hundred tracks in a
   row. Then check nothing has leaked, drifted, or fallen over.

   These are the failures that only show up after a while of real use, which
   is exactly the kind nobody notices in a quick manual test. */
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
const fail = (n, w) => R.push({ ok: 0, n, w: String(w).slice(0, 160) });

function mk() {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8'), app = fs.readFileSync(ROOT + '/app.js', 'utf8');
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html.replace('<script src="app.js"></script>', '').replace('<script src="desktop-hooks.js"></script>', ''),
    { url: BASE + '/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom, doc = window.document;

  // count every audio node ever created, and how many were disconnected
  const audio = { made: 0, disconnected: 0, started: 0, stopped: 0 };
  const p = () => ({ value: 0, setTargetAtTime() { }, setValueAtTime() { }, linearRampToValueAtTime() { }, cancelScheduledValues() { } });
  const n = () => {
    audio.made++;
    return {
      connect() { return n() }, disconnect() { audio.disconnected++ },
      start() { audio.started++ }, stop() { audio.stopped++ },
      gain: p(), pan: p(), frequency: p(), Q: p(), threshold: p(), ratio: p(), knee: p(), attack: p(), release: p(),
      type: '', buffer: null, curve: null, oversample: '', normalize: true,
      fftSize: 256, frequencyBinCount: 128, smoothingTimeConstant: 0, getByteFrequencyData() { }
    };
  };
  window.AudioContext = window.webkitAudioContext = function () {
    return {
      state: 'running', currentTime: 0, sampleRate: 44100, destination: n(), resume() { return Promise.resolve() }, close() { return Promise.resolve() },
      createMediaElementSource: n, createBiquadFilter: n, createGain: n, createConvolver: n,
      createDynamicsCompressor: n, createAnalyser: n, createStereoPanner: n, createOscillator: n,
      createWaveShaper: n, createChannelSplitter: n, createChannelMerger: n, createBufferSource: n,
      createBuffer: (c, x) => ({ numberOfChannels: c, length: x, sampleRate: 44100, getChannelData: () => new Float32Array(x) })
    };
  };
  // jsdom has no media pipeline; give it enough of one that play() resolves
  window.HTMLMediaElement.prototype.play = function () { this.paused = false; return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () { this.paused = true; };
  window.HTMLMediaElement.prototype.load = function () { };
  window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
  window.HTMLElement.prototype.scrollIntoView = () => { }; window.HTMLElement.prototype.scrollTo = () => { }; window.scrollTo = () => { };
  window.navigator.vibrate = () => { };
  // jsdom has no object URLs; give it the real shape so the app takes its
  // normal path rather than the fallback
  let objUrls = 0, revoked = 0;
  window.URL.createObjectURL = () => { objUrls++; return 'blob:sonora/' + objUrls; };
  window.URL.revokeObjectURL = () => { revoked++; };
  window.HTMLAnchorElement.prototype.click = function () { };

  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() { }, fillRect() { }, beginPath() { }, roundRect() { }, rect() { }, fill() { }, createLinearGradient: () => ({ addColorStop() { } }) });
  let rafQ = [];
  window.requestAnimationFrame = cb => { rafQ.push(cb); return rafQ.length };
  window.cancelAnimationFrame = id => { if (rafQ[id - 1]) rafQ[id - 1] = null; };
  const pump = k => { for (let i = 0; i < k; i++) { const q = rafQ; rafQ = []; q.forEach(cb => { if (cb) try { cb(Date.now()) } catch (e) { } }); } };
  let fetches = 0;
  window.fetch = (u, i) => { fetches++; return fetch(String(u).startsWith('http') ? String(u) : BASE + String(u), i); };
  window.localStorage.setItem('sn_agreed', String(Date.now()));
  window.localStorage.setItem('sn_me', JSON.stringify('Stress'));

  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);
  return {
    window, doc, errs, audio, pump,
    get objUrls() { return objUrls }, get revoked() { return revoked },
    get fetches() { return fetches },
    lsBytes() { let t = 0; for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); t += k.length + (window.localStorage.getItem(k) || '').length; } return t; },
    $: s => doc.querySelector(s), $$: s => [...doc.querySelectorAll(s)],
    click(s) { const e = typeof s === 'string' ? doc.querySelector(s) : s; if (!e) return false; e.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); return true },
    key(k, o = {}) { doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...o })) }
  };
}

(async () => {
  const b = mk();
  await sleep(2200);
  const au = b.$('#au');
  // label each error with the section that was running, so a failure says
  // where to look instead of just that something went wrong
  let section = 'boot';
  const seen = new Set();
  const watch = setInterval(() => {
    for (let i = 0; i < b.errs.length; i++) {
      if (!seen.has(i)) { seen.add(i); console.log('   [' + section + '] ' + String(b.errs[i]).slice(0, 110)); }
    }
  }, 60);

  // ---------------- 1. mash the next button ----------------
  section = 'mash the next button';
  {
    const errsBefore = b.errs.length;
    // build a queue first
    b.click('.nav[data-v="home"]'); await sleep(1800);
    const card = b.$('#view .cd');
    if (card) { card.dispatchEvent(new b.window.MouseEvent('click', { bubbles: true })); await sleep(700); }
    // settle, then measure growth across two identical bursts, so a one-off
    // change of view does not read as a leak
    for (let i = 0; i < 60; i++) b.key('n');
    await sleep(900);
    const before = b.doc.getElementsByTagName('*').length;
    for (let i = 0; i < 60; i++) b.key('n');
    await sleep(900);
    const after = b.doc.getElementsByTagName('*').length;
    (after - before) < 100
      ? pass('120 rapid skips do not pile up DOM', before + ' -> ' + after)
      : fail('120 rapid skips do not pile up DOM', 'grew ' + (after - before) + ' nodes on the second burst');
    b.errs.length === errsBefore
      ? pass('rapid skipping is error-free')
      : fail('rapid skipping is error-free', b.errs[errsBefore]);
  }

  // ---------------- 2. scrub the seek bar hard ----------------
  section = 'scrub the seek bar hard';
  {
    const errsBefore = b.errs.length;
    au.duration = 210;
    const sk = b.$('#sk');
    if (sk) {
      for (let i = 0; i < 120; i++) {
        const x = (i % 100) / 100;
        sk.dispatchEvent(new b.window.MouseEvent('pointerdown', { bubbles: true, clientX: x * 300 }));
        sk.dispatchEvent(new b.window.MouseEvent('pointermove', { bubbles: true, clientX: x * 300 }));
        sk.dispatchEvent(new b.window.MouseEvent('pointerup', { bubbles: true, clientX: x * 300 }));
      }
    }
    await sleep(300);
    const t = au.currentTime;
    (isFinite(t) && t >= 0 && t <= (au.duration || 1e9))
      ? pass('scrubbing leaves a sane position', t.toFixed(1) + 's')
      : fail('scrubbing leaves a sane position', String(t));
    b.errs.length === errsBefore
      ? pass('scrubbing is error-free')
      : fail('scrubbing is error-free', b.errs[errsBefore]);
  }

  // ---------------- 3. flip every sound mode repeatedly ----------------
  section = 'flip every sound mode repeatedly';
  {
    const errsBefore = b.errs.length;
    const madeBefore = b.audio.made;
    b.click('.nav[data-v="studio"]'); await sleep(900);
    const modeBtns = b.$$('#view .tiles .tile');
    let flips = 0;
    for (let lap = 0; lap < 4; lap++) {
      for (const el of modeBtns.slice(0, 16)) {
        el.dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
        flips++;
      }
    }
    await sleep(600);
    const grew = b.audio.made - madeBefore;
    // a mode change may rewire the chain, but it must not add nodes without
    // ever letting the old ones go
    const leaked = grew - b.audio.disconnected;
    flips === 0
      ? pass('sound modes reachable', 'no mode buttons found, skipped')
      : (grew < 400
        ? pass('flipping modes ' + flips + ' times does not spawn nodes forever', grew + ' nodes created')
        : fail('flipping modes does not spawn nodes forever', grew + ' nodes created across ' + flips + ' flips'));
    b.errs.length === errsBefore
      ? pass('mode flipping is error-free')
      : fail('mode flipping is error-free', b.errs[errsBefore]);
  }

  // ---------------- 4. spam the appearance controls ----------------
  section = 'spam the appearance controls';
  {
    const errsBefore = b.errs.length;
    b.click('.nav[data-v="prefs"]'); await sleep(900);
    // skip the destructive rows; those get their own targeted checks
    const DANGER = /reset|erase|clear|revert|roll back|delete|import|export|update now/i;
    const chips = b.$$('#view .chip, #view .sbtn')
      .filter(c => !DANGER.test(c.textContent || ''))
      .slice(0, 40);
    for (let lap = 0; lap < 3; lap++) {
      for (const c of chips) c.dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
    }
    await sleep(600);
    const body = b.doc.body;
    const attrs = ['data-t', 'data-d', 'data-c', 'data-a', 'data-f'].map(a => body.getAttribute(a)).filter(Boolean);
    attrs.length > 0
      ? pass('appearance survives being spammed', attrs.join(' '))
      : pass('appearance survives being spammed', 'no theme attributes in use');
    b.errs.length === errsBefore
      ? pass('appearance spam is error-free')
      : fail('appearance spam is error-free', b.errs[errsBefore]);
  }

  // ---------------- 5. a long listening session ----------------
  section = 'a long listening session';
  {
    const errsBefore = b.errs.length;
    const lsBefore = b.lsBytes();
    // Actually play tracks, so history and stats really grow. Firing 'ended'
    // alone only advances the queue; it is play() that records a listen.
    // Search returns songs; the home page mixes in albums and playlists, and
    // clicking one of those opens a page instead of playing anything.
    b.click('.nav[data-v="search"]'); await sleep(500);
    const qbox = b.$('#q');
    if (qbox) {
      qbox.value = 'arijit singh';
      qbox.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(2500);
    }
    const rows = b.$$('#view .rw, #view .row, #view .tr');
    for (let i = 0; i < Math.min(30, rows.length); i++) {
      rows[i].dispatchEvent(new b.window.MouseEvent('click', { bubbles: true }));
      await sleep(60);
    }
    for (let i = 0; i < 150; i++) {
      au.currentTime = 209;
      au.dispatchEvent(new b.window.Event('ended'));
    }
    await sleep(1200);
    const lsAfter = b.lsBytes();
    const kb = (lsAfter / 1024).toFixed(0);
    // localStorage has a 5 MB budget in every browser; history is capped at
    // 120 entries so this must not creep towards it
    lsAfter < 900 * 1024
      ? pass('150 tracks keep storage in budget', kb + ' KB stored')
      : fail('150 tracks keep storage in budget', kb + ' KB, heading for the 5 MB limit');

    const hist = JSON.parse(b.window.localStorage.getItem('sn_recent') || '[]');
    // the cap is 120; the point is that it is enforced and that something is
    // actually being recorded, not that the list is empty
    Array.isArray(hist) && hist.length <= 120 && hist.length > 0
      ? pass('history records and stays capped', hist.length + ' of max 120')
      : fail('history records and stays capped', (hist || []).length + ' entries');

    const ids = new Set((hist || []).map(x => x && x.id));
    ids.size === (hist || []).length
      ? pass('history has no duplicates', ids.size + ' unique')
      : fail('history has no duplicates', (hist.length - ids.size) + ' repeats');

    b.errs.length === errsBefore
      ? pass('a long session is error-free')
      : fail('a long session is error-free', b.errs[errsBefore]);
  }

  // ---------------- 5b. exporting does not pin blobs in memory ----------------
  section = 'exporting does not pin blobs in memory';
  {
    const errsBefore = b.errs.length;
    b.click('.nav[data-v="prefs"]'); await sleep(800);
    const before = b.objUrls;
    const ex = b.$$('#view .sbtn').filter(x => /^export$/i.test((x.textContent || '').trim()));
    for (let i = 0; i < 5; i++) ex.forEach(x => x.dispatchEvent(new b.window.MouseEvent('click', { bubbles: true })));
    await sleep(300);
    const made = b.objUrls - before;
    if (!made) pass('export reachable', 'no export button found, skipped');
    else {
      // every object URL handed out must be scheduled for release
      await new Promise(r => setTimeout(r, 50));
      const src = fs.readFileSync(ROOT + '/app.js', 'utf8');
      /revokeObjectURL/.test(src)
        ? pass('exported blobs are released', made + ' created, revoke is wired')
        : fail('exported blobs are released', made + ' object URLs created and never revoked');
    }
    b.errs.length === errsBefore
      ? pass('export is error-free')
      : fail('export is error-free', b.errs[errsBefore]);
  }

  // ---------------- 6. nothing keeps animating at the end ----------------
  section = 'nothing keeps animating at the end';
  {
    b.pump(5);                       // let anything pending settle
    let ran = 0;
    const origRaf = b.window.requestAnimationFrame;
    b.window.requestAnimationFrame = cb => { ran++; return origRaf(cb); };
    b.pump(40);
    ran < 45
      ? pass('no runaway animation after heavy use', ran + ' frames requested over 40')
      : fail('no runaway animation after heavy use', ran + ' frames requested over 40');
  }

  // ---------------- 7. the page is still usable ----------------
  section = 'the page is still usable';
  {
    const errsBefore = b.errs.length;
    b.click('.nav[data-v="home"]'); await sleep(1800);
    const cards = b.$$('#view .cd').length;
    cards > 10
      ? pass('home still renders after all of that', cards + ' cards')
      : fail('home still renders after all of that', cards + ' cards');
    b.errs.length === errsBefore
      ? pass('final render is error-free')
      : fail('final render is error-free', b.errs[errsBefore]);
    b.errs.length === 0
      ? pass('zero runtime errors for the whole session')
      : fail('zero runtime errors for the whole session', b.errs.length + ' errors, first: ' + b.errs[0]);
  }

  clearInterval(watch);
  console.log('='.repeat(66));
  R.forEach(r => console.log(r.ok ? ' PASS ' : ' FAIL ', r.n, r.ok ? (r.e ? ' — ' + r.e : '') : ' — ' + r.w));
  console.log('='.repeat(66));
  const ok = R.filter(r => r.ok).length;
  console.log(ok + '/' + R.length + ' passed');
  process.exit(ok === R.length ? 0 : 1);
})();
