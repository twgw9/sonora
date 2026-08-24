/* Prove the GitHub Release fallback works, without needing a real release.
   A fake api.github.com is stood up on 127.0.0.1, server.js is pointed at it,
   and we check the download list switches to release URLs when downloads/ is
   empty, and back to local files when it is not. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = '/home/user/sonora';
const PORT = 3199;
const GH = 3198;

// fake GitHub API + fake asset host
const assets = [
  { name: 'SonoraSetup.exe', size: 70000358 },
  { name: 'Sonora-1.0.0-mac.zip', size: 95300000 },
  { name: 'Sonora-1.0.0.AppImage', size: 73793645 },
  { name: 'sonora-desktop_1.0.0_amd64.deb', size: 66434662 },
  { name: 'Sonora.apk', size: 2889129 }
];
const gh = http.createServer((req, res) => {
  if (req.url.startsWith('/repos/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      tag_name: 'v3',
      assets: assets.map(a => ({
        name: a.name, size: a.size,
        browser_download_url: 'http://127.0.0.1:' + GH + '/dl/' + a.name
      }))
    }));
  }
  if (req.url.startsWith('/dl/')) {
    const nm = decodeURIComponent(req.url.slice(4));
    const a = assets.find(x => x.name === nm);
    if (!a) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Length': String(a.size) });
    return res.end();               // HEAD-style; body not needed for the test
  }
  res.writeHead(404); res.end();
});

let P = 0, F = 0;
const pass = (n, d) => { P++; console.log(' PASS ', n, d ? ' — ' + d : ''); };
const fail = (n, d) => { F++; console.log(' FAIL ', n, d ? ' — ' + d : ''); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => gh.listen(GH, '127.0.0.1', r));

  // point server.js at the fake GitHub by rewriting the api host
  const orig = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const patched = orig.replace("'https://api.github.com/repos/'",
                               "'http://127.0.0.1:" + GH + "/repos/'");
  if (patched === orig) { fail('could patch the api host'); process.exit(1); }
  const tmp = '/tmp/server-ghtest.js';
  fs.writeFileSync(tmp, patched);

  // run it from a copy of the tree with an EMPTY downloads/
  const stage = '/tmp/ghstage';
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage + '/downloads', { recursive: true });
  fs.mkdirSync(stage + '/apk', { recursive: true });
  for (const f of ['index.html', 'app.js', 'styles.css', 'sw.js', 'logo.svg',
                   'icon.svg', 'manifest.webmanifest', 'robots.txt',
                   'version.json']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(stage, f));
  }
  fs.copyFileSync(tmp, stage + '/server.js');

  const child = spawn(process.execPath, ['--openssl-legacy-provider', 'server.js'],
    { cwd: stage, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await sleep(1500);

  const get = async () => (await fetch('http://127.0.0.1:' + PORT + '/api/downloads')).json();

  try {
    // ---- empty downloads/ : everything should come from the release ----
    let d = await get();
    const b = d.builds || [];
    b.length === 5 ? pass('empty downloads/ still offers every platform', b.length + ' builds')
      : fail('empty downloads/ still offers every platform', b.length + ' builds');

    const remote = b.filter(x => /^https?:/.test(x.file));
    remote.length === 5 ? pass('all five come from the release')
      : fail('all five come from the release', remote.length + ' remote');

    const win = b.find(x => x.os === 'windows');
    win && /SonoraSetup\.exe$/.test(win.file) && win.size === '66.8 MB'
      ? pass('Windows points at the release asset', win.size)
      : fail('Windows points at the release asset', win && win.file);

    const mac = b.find(x => x.os === 'mac');
    mac && /mac\.zip$/i.test(mac.file) ? pass('macOS zip recognised as a mac build', mac.ext)
      : fail('macOS zip recognised as a mac build', mac && mac.file);

    // the advertised release URLs must actually resolve
    let okAll = true;
    for (const x of b) {
      const r = await fetch(x.file, { method: 'HEAD' });
      if (!r.ok) { okAll = false; fail('release url resolves: ' + x.os, r.status); }
    }
    if (okAll) pass('every release url resolves', b.length + ' checked');

    // ---- now drop a real local file in : it must win ----
    fs.writeFileSync(stage + '/downloads/SonoraSetup.exe', Buffer.alloc(5 * 1024 * 1024));
    // the release list is cached for an hour, but the local scan is per request
    d = await get();
    const win2 = (d.builds || []).find(x => x.os === 'windows');
    win2 && win2.file === '/downloads/SonoraSetup.exe'
      ? pass('a local build overrides the release', win2.size)
      : fail('a local build overrides the release', win2 && win2.file);

    const mac2 = (d.builds || []).find(x => x.os === 'mac');
    mac2 && /^https?:/.test(mac2.file)
      ? pass('the other platforms still come from the release')
      : fail('the other platforms still come from the release', mac2 && mac2.file);

  } catch (e) {
    fail('fallback test ran', e.message);
  } finally {
    child.kill('SIGKILL');
    gh.close();
  }

  console.log('='.repeat(60));
  console.log(P + '/' + (P + F) + ' passed');
  process.exit(F ? 1 : 0);
})();
