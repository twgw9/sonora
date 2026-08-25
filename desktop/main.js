/* =====================================================================
   Sonora Desktop — Electron shell.

   Runs the real server.js in-process, so the desktop build gets everything
   the hosted build has, including listening rooms. Adds native window
   controls, global media keys, a tray icon, and desktop-only niceties.
   ===================================================================== */
'use strict';
const { app, BrowserWindow, Menu, Tray, shell, globalShortcut, ipcMain, dialog, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 8732;
let win = null, tray = null, server = null, serverReady = false;
let quitting = false;
/* Windows taskbar / toast identity — without this the notification and the
   taskbar group the window under "electron" instead of Sonora. */
if (process.platform === 'win32') app.setAppUserModelId('com.sonora.player');

/* ---------- single instance ---------- */
if (!app.requestSingleInstanceLock()) { app.quit(); }
else app.on('second-instance', (_e, argv) => {
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  const deep = argv.find(a => a.startsWith('sonora://'));
  if (deep && win) openDeepLink(deep);
});

/* ---------- start the bundled backend ---------- */
function startServer() {
  return new Promise(resolve => {
    process.env.PORT = String(PORT);
    process.env.NODE_ENV = 'production';
    process.env.SONORA_ROOT = path.join(__dirname, 'web');
    try {
      require(path.join(__dirname, 'server', 'server.js'));
    } catch (e) {
      console.error('server failed to start', e);
      return resolve(false);
    }
    // wait until it answers
    const t0 = Date.now();
    const ping = () => {
      http.get({ host: '127.0.0.1', port: PORT, path: '/healthz', timeout: 1500 }, r => {
        r.resume(); serverReady = true; resolve(true);
      }).on('error', () => {
        if (Date.now() - t0 > 12000) return resolve(false);
        setTimeout(ping, 200);
      });
    };
    setTimeout(ping, 250);
  });
}

/* ---------- window ---------- */
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 380, minHeight: 520,
    backgroundColor: '#07090a',
    title: 'Sonora',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => { win.show(); });
  win.loadURL(`http://127.0.0.1:${PORT}/`);

  // external links open in the real browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) { e.preventDefault(); shell.openExternal(url); }
  });

  // downloads land in the user's Downloads folder with a clear name
  win.webContents.session.on('will-download', (_e, item) => {
    const name = item.getFilename() || 'track.m4a';
    item.setSavePath(path.join(app.getPath('downloads'), name));
    item.once('done', (_ev, state) => {
      if (win && !win.isDestroyed())
        win.webContents.send('download-done', { name, ok: state === 'completed' });
    });
  });

  let closeHinted = false;
  win.on('close', e => {
    if (quitting || process.platform !== 'win32') return;
    // keep playing in the tray on Windows
    e.preventDefault(); win.hide();
    // say it once so closing never looks like the app vanished
    if (!closeHinted) { closeHinted = true;
      try { new Notification({ title: 'Sonora is still playing', body: 'It stays in the tray — right-click the tray icon to quit.' }).show(); }
      catch (err) { }
    }
  });
  win.on('closed', () => { win = null; });
}

/* ---------- tray ---------- */
function createTray() {
  const p = path.join(__dirname, 'assets', 'icon.png');
  if (!fs.existsSync(p)) return;
  try {
    tray = new Tray(nativeImage.createFromPath(p).resize({ width: 18, height: 18 }));
    tray.setToolTip('Sonora');
    const menu = Menu.buildFromTemplate([
      { label: 'Show Sonora', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: 'Play / Pause', click: () => send('media', 'toggle') },
      { label: 'Next track', click: () => send('media', 'next') },
      { label: 'Previous track', click: () => send('media', 'prev') },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => { if (win) { win.isVisible() ? win.hide() : (win.show(), win.focus()); } });
  } catch (e) { }
}

const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };

