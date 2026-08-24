# 🎧 Sonora

Premium music streaming — studio audio modes, offline downloads, listening rooms.
**Zero npm dependencies.** Pure Node 18+ and vanilla JS.

---

## Deploy on Render (2 minutes)

1. Push this folder to a GitHub repo.
2. Render dashboard → **New +** → **Web Service** → connect the repo.
3. Fill in:

| Field | Value |
|---|---|
| Runtime | **Node** |
| Build Command | *(leave blank)* |
| Start Command | `node --openssl-legacy-provider server.js` |
| Health Check Path | `/healthz` |
| Instance Type | Free is fine |

4. Environment → add `NODE_VERSION` = `20`.
5. Deploy. Done — no env secrets, no database, no API keys.

`render.yaml` is included, so you can also use **Blueprint** deploy and skip all manual config.

> ⚠️ The `--openssl-legacy-provider` flag is **required**. Node 17+ disables DES-ECB by
> default, which is needed to decrypt media URLs. Without it playback returns empty streams.

### Run locally
```bash
npm start          # → http://localhost:3000
```

---

## Features

**Audio** — 16 real-time DSP modes (Lo-Fi, Deep Lo-Fi, Slowed+Reverb, Nightcore, 8D,
Bass Boost, Club, Vocal, Concert Hall, Old Tape, AM Radio, Rainy Cafe, Sleep, Focus,
Workout, Normal) plus 8 manual knobs — speed/pitch, low-pass warmth, sub bass,
treble air, room reverb, stereo depth, 8D rotation speed, vinyl crackle.
Rain ambience, vocal reducer, auto limiter, crossfade.

**Quality** — 320 / 160 / 96 / 48 / 12 kbps, switchable mid-song without losing position.
Auto-downgrade on network errors.

**Browse** — trending, charts, curated playlists, new releases, radio stations,
16 mood mixes, 14 languages, **Golden Era** (1950s–2010s decade browsing with real
year filtering) and legendary artists.

**Rooms** — create a 5-letter code, friends join, everyone hears the same second.
Server-Sent Events sync, live chat, shared queue.

**Library** — likes, playlists, history, downloads, listening stats, JSON export/import.

**UI** — 6 themes (Midnight, Aurora, Sunset, Forest, Mono, Daylight) × 4 layouts
(Default, Compact, Cozy, List). Mobile gets a bottom tab bar, mini player with swipe
gestures, bottom-sheet dialogs and safe-area insets.

---

## Architecture

```
server.js    Node http server · JioSaavn bridge · DES-ECB media decrypt
             · LRU cache + request coalescing · gzip · ETag · SSE rooms
index.html   App shell
styles.css   Design tokens, 6 themes, 4 layouts, responsive
app.js       Audio graph, views, state, gestures
```

**Performance** — gzip everywhere (app.js 62 KB → 20 KB), ETag/304 caching,
in-memory static cache, request coalescing (duplicate upstream calls collapse into one),
retry with backoff, lazy images, `content-visibility` friendly lists,
CSS-only animations, `prefers-reduced-motion` support.
