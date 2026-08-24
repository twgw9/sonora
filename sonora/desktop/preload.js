/* Bridge between the Electron shell and the Sonora page. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('Desktop', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('sonora:info'),
  openDownloads: () => ipcRenderer.invoke('sonora:openDownloads'),
  toggleMini: () => ipcRenderer.invoke('sonora:mini'),
  setProgress: f => ipcRenderer.send('sonora:progress', f),
  setTitle: t => ipcRenderer.send('sonora:title', t),
  on: (channel, fn) => {
    const allowed = ['media', 'focus-search', 'palette', 'shortcuts', 'mini', 'download-done', 'updated', 'checking'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_e, payload) => { try { fn(payload); } catch (e) { } });
  }
});
