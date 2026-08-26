# Sonora Desktop

Windows, macOS and Linux. The real `server.js` runs inside the app, so the
desktop build has **everything the website has, including listening rooms**.

---

## Build

```bash
cd desktop
./build.sh              # everything this machine can produce
./build.sh linux        # AppImage + deb
./build.sh win          # Windows
./build.sh mac          # DMG (only on a Mac)
```

Finished installers land in `desktop/out/` and are copied to `../dist/`, which
is what the website's **Get the App** page serves.

### Cross-building notes

| Building on | Can produce |
|---|---|
| Linux | Linux (AppImage, deb) and Windows (zip) |
| Linux **with wine** | Windows installer with a custom icon too |
| macOS | macOS, plus Linux and Windows |
| Windows | Windows, plus Linux |

macOS DMGs can only be built on a Mac — Apple's tooling is not redistributable.

---

## Run it without packaging

```bash
cd desktop
npm install
npm start
```

---

## What the desktop build adds

- **Global media keys** — play/pause, next, previous work even when Sonora is
  not the focused window
- **Taskbar progress** — the dock or taskbar icon fills as the track plays
- **Tray icon** — closing the window on Windows keeps playback going; the tray
  menu has transport controls
- **Mini player** — `Ctrl/Cmd+M` shrinks to a 420px always-on-top window
- **Native menu** — Playback, View, Help, with proper accelerators
- **Downloads** go straight to your Downloads folder, no save dialog
- **`sonora://` links** open the app and join the room
- **Single instance** — launching again focuses the existing window
- **Listening rooms work**, unlike the phone build

---

## Layout

```
desktop/
  main.js          Electron shell: window, menu, tray, media keys, IPC
  preload.js       the small bridge exposed to the page as window.Desktop
  server/          a copy of the project's server.js, run in-process
  web/             a copy of the interface
  assets/icon.png  app icon
  build.sh         sync, build, publish to ../dist
```

`build.sh` re-copies `web/` and `server/` from the project root every time, so
the desktop app can never drift from the website.

---

## Updating

Change `app.js`, `styles.css` or `index.html` in the project root, then
`./build.sh`. Users install the new build over the old one; their library is
untouched because it lives in the app's own storage.
