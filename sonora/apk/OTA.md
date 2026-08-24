# Update the app from Git

Push to GitHub, phones update themselves. No new APK, no reinstall, no Play Store.

---

## Why this works

Sonora's interface is just five files — `index.html`, `app.js`, `styles.css`,
`native.js`, `logo.svg`. The app checks your repo on launch, downloads them if
they are newer, and serves those instead of the copies baked into the APK.

Anything you can change in the browser build ships this way: layout, colours,
themes, sound modes, EQ curves, new pages, bug fixes.

**A new APK is only needed for native changes** — the local server, the
notification, the back button. Those are rare.

---

## One-time setup

### 1. Put the project on GitHub

```bash
cd sonora
git init
git add .
git commit -m "Sonora"
git branch -M main
git remote add origin https://github.com/YOURNAME/sonora.git
git push -u origin main
```

A **public** repo is simplest — `raw.githubusercontent.com` serves it with no
auth. A private repo will not work without a token.

### 2. Point the app at it

Open Sonora on the phone → **Settings → Updates → Update source**, paste:

```
https://raw.githubusercontent.com/YOURNAME/sonora/main/
```

Trailing slash matters. Tap **Check now** — it should say *Already up to date*.

You can also bake the URL in so nobody has to type it: edit
`android/app/src/main/java/com/sonora/player/Updater.java`, set
`DEFAULT_BASE`, and rebuild once with `./build-apk.sh`.

---

## Shipping an update

Edit `app.js` / `styles.css` / `index.html`, then:

```bash
./release.sh "dark theme fixes and a new EQ preset"
```

That script:
1. runs `node --check app.js` so a syntax error never ships
2. bumps `version.json`
3. commits and pushes

Every installed app picks it up **on its next launch** (a silent check runs four
seconds in), or instantly from **Settings → Updates → Check now**.

---

## What the phone does

- Downloads to temp files first, then swaps them in — a dropped connection
  cannot leave a half-written app
- Refuses the update if `index.html` or `app.js` come back too small
- Honours `minApk` in `version.json`, so a web update that needs newer native
  code will not install on an old APK
- Keeps the bundled copies forever; **Settings → Updates → Revert** restores them

---

## version.json

```json
{
  "version": 4,
  "minApk": 1,
  "notes": "New Sakura theme",
  "date": "2026-08-23"
}
```

| Field | Meaning |
|---|---|
| `version` | Bump to release. `release.sh` does it for you. |
| `minApk` | Lowest APK `versionCode` allowed. Raise it only when the web files start needing a new native feature. |
| `notes` | Shown in Settings after updating. |

---

## Other hosts

Anything that serves raw files over HTTPS works. Set the source to:

| Host | URL shape |
|---|---|
| GitHub | `https://raw.githubusercontent.com/USER/REPO/main/` |
| GitLab | `https://gitlab.com/USER/REPO/-/raw/main/` |
| Your Render deploy | `https://sonora-xxxx.onrender.com/` |
| jsDelivr (CDN, faster) | `https://cdn.jsdelivr.net/gh/USER/REPO@main/` |

jsDelivr caches for a while; GitHub raw is immediate.

---

## When you do need a new APK

Only for native changes:

- `LocalServer.java` — the JioSaavn bridge, DES decryption, audio proxy
- `MainActivity.java` — WebView setup, back button, JS bridge
- `PlaybackService.java` — the playback notification
- permissions, app name, launcher icon

Then it is the old routine:

```bash
./build-apk.sh
# send apk/Sonora.apk to the phone
```

Installing over the top keeps everyone's library.

---

## Troubleshooting

**"No update source configured"** — the source is still the placeholder. Set it
in Settings → Updates.

**"Could not reach the update source"** — wrong URL, private repo, or no
internet. Open the URL + `version.json` in a browser; you should see the JSON.

**"Already up to date" after pushing** — you bumped nothing. Use `./release.sh`,
or raise `version` in `version.json` by hand. GitHub raw can also lag a few
seconds.

**Update applied but nothing changed** — the app reloads itself automatically;
if you were mid-screen, force-close and reopen.

**Broke something in production** — Settings → Updates → **Revert to bundled
version** gets every phone back to the APK's own copy. Then fix, and
`./release.sh` again.
