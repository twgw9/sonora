# One-time setup

Three pieces: a repo, a Render deploy, and the apps. Twenty minutes total,
and after that every change ships with one command.

---

## 1. Put it on GitHub

```bash
cd sonora
git init
git add .
git commit -m "Sonora"
git branch -M main
git remote add origin https://github.com/YOURNAME/sonora.git
git push -u origin main
```

Make the repo **public** — updates are fetched from `raw.githubusercontent.com`,
which needs no auth for public repos.

---

## 2. Deploy to Render (this is what powers rooms)

1. <https://render.com> → sign in with GitHub → **New +** → **Blueprint**
2. Pick the `sonora` repo → **Apply**

`render.yaml` fills in the rest. Two minutes later you have:

```
https://sonora-xxxx.onrender.com
```

That address is:
- the website anyone can open
- the **room server** for every device
- the download page for the apps

### Point the deploy at your repo, so it updates itself

Open your Render URL → **Get the App** → *Automatic updates* → paste:

```
https://raw.githubusercontent.com/YOURNAME/sonora/main/
```

The server now pulls new interface files on boot and whenever you press
**Update now**. Render also redeploys on every push, so you get both.

---

## 3. The apps

### Android

`apk/Sonora.apk` → copy to the phone → tap → allow unknown sources → install.

Then, once, in the app: **Settings → Rooms → Room server**, paste your Render
address. Rooms now work on the phone exactly like the website.

The Android app also updates itself: **Settings → Updates → Update source**,
same raw GitHub URL.

### Windows, macOS, Linux

```bash
cd desktop && ./build.sh
```

Installers land in `dist/` and appear on the **Get the App** page automatically.
The desktop build runs the real server inside itself, so rooms work with no
setup — though pointing it at your Render deploy lets desktop and phone share
the same rooms.

---

## Shipping a change

```bash
./release.sh "what changed"
```

That runs a syntax check, bumps `version.json`, commits and pushes. Then:

| Where | How it updates |
|---|---|
| Render / website | Redeploys on push, and self-updates from Git |
| Android app | Silent check on launch, or Settings → Updates |
| Desktop app | Get the App → Update now, or install a new build |

Only native changes (the Java server, the Electron shell) need a rebuilt
APK or installer.

---

## Which build has what

| | Web / Render | Desktop | Android |
|---|---|---|---|
| Equaliser, 16 modes, quality | yes | yes | yes |
| Downloads, lyrics, playlists | yes | yes | yes |
| Listening rooms | yes | yes | with a room server |
| Self-update from Git | yes | yes | yes |
| Global media keys, tray, mini player | — | yes | — |
| Playback notification | — | — | yes |

---

## Rolling back a bad release

**Website / desktop:** Get the App → the update block → the server keeps a
`.backup` of the last good files; call `/api/selfupdate/rollback` or press
Rollback.

**Android:** Settings → Updates → *Revert to bundled version*.

Both put every device back to a working build immediately, then you fix and
`./release.sh` again.
