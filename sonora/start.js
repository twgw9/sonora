/* Supervisor — keeps Sonora alive forever.
   If the worker ever exits (OOM, upstream fault, anything), it is respawned
   with exponential backoff. Render/systemd/PM2-free. */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

let delay = 400, child = null, stopping = false, lastOk = Date.now();

/* Watchdog: if the worker stops answering /healthz for 45s it is killed and
   respawned. Covers hangs that never produce an exit event. */
setInterval(async () => {
  if (stopping || !child) return;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/healthz`, { signal: c.signal });
    clearTimeout(t);
    if (r.ok) { lastOk = Date.now(); return; }
  } catch (e) {}
  if (Date.now() - lastOk > 45000) {
    console.error('[supervisor] worker unresponsive for 45s — restarting');
    lastOk = Date.now();
    try { child.kill('SIGKILL'); } catch (e) {}
  }
}, 15000);
function boot() {
  child = spawn(process.execPath,
    ['--openssl-legacy-provider', '--max-old-space-size=400', path.join(__dirname, 'server.js')],
    { stdio: 'inherit', env: process.env });

  child.on('exit', (code, sig) => {
    if (stopping) return;
    console.error(`[supervisor] worker exited code=${code} signal=${sig} — restarting in ${delay}ms`);
    setTimeout(boot, delay);
    delay = Math.min(delay * 2, 10000);
  });
  child.on('error', e => console.error('[supervisor] spawn error', e.message));
  setTimeout(() => { delay = 400; }, 30000);   // healthy for 30s → reset backoff
}
['SIGTERM', 'SIGINT'].forEach(s => process.on(s, () => {
  stopping = true; if (child) child.kill(s); setTimeout(() => process.exit(0), 3000);
}));
boot();
