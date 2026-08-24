# How updating works

Short answer: **you push to GitHub, everything else updates itself.**

Nobody — not you, not the people using it — ever types an address. The repo
`github.com/twgw9/sonora` is already baked into every build.

---

## The one command

```bash
./release.sh "what changed"
```

That is it. The script:

1. runs a syntax check, so a broken build can never ship
2. works out the raw GitHub address from your `git remote`
3. writes it into `version.json`, `update.json` and the Android source
4. bumps the version number
5. refreshes the copies inside the desktop and Android bundles
6. commits and pushes

---

## Who checks, and when

| | Checks on | Then every |
|---|---|---|
| Website / Render | boot | 30 minutes |
| Desktop app | 9 s after launch | 6 hours |
| Android app | 4 s after launch | 6 hours |

All three also have a **Check now** button under *Get the App → Updates*, and the
desktop app has **Help → Check for updates**.

Render additionally redeploys on every push, so the website gets it twice over.

---

## How each build knows where to look

It tries these in order and stops at the first that answers:

1. an address someone typed in *Change source*
2. `source` in `version.json` — written by `release.sh`
3. the `SONORA_UPDATE_URL` environment variable
4. `RENDER_GIT_REPO_URL`, which Render sets automatically

The Android app has the same address compiled into `Updater.java`.

So a fresh Render deploy or a freshly installed APK is already pointed at your
repo with **zero configuration**.

---

## What actually gets updated

The interface: `index.html`, `app.js`, `styles.css`, `native.js`, `logo.svg`,
`icon.svg`. That covers almost everything — layout, colours, themes, sound modes,
EQ curves, new pages, bug fixes.

**A rebuild is only needed for native code:**

| Change | Needs |
|---|---|
| Anything in `app.js`, `styles.css`, `index.html` | just `./release.sh` |
| `server.js` | `./release.sh` (web/desktop pick it up on redeploy) |
| `android/.../*.java` | `./build-apk.sh` and send the new APK |
| `desktop/main.js`, `preload.js` | `cd desktop && ./build.sh` |

---

## Safety

- Files download to `.tmp` copies, then swap in together — a dropped connection
  cannot leave a half-written app
- If `index.html` or `app.js` come back too small, the update is rejected and the
  old version stays
- `minApk` in `version.json` stops a web update that needs newer native code from
  landing on an old build
- The server keeps a `.backup` of the last good files

**If a release breaks something:** *Get the App → Updates → Roll back*. Every
device returns to the last working version immediately. Fix it, then release
again.

---

## Seeing what is going on

*Get the App → Updates* shows:

- the interface version currently running
- the source, as a readable pill: `github.com/twgw9/sonora/main`
- when it last checked
- **Check now**, **Change source**, **Roll back**

The server also logs `[ota] boot: Updated to v7` when it pulls something.

---

## First-time setup, once

```bash
cd sonora
git init
git add .
git commit -m "Sonora"
git branch -M main
git remote add origin https://github.com/twgw9/sonora.git
git push -u origin main
```

Keep the repo **public** — `raw.githubusercontent.com` needs no auth for public
repos, and that is what the apps read.

After that, forever: edit files → `./release.sh "notes"` → done.