/* ---------- menu ---------- */
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Search', accelerator: 'CmdOrCtrl+F', click: () => send('focus-search') },
        { label: 'Command palette', accelerator: 'CmdOrCtrl+K', click: () => send('palette') },
        { type: 'separator' },
        isMac ? { role: 'close' }
          : { label: 'Close window (keeps playing)', click: () => { if (win) win.close(); } },
        { label: 'Quit Sonora', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        { label: 'Play / Pause', accelerator: 'Space', click: () => send('media', 'toggle') },
        { label: 'Next', accelerator: 'CmdOrCtrl+Right', click: () => send('media', 'next') },
        { label: 'Previous', accelerator: 'CmdOrCtrl+Left', click: () => send('media', 'prev') },
        { type: 'separator' },
        { label: 'Volume up', accelerator: 'CmdOrCtrl+Up', click: () => send('media', 'volup') },
        { label: 'Volume down', accelerator: 'CmdOrCtrl+Down', click: () => send('media', 'voldown') },
        { type: 'separator' },
        { label: 'Toggle sound mode', accelerator: 'CmdOrCtrl+E', click: () => send('media', 'quick') },
        { label: 'Full screen player', accelerator: 'CmdOrCtrl+P', click: () => send('media', 'fullscreen') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Always on top', type: 'checkbox', click: m => { if (win) win.setAlwaysOnTop(m.checked); } },
        { label: 'Mini player', accelerator: 'CmdOrCtrl+M', click: () => toggleMini() }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for updates', click: () => { checkForUpdate('manual'); send('checking'); } },
        { label: 'Keyboard shortcuts', click: () => send('shortcuts') },
        { label: 'Open downloads folder', click: () => shell.openPath(app.getPath('downloads')) },
        { type: 'separator' },
        { label: 'About Sonora', click: () => dialog.showMessageBox(win, {
            type: 'info', title: 'Sonora',
            message: 'Sonora ' + app.getVersion(),
            detail: 'A music player with a real seven-band equaliser, sixteen studio sound modes, '
                  + 'offline downloads and synced listening rooms.\n\nEverything is stored on this computer.'
          }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- mini player ---------- */
let miniOn = false, prevBounds = null;
function toggleMini() {
  if (!win) return;
  miniOn = !miniOn;
  if (miniOn) {
    prevBounds = win.getBounds();
    win.setBounds({ width: 420, height: 640 });
    win.setAlwaysOnTop(true);
  } else {
    win.setAlwaysOnTop(false);
    /* if the previous size was lost (restart, crash), fall back to the
       standard window instead of leaving the app trapped small */
    win.setBounds(prevBounds || { width: 1280, height: 820 });
  }
  send('mini', miniOn);
}

/* ---------- deep links ---------- */
function openDeepLink(url) {
  try {
    const u = new URL(url);
    const room = u.searchParams.get('room') || u.hostname;
    if (room && win) win.loadURL(`http://127.0.0.1:${PORT}/?room=${encodeURIComponent(room)}`);
  } catch (e) { }
}
app.on('open-url', (e, url) => { e.preventDefault(); openDeepLink(url); });

/* ---------- ask the bundled server to pull a newer interface ---------- */
function checkForUpdate(tag) {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/selfupdate/run', timeout: 60000 }, r => {
    let body = '';
    r.on('data', c => body += c);
    r.on('end', () => {
      try {
        const d = JSON.parse(body);
        if (d && d.ok && d.reload) {
          console.log('[update] ' + tag + ': ' + d.msg);
          if (win && !win.isDestroyed()) {
            win.webContents.send('updated', d.msg || 'Updated');
            setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 1500);
          }
        }
      } catch (e) { }
    });
  });
  req.on('error', () => { });
  req.on('timeout', () => req.destroy());
}

/* ---------- lifecycle ---------- */
app.whenReady().then(async () => {
  try { app.setAsDefaultProtocolClient('sonora'); } catch (e) { }
  const ok = await startServer();
  if (!ok) {
    dialog.showErrorBox('Sonora', 'The internal service could not start.\nTry restarting the app.');
  }
  createWindow();
  buildMenu();
  createTray();

  // look for a newer interface shortly after launch, then every six hours
  setTimeout(() => checkForUpdate('launch'), 9000);
  setInterval(() => checkForUpdate('scheduled'), 6 * 60 * 60 * 1000);

  // global media keys work even when Sonora is not focused
  const keys = [
    ['MediaPlayPause', 'toggle'], ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'prev'], ['MediaStop', 'pause']
  ];
  keys.forEach(([k, a]) => { try { globalShortcut.register(k, () => send('media', a)); } catch (e) { } });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else if (win) win.show(); });
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

/* ---------- ipc from the page ---------- */
ipcMain.handle('sonora:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  desktop: true,
  downloads: app.getPath('downloads')
}));
ipcMain.handle('sonora:openDownloads', () => shell.openPath(app.getPath('downloads')));
ipcMain.handle('sonora:mini', () => { toggleMini(); return miniOn; });
ipcMain.handle('sonora:mini-state', () => miniOn);
ipcMain.on('sonora:progress', (_e, frac) => {
  if (win && !win.isDestroyed()) win.setProgressBar(frac > 0 && frac < 1 ? frac : -1);
});
ipcMain.on('sonora:title', (_e, t) => { if (win && !win.isDestroyed()) win.setTitle(t ? t + ' — Sonora' : 'Sonora'); });
