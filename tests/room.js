/* Two independent browsers in one room — does the guest really hear the host? */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const BASE = process.env.BASE || 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const pass = (n, e) => R.push({ ok: 1, n, e }); const fail = (n, w) => R.push({ ok: 0, n, w: String(w).slice(0, 130) });

try {
  const impl = require('jsdom/lib/jsdom/living/nodes/HTMLMediaElement-impl.js');
  const C = impl.implementation || impl.HTMLMediaElementImpl;
  if (C && C.prototype) {
    Object.defineProperty(C.prototype, 'currentTime', { get() { return this.__ct || 0 }, set(v) { this.__ct = Math.max(0, +v || 0) }, configurable: true });
    Object.defineProperty(C.prototype, 'duration', { get() { return this.__du === undefined ? 200 : this.__du }, set(v) { this.__du = v }, configurable: true });
    Object.defineProperty(C.prototype, 'readyState', { get() { return this.__rs === undefined ? 4 : this.__rs }, set(v) { this.__rs = v }, configurable: true });
  }
} catch (e) { }

function mk(name) {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const app = fs.readFileSync(ROOT + '/app.js', 'utf8');
  const errs = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html.replace('<script src="app.js"></script>', ''),
    { url: BASE + '/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom, doc = window.document;
  window.HTMLMediaElement.prototype.play = function () { this.paused = false; this.dispatchEvent(new window.Event('play')); return Promise.resolve() };
  window.HTMLMediaElement.prototype.pause = function () { this.paused = true; this.dispatchEvent(new window.Event('pause')) };
  const p = () => ({ value: 0, setTargetAtTime() { }, setValueAtTime() { } });
  const n = () => ({ connect() { return n() }, disconnect() { }, start() { }, stop() { }, gain: p(), pan: p(), frequency: p(), Q: p(), threshold: p(), ratio: p(), knee: p(), attack: p(), release: p(), type: '', buffer: null, fftSize: 256, frequencyBinCount: 128, smoothingTimeConstant: 0, getByteFrequencyData() { } });
  window.AudioContext = function () { return { state: 'running', currentTime: 0, sampleRate: 44100, destination: n(), resume() { }, createMediaElementSource: n, createBiquadFilter: n, createGain: n, createConvolver: n, createDynamicsCompressor: n, createAnalyser: n, createStereoPanner: n, createChannelSplitter: n, createChannelMerger: n, createBufferSource: n, createBuffer: (c, x) => ({ getChannelData: () => new Float32Array(x) }) } };
  window.EventSource = function (url) {
    const self = this; this.readyState = 1; this.listeners = {};
    this.addEventListener = (t, f) => { (self.listeners[t] = self.listeners[t] || []).push(f) };
    this.close = () => { self.readyState = 2; clearInterval(self.iv) };
    const code = new URL(url, BASE).searchParams.get('c');
    self.iv = setInterval(async () => { try { const r = await fetch(BASE + '/api/room/state?c=' + code); const d = await r.json(); (self.listeners.state || []).forEach(f => f({ data: JSON.stringify(d) })); } catch (e) { } }, 700);
    setTimeout(() => { if (self.onopen) self.onopen() }, 50);
  };
  window.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
  window.HTMLElement.prototype.scrollIntoView = () => { }; window.HTMLElement.prototype.scrollTo = () => { }; window.scrollTo = () => { };
  window.navigator.vibrate = () => { };
  window.requestAnimationFrame = cb => setTimeout(() => cb(1), 8); window.cancelAnimationFrame = clearTimeout;
  window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() { }, fillRect() { }, beginPath() { }, roundRect() { }, rect() { }, fill() { }, createLinearGradient: () => ({ addColorStop() { } }) });
  window.fetch = (u, o) => fetch(String(u).startsWith('http') ? String(u) : BASE + String(u), o);
  window.localStorage.setItem('sn_agreed', String(Date.now()));
  window.localStorage.setItem('sn_me', JSON.stringify(name));
  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);
  return {
    window, doc, errs, name,
    $: s => doc.querySelector(s), $$: s => [...doc.querySelectorAll(s)],
    click(s) { const e = typeof s === 'string' ? doc.querySelector(s) : s; if (!e) throw new Error('missing ' + s); e.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })) }
  };
}

