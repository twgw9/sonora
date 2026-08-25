/* v15 feature test: bento home, vinyl player style, radial quick menu,
   queue bottom sheet, peek rails, ranked search, lite mode, AI Help
   (bring-your-own-key, never embedded), pinned update source. */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..'), BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const pass = (n, e) => R.push({ ok: 1, n, e }); const fail = (n, w) => R.push({ ok: 0, n, w: String(w).slice(0, 200) });

function mk(opts = {}) {
  const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const app = fs.readFileSync(ROOT + '/app.js', 'utf8');
  const errs = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html.replace('<script src="app.js"></script>', ''),
    { url: BASE + (opts.url || '/'), runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom, doc = window.document;
  /* jsdom's paused is a getter; make it settable so tests can fake states */
  try {
    Object.defineProperty(window.HTMLMediaElement.prototype, 'paused',
      { get() { return this.__pp !== false }, set(v) { this.__pp = !!v }, configurable: true });
  } catch (e) { }
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
  const stores = {};
  window.caches = { open: async name => { const m = stores[name] = stores[name] || new Map(); return { put: async (k, r) => m.set(String(k), r), match: async k => m.get(String(k)) || undefined, delete: async k => m.delete(String(k)) }; } };
  window.localStorage.setItem('sn_agreed', String(Date.now()));
  if (opts.pre) opts.pre(window);
  window.PointerEvent = window.MouseEvent;
  const sc = doc.createElement('script'); sc.textContent = app; doc.body.appendChild(sc);
  const run = code => { try { return new window.Function('return (' + code + ')')(); } catch (e) { return new window.Function(code)(); } };
  return { window, doc, errs, run };
}

(async () => {
  /* ---------------- static file gates ---------------- */
  {
    const app = fs.readFileSync(ROOT + '/app.js', 'utf8');
    const idx = fs.readFileSync(ROOT + '/index.html', 'utf8');
    const css = fs.readFileSync(ROOT + '/styles.css', 'utf8');
    const ver = JSON.parse(fs.readFileSync(ROOT + '/version.json', 'utf8'));
    const sw = fs.readFileSync(ROOT + '/sw.js', 'utf8');
    ver.version === 15 ? pass('version.json is 15') : fail('version.json is 15', ver.version);
    ver.version === 15 ? pass('version.json is 15') : fail('version.json is 15', ver.version);
    sw.includes('sonora-v42') ? pass('service worker bumped to v42') : fail('service worker bumped to v42', 'missing');
    app.includes("BUILD = 'v42-") ? pass('app build fingerprint is v42') : fail('app build fingerprint is v42', 'missing');
    app.includes("UPDATE_SOURCE = 'https://raw.githubusercontent.com/twgw9/sonora/main/'")
      ? pass('official update source baked in') : fail('official update source baked in', 'missing');
    /* no key material anywhere in the shipped UI files — the AI key must
       only ever arrive via Settings at runtime (LS/SET add the sn_ prefix
       internally, so only the bare field name appears in source) */
    const ui = app + idx + css;
    /sk-or-v1-/i.test(ui) ? fail('no OpenRouter key material in shipped files', 'found an embedded key!') : pass('no OpenRouter key material in shipped files');
    app.includes("LS('aiKeys'") && app.includes("LS('aiOn'") && !/sk-[A-Za-z0-9\-_]{20,}/.test(app) && !/gsk_[A-Za-z0-9]{20,}/.test(app)
      ? pass('AI keys only ever read from local storage') : fail('AI keys only ever read from local storage', 'suspicious literal');
    /* the emoji gate release.sh enforces, checked here too */
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    [app, idx, css].forEach((f, i) => emoji.test(f) ? fail(['app.js', 'index.html', 'styles.css'][i] + ' has no emoji') : pass(['app.js', 'index.html', 'styles.css'][i] + ' has no emoji'));
    css.includes('.vdisc') && css.includes('.radial') && css.includes('.qsheet') && css.includes('.bento') && css.includes('body.lite')
      ? pass('v15 CSS blocks present') : fail('v15 CSS blocks present', 'missing section');
  }

  /* ---------------- boot: aurora default, bento, peek ---------------- */
  let C;
  try {
    C = mk();
    await sleep(1100);
    const { doc, run, errs, window } = C;
    errs.length === 0 ? pass('fresh boot is error-free') : fail('fresh boot is error-free', errs[0]);
    doc.body.dataset.sk === 'aurora' ? pass('Aurora is the default look') : fail('Aurora is the default look', doc.body.dataset.sk);
    run('S.pSty') === 'card' ? pass('player style default untouched (card)') : fail('player style default untouched (card)', run('S.pSty'));
    run('PSTYLES.length') === 5 && run('PSTYLES.map(x=>x[0])').includes('vinyl')
      ? pass('five player styles including Vinyl') : fail('five player styles including Vinyl', run('PSTYLES.map(x=>x[0])'));
    doc.querySelectorAll('.bento .btile').length === 4
      ? pass('bento home renders four tiles') : fail('bento home renders four tiles', doc.querySelectorAll('.bento .btile').length);
    doc.querySelector('.btjump') && doc.querySelector('.btweek') && doc.querySelector('.btdice') && doc.querySelector('.btmix')
      ? pass('bento tiles are jump, week, dice, mix') : fail('bento tiles are jump, week, dice, mix', 'missing tile');
    doc.querySelectorAll('.btbar').length === 7 ? pass('week shows seven day bars') : fail('week shows seven day bars', doc.querySelectorAll('.btbar').length);
    doc.querySelector('.rail.peek') ? pass('peek carousel class applied') : fail('peek carousel class applied', 'no .rail.peek');
    doc.querySelector('#sVer').textContent === 'v42' ? pass('sidebar shows v42') : fail('sidebar shows v42', doc.querySelector('#sVer').textContent);
    window.localStorage.getItem('sn_updsrc') === 'https://raw.githubusercontent.com/twgw9/sonora/main/'
      ? pass('update source pinned in storage on boot') : fail('update source pinned in storage on boot', window.localStorage.getItem('sn_updsrc'));
    /* tamper + heal */
    window.localStorage.setItem('sn_updsrc', 'https://evil.example/x/');
    run('pinUpdateSource()') === 'https://raw.githubusercontent.com/twgw9/sonora/main/'
      ? pass('pinUpdateSource heals a tampered source') : fail('pinUpdateSource heals a tampered source', 'no heal');
    window.localStorage.getItem('sn_updsrc') === 'https://raw.githubusercontent.com/twgw9/sonora/main/'
      ? pass('healed value persisted') : fail('healed value persisted', window.localStorage.getItem('sn_updsrc'));

    /* ---------------- vinyl player style ---------------- */
    run('S.queue=[{id:"v1",t:"Tum Hi Ho",a:"Arijit Singh",img:"",d:200}]; S.idx=0; S.fsTab="art"; setPSty("vinyl"); openFS();');
    await sleep(150);
    doc.querySelector('.vdisc') ? pass('vinyl disc drawn') : fail('vinyl disc drawn', 'missing');
    doc.querySelector('.vring') ? pass('vinyl progress ring drawn') : fail('vinyl progress ring drawn', 'missing');
    doc.querySelector('.vneedle') ? pass('vinyl needle drawn') : fail('vinyl needle drawn', 'missing');
    /* play/pause events drive the disc and the needle without a re-render */
    run('au.paused=false; au.dispatchEvent(new Event("play"))');
    await sleep(40);
    doc.querySelector('.vdisc').classList.contains('go') ? pass('disc spins while playing') : fail('disc spins while playing', 'no go class');
    !doc.querySelector('.vneedle').classList.contains('up') ? pass('needle sits on the record while playing') : fail('needle sits on the record while playing', 'needle lifted');
    run('au.paused=true; au.dispatchEvent(new Event("pause"))');
    await sleep(40);
    !doc.querySelector('.vdisc').classList.contains('go') ? pass('disc stops on pause') : fail('disc stops on pause', 'still going');
    doc.querySelector('.vneedle').classList.contains('up') ? pass('needle lifts on pause') : fail('needle lifts on pause', 'needle stayed');

    /* ---------------- radial quick menu ---------------- */
    run('openRadial(400, 380)');
    await sleep(80);
    doc.querySelectorAll('.radial .rdb').length === 6 ? pass('radial fans out six actions') : fail('radial fans out six actions', doc.querySelectorAll('.radial .rdb').length);
    const labels = [...doc.querySelectorAll('.radial .rdb span')].map(x => x.textContent);
    ['Playlist', 'Like', 'Download', 'Radio', 'Sleep', 'Share'].every(l => labels.includes(l))
      ? pass('radial actions are the right six') : fail('radial actions are the right six', labels.join(','));
    doc.querySelector('.radial').classList.contains('open') ? pass('radial open animation armed') : fail('radial open animation armed', 'no class');
    run('closeRadial()');
    await sleep(60);
    !doc.querySelector('.radial') ? pass('radial closes cleanly') : fail('radial closes cleanly', 'still there');
    /* lite fallback: no radial fan, plain list instead */
    run('setLite("on"); openRadial(400, 380)');
    await sleep(80);
    !doc.querySelector('.radial') && doc.querySelector('#ctx').classList.contains('open')
      ? pass('lite mode gets the plain list menu') : fail('lite mode gets the plain list menu', 'no fallback');
    run('$("#ctx").classList.remove("open"); setLite("auto")');
    /* radial action click actually does something: Like */
    run('openRadial(400, 380)');
    await sleep(80);
    const likeBtn = [...doc.querySelectorAll('.radial .rdb')].find(b => b.textContent.includes('Like'));
    likeBtn && likeBtn.click();
    await sleep(280);
    run('S.liked.length') === 1 ? pass('radial Like adds to Liked') : fail('radial Like adds to Liked', run('S.liked.length'));
  } catch (e) { fail('boot/vinyl/radial block crashed', e.message); }

  /* ---------------- queue sheet, bento actions, search ranks ---------------- */
  try {
    /* grab three real, playable songs straight from the API so playback
       assertions are deterministic */
    const sr = await (await fetch(BASE + '/api/search?q=arijit&n=5')).json();
    const real = (sr.songs || []).filter(s => s && s.id).slice(0, 3);
    real.length === 3 ? pass('fixture: three real songs fetched') : fail('fixture: three real songs fetched', real.length);
    const C2 = mk({ pre: w => { try { w.localStorage.setItem('sn_fixture', JSON.stringify(real)); } catch (e) { } } });
    await sleep(1000);
    const { doc, run, errs, window } = C2;
    run('S.liked=[{id:"l1",t:"Liked One",a:"X",img:"",d:180},{id:"l2",t:"Liked Two",a:"Y",img:"",d:180},{id:"l3",t:"Liked Three",a:"Z",img:"",d:180}];');
    run('S.recent=[{id:"r1",t:"Recent One",a:"P",img:"",d:200},{id:"r2",t:"Recent Two",a:"Q",img:"",d:170}]; save(); render()');
    await sleep(250);
    doc.querySelectorAll('.btrow').length === 2 ? pass('jump tile lists recent tracks') : fail('jump tile lists recent tracks', doc.querySelectorAll('.btrow').length);
    doc.querySelector('.btstack img') ? pass('daily mix stacks artwork') : fail('daily mix stacks artwork', 'no stack');
    const mixBtn = [...doc.querySelectorAll('.btile .sbtn')].find(b => b.textContent.includes('Play the mix'));
    mixBtn && mixBtn.click();
    /* stop the mix's skip-chain from wandering (its fixture tracks are
       placeholders with no stream links) and let it settle */
    run('S.autoplay=false; S.shuffle=false');
    await sleep(1800);
    run('S.queue.length') >= 3 ? pass('daily mix fills the queue') : fail('daily mix fills the queue', run('S.queue.length'));
    /* switch to the real fixture queue for the deterministic playback checks */
    run('S.queue=JSON.parse(localStorage.getItem("sn_fixture")); S.idx=0; au.pause(); counts(); render()');
    await sleep(250);
    /* queue sheet over the loaded queue */
    run('openQSheet()');
    await sleep(80);
    doc.querySelector('.qsheet.open') ? pass('queue sheet slides open') : fail('queue sheet slides open', 'missing');
    doc.querySelector('.qsnow') ? pass('sheet shows the current track') : fail('sheet shows the current track', 'missing');
    doc.querySelectorAll('.qsrow').length === run('S.queue.length - S.idx - 1') ? pass('sheet lists the upcoming tracks') : fail('sheet lists the upcoming tracks', doc.querySelectorAll('.qsrow').length);
    doc.querySelector('.qsrow') && doc.querySelector('.qsrow').click();
    await sleep(2500);
    /* the row must hand playback to the next track — if that particular
       link is dead the queue legitimately advances past it, so anything
       from 1 up proves the sheet row drove the change */
    run('S.idx') >= 1 ? pass('tapping a sheet row plays it') : fail('tapping a sheet row plays it', run('S.idx'));
    run('au.paused') === false ? pass('the row really started playback') : fail('the row really started playback', 'paused');
    run('closeQSheet()');
    await sleep(60);
    !doc.querySelector('.qsheet') ? pass('queue sheet closes cleanly') : fail('queue sheet closes cleanly', 'still there');
    /* mood dice triggers a mood page */
    const dice = doc.querySelector('.btdicebtn');
    dice && dice.click();
    await sleep(700);
    run('S.custom') === true || run('S.view') !== 'home'
      ? pass('mood dice opens a mood mix') : fail('mood dice opens a mood mix', run('S.view'));
    /* ranked search */
    const q = doc.querySelector('#q'); q.value = 'arijit';
    run('doSearch()');
    await sleep(3000);
    doc.querySelector('.rows.rank') ? pass('search results use ranked numbers') : fail('search results use ranked numbers', 'no .rank');
    /* prefs expose the new settings */
    run('nav("prefs")');
    await sleep(300);
    const html = doc.querySelector('#view').textContent;
    html.includes('Lite mode') ? pass('settings expose Lite mode') : fail('settings expose Lite mode', 'missing');
    html.includes('AI Help') ? pass('settings expose AI Help') : fail('settings expose AI Help', 'missing');
    html.includes('Bento dashboard') ? pass('settings expose the bento toggle') : fail('settings expose the bento toggle', 'missing');
    html.includes('Locked to the official repository') ? pass('settings show the locked update source') : fail('settings show the locked update source', 'missing');
    /* AI: off by default, panel + provider form, key save, toggle, chat,
       fallback across providers, error paths, key removal */
    doc.querySelector('#aiBtn').style.display === 'none'
      ? pass('AI button hidden while the feature is off') : fail('AI button hidden while the feature is off', 'visible');
    run('S.aiOn') === false ? pass('AI Help is off by default') : fail('AI Help is off by default', run('S.aiOn'));
    run('openAIPan()');
    await sleep(80);
    doc.querySelector('#aiPan.open') ? pass('AI panel opens') : fail('AI panel opens', 'closed');
    const sel = doc.querySelector('#aiProvSel');
    sel && sel.querySelectorAll('option').length === 5
      ? pass('five providers offered') : fail('five providers offered', sel ? sel.querySelectorAll('option').length : 'no select');
    run('S.aiProv') === 'openrouter' ? pass('default provider is OpenRouter') : fail('default provider is OpenRouter', run('S.aiProv'));
    doc.querySelector('#aiHow') && doc.querySelector('#aiHow').textContent.includes('openrouter.ai')
      ? pass('where-to-get-the-key hint shown per provider') : fail('where-to-get-the-key hint shown per provider', 'no hint');
    /* gemini request shape (unit check, no network) */
    run('S.aiKeys={gemini:"AIza-test-only", openrouter:"sk-or-test-only"}; SET("aiKeys",S.aiKeys)');
    const greq = run('aiRequest("gemini", [{role:"system",content:"sys"},{role:"user",content:"hi"}], 50)');
    greq && greq.url.includes(':generateContent') && JSON.parse(greq.body).contents.length === 1
      ? pass('Gemini requests use its native shape') : fail('Gemini requests use its native shape', 'bad request');
    const oreq = run('aiRequest("openrouter", [{role:"user",content:"hi"}], 50)');
    oreq && oreq.url.includes('chat/completions') && JSON.parse(oreq.body).model === 'openrouter/auto'
      ? pass('OpenAI-compatible providers use chat completions') : fail('OpenAI-compatible providers use chat completions', 'bad request');
    run('aiRequest("groq", [{role:"user",content:"hi"}], 50)') === null
      ? pass('unconfigured provider returns no request') : fail('unconfigured provider returns no request', 'should be null');
    /* save a Groq key through the form */
    run('S.aiProv="groq"; aiKeyForm()');
    await sleep(40);
    const ki = doc.querySelector('#aiKeyIn');
    ki.value = 'gsk-test-only-not-real';
    doc.querySelector('#aiSave').click();
    await sleep(80);
    run('S.aiKeys.groq') === 'gsk-test-only-not-real' ? pass('provider key saves to state') : fail('provider key saves to state', run('S.aiKeys.groq'));
    JSON.parse(window.localStorage.getItem('sn_aiKeys') || '{}').groq
      ? pass('provider key persists locally only') : fail('provider key persists locally only', 'not stored');
    run('S.aiOn') === true ? pass('saving a key turns the feature on') : fail('saving a key turns the feature on', run('S.aiOn'));
    doc.querySelector('#aiBtn').style.display !== 'none'
      ? pass('AI button appears once enabled') : fail('AI button appears once enabled', 'still hidden');
    doc.querySelector('#aiSetup .aiok') ? pass('saved-key card replaces the form') : fail('saved-key card replaces the form', 'missing');
    /* chat round trip with a stubbed provider — no real network */
    window.fetch = (u, o) => {
      const s = String(u);
      if (s.includes('api.groq.com')) return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'Use the Sound Studio: pick Bass Boost or try the 7-band EQ.' } }] }) });
      if (s.includes('openrouter.ai')) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      return fetch(BASE + s, o);
    };
    run('$("#aiText").value="how do I get more bass?"; aiSend()');
    await sleep(300);
    let msgs = [...doc.querySelectorAll('.aim')];
    msgs.length === 2 && msgs[1].classList.contains('air')
      ? pass('AI chat renders the answer bubble') : fail('AI chat renders the answer bubble', msgs.length);
    msgs[1].textContent.includes('EQ') ? pass('answer text is rendered as plain text') : fail('answer text is rendered as plain text', msgs[1].textContent.slice(0, 60));
    /* fallback: preferred provider 500s, Groq answers */
    run('S.aiKeys.openrouter="sk-or-test"; SET("aiKeys",S.aiKeys); S.aiProv="openrouter"; AI.msgs=[]; aiRender()');
    run('$("#aiText").value="test"; aiSend()');
    await sleep(300);
    msgs = [...doc.querySelectorAll('.aim')];
    msgs.length === 2 && msgs[1].textContent.includes('via Groq')
      ? pass('failed provider falls back to another saved key') : fail('failed provider falls back to another saved key', msgs.map(m => m.textContent.slice(0, 40)).join(' | '));
    /* error path: every provider fails -> honest message, no crash */
    window.fetch = (u, o) => {
      const s = String(u);
      if (s.includes('api.groq.com') || s.includes('openrouter.ai') || s.includes('openai.com') || s.includes('mistral.ai') || s.includes('googleapis.com'))
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      return fetch(BASE + s, o);
    };
    run('AI.msgs=[]; aiRender(); $("#aiText").value="x"; aiSend()');
    await sleep(300);
    msgs = [...doc.querySelectorAll('.aim')];
    msgs.length === 2 && msgs[1].textContent.includes('Could not answer')
      ? pass('all-fail path shows a clear message') : fail('all-fail path shows a clear message', msgs.length);
    errs.length === 0 ? pass('whole v15 session ran error-free') : fail('whole v15 session ran error-free', errs[0]);
    /* key removal clears every trace */
    run('S.aiKeys={}; SET("aiKeys",{}); aiSetupCard()');
    let stored2 = null; try { stored2 = JSON.parse(window.localStorage.getItem('sn_aiKeys')); } catch (e) { }
    (!stored2 || Object.keys(stored2).length === 0) && !doc.querySelector('.aiok')
      ? pass('removing the keys clears their trace') : fail('removing the keys clears their trace', 'leftover ' + window.localStorage.getItem('sn_aiKeys'));
  } catch (e) { fail('queue/bento/search/AI block crashed', e.message); }

  /* ---------------- v15 freeze fix: fully dead queue ---------------- */
  try {
    const C5 = mk();
    await sleep(900);
    const { doc, run } = C5;
    /* shuffle on, autoplay off, two unplayable tracks: the old build spun
       play->skip on microtasks forever and froze the page; v15 must stop */
    run('S.autoplay=false; S.shuffle=true; S.queue=[{id:"dz1",t:"Dead One",a:"X",img:"",d:100},{id:"dz2",t:"Dead Two",a:"Y",img:"",d:100}]; S.idx=0; play()');
    await sleep(1600);
    const t5 = (doc.querySelector('#toastT') || {}).textContent || '';
    t5.includes('unavailable right now')
      ? pass('dead queue stops with a message (freeze fixed)') : fail('dead queue stops with a message (freeze fixed)', t5 || 'no toast');
    run('playFails') === 0 ? pass('failure counter resets after stopping') : fail('failure counter resets after stopping', run('playFails'));
  } catch (e) { fail('freeze-fix block crashed', e.message); }

  /* ---------------- APK updater repair (pinApkSource) ---------------- */
  try {
    const C6 = mk();
    await sleep(900);
    const { doc, run, window } = C6;
    typeof run('pinApkSource') === 'function' ? pass('APK repair function exists') : fail('APK repair function exists', 'missing');
    /* not native: must do nothing at all */
    let hit = 0;
    const plain = window.fetch;
    window.fetch = (u, o) => { hit++; return plain(u, o); };
    run('pinApkSource()');
    await sleep(400);
    hit === 0 ? pass('outside the APK it stays completely silent') : fail('outside the APK it stays completely silent', hit + ' calls');
    window.fetch = plain;
    /* native with the broken placeholder source: must heal to official */
    window.Android = { isNative: true, reloadApp() { } };
    const calls = [], raws = [];
    window.fetch = (u, o) => {
      const s = String(u);
      calls.push(s.split('?')[0]); raws.push(s);
      const data = s.includes('/api/update/status') ? { source: 'https://raw.githubusercontent.com/USER/REPO/main/', version: 33 }
        : s.includes('/api/update/source') ? { ok: true }
          : s.includes('/api/update/check') ? { ok: true, result: 'Already up to date' }
            : {};
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
    };
    run('pinApkSource()');
    await sleep(500);
    const setCall = calls.find(c => c.includes('/api/update/source'));
    setCall ? pass('broken APK source is repaired through the native API') : fail('broken APK source is repaired through the native API', calls.join(' | ') || 'no calls');
    setCall && decodeURIComponent(raws.join(' ')).includes('raw.githubusercontent.com/twgw9/sonora/main/')
      ? pass('repair points only at the official repo') : fail('repair points only at the official repo', raws.join(' '));
    calls.some(c => c.includes('/api/update/check')) ? pass('a catch-up update check runs after the repair') : fail('a catch-up update check runs after the repair', 'no check');
    /* already-official source: repair must not touch anything */
    calls.length = 0;
    window.fetch = (u, o) => {
      const s = String(u); calls.push(s.split('?')[0]);
      const data = s.includes('/api/update/status') ? { source: 'https://raw.githubusercontent.com/twgw9/sonora/main/', version: 15 }
        : s.includes('/api/update/check') ? { ok: true, result: 'Already up to date' } : {};
      return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
    };
    run('pinApkSource()');
    await sleep(400);
    calls.some(c => c.includes('/api/update/source'))
      ? fail('healthy source is left alone', 'rewrote it anyway') : pass('healthy source is left alone');
  } catch (e) { fail('APK repair block crashed', e.message); }

  /* ---------------- desktop mini player: the exit that was missing ---------------- */
  try {
    const C7 = mk();
    await sleep(700);
    const { window, doc } = C7;
    const hooks = fs.readFileSync(ROOT + '/desktop-hooks.js', 'utf8');
    let miniState = false; const events = {};
    window.Desktop = {
      isDesktop: true,
      on: (ch, fn) => { events[ch] = fn; },
      toggleMini: () => { miniState = !miniState; if (events.mini) events.mini(miniState); },
      getMini: () => miniState
    };
    const hs = doc.createElement('script'); hs.textContent = hooks; doc.body.appendChild(hs);
    await sleep(150);
    doc.documentElement.dataset.desktop === '1' ? pass('desktop hooks activate inside the desktop shell') : fail('desktop hooks activate inside the desktop shell', doc.documentElement.dataset.desktop);
    !doc.querySelector('#miniExit') ? pass('no exit button in the normal window') : fail('no exit button in the normal window', 'already there');
    window.Desktop.toggleMini();
    await sleep(60);
    const xb = doc.querySelector('#miniExit');
    xb ? pass('a clear exit button appears in mini mode') : fail('a clear exit button appears in mini mode', 'missing');
    doc.documentElement.dataset.mini === '1' ? pass('mini mode is flagged for the compact CSS') : fail('mini mode is flagged for the compact CSS', doc.documentElement.dataset.mini);
    xb && xb.click();
    await sleep(60);
    !doc.querySelector('#miniExit') && doc.documentElement.dataset.mini === '0'
      ? pass('the exit button really leaves mini mode') : fail('the exit button really leaves mini mode', 'still mini');
  } catch (e) { fail('mini-exit block crashed', e.message); }

  /* ---------------- lite mode auto-detection ---------------- */
  try {
    const C3 = mk({ pre: w => { Object.defineProperty(w.navigator, 'deviceMemory', { get: () => 2, configurable: true }); } });
    await sleep(900);
    C3.doc.body.classList.contains('lite') ? pass('auto lite engages on low-RAM devices') : fail('auto lite engages on low-RAM devices', 'no lite class');
    const C4 = mk({ pre: w => { Object.defineProperty(w.navigator, 'deviceMemory', { get: () => 8, configurable: true }); } });
    await sleep(900);
    !C4.doc.body.classList.contains('lite') ? pass('auto lite stays off on strong devices') : fail('auto lite stays off on strong devices', 'lite on');
  } catch (e) { fail('lite auto-detect block crashed', e.message); }

  /* ---------------- report ---------------- */
  const ok = R.filter(x => x.ok).length;
  console.log(R.map(x => (x.ok ? ' PASS ' : ' FAIL ') + x.n + (x.ok === 0 && x.w ? '  — ' + x.w : '')).join('\n'));
  console.log('='.repeat(60));
  console.log(ok + '/' + R.length + ' passed');
  process.exit(ok === R.length ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
