# Get a public link for Sonora — 5 minutes

The sandbox preview URL only works for you (it needs an access token).
To get a link you can send to friends, deploy to Render. It is free.

---

## Step 1 — Put the code on GitHub

The repository is already initialised and committed, so this is one push.

```bash
cd sonora
git remote add origin https://github.com/YOURNAME/sonora.git
git push -u origin main
```

If GitHub asks for a password, it wants a token, not your account password:
<https://github.com/settings/tokens> → **Generate new token (classic)** → tick
**repo** → paste the token as the password.

The repo is 54 files and about 3 MB. Two things are deliberately left out:

- **`apk/sonora-signing.jks`** — the Android signing key. Anyone who has it can
  sign a fake Sonora update that installs over yours. Back it up privately.
- **The desktop installers** — 60 to 90 MB each. GitHub warns above 50 MB and
  refuses above 100 MB, so they go to a Release instead. See Step 3.

## Step 2 — Deploy on Render

1. Go to <https://render.com> and sign in with GitHub (free, no card)
2. Click **New +** → **Blueprint**
3. Pick your `sonora` repository → **Connect**
4. Render reads `render.yaml` and fills everything in → click **Apply**
5. Wait about two minutes

If Blueprint is not offered, use **New + → Web Service** and set:

| Field | Value |
|---|---|
| Runtime | Node |
| Build command | *(leave empty)* |
| Start command | `node start.js` |
| Health check path | `/healthz` |
| Instance type | Free |

Then Environment → add `NODE_VERSION` = `20`.

## Step 3 — Your link

Render gives you something like:

```
https://sonora-xxxx.onrender.com
```

That is the link to share. It works on any phone or computer, anywhere.

## Step 4 — Put the desktop installers on the site

Straight after deploying, the Get the App page will offer **Android only**. The
Windows, macOS and Linux builds are too large to live in the repository, so
they are uploaded to a GitHub Release and the server links to them from there.

```bash
cd desktop && ./build.sh     # builds Windows, macOS and Linux
cd .. && ./publish.sh        # uploads them to a GitHub Release
```

`publish.sh` needs the GitHub CLI, signed in once with `gh auth login`.

Nothing else to configure. `server.js` reads the repository address out of
`version.json`, asks GitHub for the latest release, and lists whichever assets
it finds. The page updates itself within the hour, or instantly on redeploy.

A local file always wins over a release asset, so a machine that has actually
built the installers serves its own copies.

### Why not just commit the installers

GitHub warns on any file above 50 MB and hard-refuses above 100 MB. The Windows
installer is 67 MB, macOS 91 MB, the AppImage 71 MB and the deb 64 MB — 293 MB
in total, and a fresh copy every release. That would grow the repository past a
gigabyte in a handful of versions, and git never forgets a blob. Releases are
built for exactly this and do not count against repository size.

---

## Good to know

**First load after idle is slow.** Free instances sleep after 15 minutes of no
traffic and take 30-50 seconds to wake. The service worker shows the interface
immediately while the server wakes up. To avoid sleeping entirely, upgrade to the
$7 plan, or point a free uptime pinger (e.g. UptimeRobot) at `/healthz` every
10 minutes.

**Install it like an app.** Open the link on a phone → browser menu →
*Add to Home Screen*. It then opens full screen with no address bar.

**Updating later.** Edit files on GitHub → Render redeploys automatically.
The build fingerprint in `app.js` clears every visitor's cache on the next visit,
so nobody gets a stale version.

**Before sharing widely,** open `app.js`, find `vLegal`, and put your own contact
details in the Operator section. Read the note in README.md about how this
sources audio.