(async () => {
  const host = mk('HostUser'), guest = mk('GuestUser');
  await sleep(1800);

  host.click('.nav[data-v="room"]'); await sleep(400);
  host.click('#rC'); await sleep(2200);
  const code = (host.$('.cd2') || {}).textContent || '';
  code.length >= 4 ? pass('host created room', 'code ' + code) : fail('host created room', 'no code');

  host.$('#rFind').value = 'kesariya';
  host.click('#rFindGo'); await sleep(3000);
  const res = host.$$('#rRes .rrq').length;
  res > 0 ? pass('host search works', res + ' results') : fail('host search works', '0');
  if (res) host.$$('#rRes .rrq')[0].querySelector('[data-a="now"]').dispatchEvent(new host.window.MouseEvent('click', { bubbles: true }));
  await sleep(2500);
  const hostTrack = (host.$('#pT') || {}).textContent || '';
  hostTrack && hostTrack !== 'Nothing playing' ? pass('host is playing', hostTrack.slice(0, 30)) : fail('host is playing', hostTrack);

  guest.click('.nav[data-v="room"]'); await sleep(400);
  guest.$('#rCode').value = code;
  guest.click('#rJ'); await sleep(1200);
  const jy = guest.$('#jYes');
  jy ? (pass('guest gets join confirmation'), jy.dispatchEvent(new guest.window.MouseEvent('click', { bubbles: true }))) : fail('guest gets join confirmation', 'no dialog');
  await sleep(4500);

  const guestTrack = (guest.$('#pT') || {}).textContent || '';
  guestTrack === hostTrack ? pass('guest hears the same track', guestTrack.slice(0, 30))
    : fail('guest hears the same track', `host="${hostTrack.slice(0, 20)}" guest="${guestTrack.slice(0, 20)}"`);
  ((guest.$('#au').getAttribute('src') || '').includes('/stream?u=')) ? pass('guest audio loaded') : fail('guest audio loaded', 'no src');

  await sleep(1500);
  const hm = (host.$('#rmN') || {}).textContent || '0', gm = (guest.$('#rmN') || {}).textContent || '0';
  (+hm >= 2 && +gm >= 2) ? pass('both see 2 members', `host:${hm} guest:${gm}`) : fail('both see 2 members', `host:${hm} guest:${gm}`);

  guest.$('#rFind').value = 'tum hi ho';
  guest.click('#rFindGo'); await sleep(3000);
  if (guest.$$('#rRes .rrq').length) {
    guest.$$('#rRes .rrq')[0].querySelector('[data-a="add"]').dispatchEvent(new guest.window.MouseEvent('click', { bubbles: true }));
    await sleep(3000);
    const hq = host.$$('#rQList .rqi').length;
    hq >= 2 ? pass('guest add appears in host queue', hq + ' tracks') : fail('guest add appears in host queue', hq);
  } else fail('guest add appears in host queue', 'guest search empty');

  guest.$('#rMsg').value = 'hello from guest'; guest.click('#rSend'); await sleep(2500);
  ((host.$('#rChat2') || {}).textContent || '').includes('hello from guest') ? pass('host receives guest chat') : fail('host receives guest chat', 'not found');
  host.$('#rMsg').value = 'reply from host'; host.click('#rSend'); await sleep(2500);
  ((guest.$('#rChat2') || {}).textContent || '').includes('reply from host') ? pass('guest receives host chat') : fail('guest receives host chat', 'not found');

  const before = (guest.$('#pT') || {}).textContent || '';
  const nb = [...host.doc.querySelectorAll('#rNowCard .sbtn')].find(b => b.textContent === 'Next');
  if (nb) {
    nb.dispatchEvent(new host.window.MouseEvent('click', { bubbles: true })); await sleep(5000);
    const after = (guest.$('#pT') || {}).textContent || '';
    after && after !== before ? pass('host Next moves the guest too', after.slice(0, 26)) : fail('host Next moves the guest too', `${before.slice(0, 18)} -> ${after.slice(0, 18)}`);
  } else fail('host Next moves the guest too', 'no Next button');

  const allErr = [...host.errs, ...guest.errs];
  allErr.length === 0 ? pass('no runtime errors in either browser') : fail('no runtime errors in either browser', allErr[0]);

  const ok = R.filter(r => r.ok).length;
  console.log('\n' + '='.repeat(62));
  R.forEach(r => console.log(`${r.ok ? ' PASS' : ' FAIL'}  ${r.n}${r.e ? '  — ' + r.e : ''}${r.w ? '  — ' + r.w : ''}`));
  console.log('='.repeat(62)); console.log(`${ok}/${R.length} passed`);
  process.exit(ok === R.length ? 0 : 1);
})().catch(e => { console.error('CRASH', e); process.exit(2) });
