# Get a public link for Sonora — 5 minutes

The sandbox preview URL only works for you (it needs an access token).
To get a link you can send to friends, deploy to Render. It is free.

---

## Step 1 — Put the code on GitHub

1. Go to <https://github.com/new>
2. Repository name: `sonora` · choose **Private** · click **Create repository**
3. On the next screen click **uploading an existing file**
4. Drag in **all** of these files, then click **Commit changes**:

```
app.js        index.html    render.yaml   sw.js
icon.svg      logo.svg      robots.txt    package.json
server.js     start.js      styles.css    manifest.webmanifest
```

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
