# v13 — App Look, offline play, easy playlists (2026-08-25)

## New
- **App Look (UI switcher)** — Settings > Appearance > App Look. Six skins:
  Classic (the app as it always was), Aurora (glass player over a dark base),
  Liquid Glass (glossy translucent panels, iOS-26 style), Neon (pure black,
  electric accents), Poster (bigger artwork, warm editorial tone) and
  Soft Light (airy daytime look, auto-pairs with the Paper theme).
  One tap restyles the whole app; every feature works in every look.
- **Player styles** — Card / Orbit / Wave / Karaoke. Orbit rings the artwork
  with a draggable progress circle; Wave seeks on a waveform; Karaoke puts
  word-synced lyrics front and centre. Works with any skin.
- **One-tap playlist add** — the + button drops the song into your most
  recent playlist instantly, with Undo. The full picker (searchable, shows
  covers, creates on Enter) opens from the 3-dot menu or on first use.
- **Shareable playlists** — Share button on every playlist builds a link
  that carries the whole list; opening it imports a copy on any device.
  No account, no server storage.
- **Offline playback** — every download also saves a copy inside the app;
  when the server or the network is gone the saved copy plays automatically.
- **Multi-source upgrades** — two more catalogue mirrors (six sources
  total), parallel racing on the search path, and a live "Music sources"
  health readout on the Get-the-app page.
- **Tablet layout** — proper mid-size grid between phone and desktop.

## Fixed
- Playlist rename and shuffle buttons on the playlist page.
- Player-style switch no longer references a stale element.

## Tests
- New suite tests/looks.js: 41 checks across skins, player styles,
  quick add, share links, offline store and settings. All suites: 171/171.

# What v9 changed (2026-08-25)

A maintenance release that shuts the gaps between what the handover said and
what the repository actually contained.

## The release pipeline (the big one)

- **`.github/workflows/release.yml` was missing entirely.** The handover
  describes it as the thing that builds all three desktop apps and publishes
  them — but the file had never been committed, which is exactly why the
  repository has **zero releases** and the Get-the-App page can only ever
  offer Android. The workflow is now in the repo: pushing a changed
  `version.json` builds the Windows NSIS installer on a Windows runner, the
  macOS dmg + zip on a Mac, the Linux AppImage + deb on Ubuntu, and publishes
  all of them plus `apk/Sonora.apk` as a release tagged `vN`.
- **`desktop/package.json` still targeted Windows `"dir"`** (the bug-38 fix
  was never committed). `win.target` is now `nsis` with the per-user
  `SonoraSetup.exe` artifact name; `mac` now also produces a zip
  (the server's download matcher looks for `mac-*.zip`), and the placeholder
  homepage `github.com/USER/sonora` is fixed. The workflow also fails the
  build if `SonoraSetup.exe` is missing or under 5 MB (bug 39's "check the
  size, not just that the file exists" lesson).
- **`desktop/build.sh`** now branches on the OS: Windows runners build NSIS
  natively; Linux/macOS still build `dir` and assemble the installer with
  makensis (there is no wine on a Linux box).

## Security

- **`/api/selfupdate/source` removed** (bug 36, server side). It was an
  unauthenticated endpoint with which anyone could repoint the deployed
  server at an arbitrary update source. Sources now come only from
  `update.json` / `version.json` / env — all operator-controlled. The
  Android Settings "Update source" field is now read-only display too.
- **HANDOVER.txt restored** (it was referenced everywhere but absent from
  git) — with the signing keystore password redacted. A password must never
  live in a public repository (bug 41).

## Version drift

- `app.js` BUILD fingerprint `v33-2026-08-24` → `v35-2026-08-25`, `sw.js`
  cache name `sonora-v33` → `sonora-v35` (they must move together — the
  build fingerprint is what makes "I don't see changes" impossible).
- `version.json` `7` → `9`, with notes and today's date. This is the
  trigger that makes every client and the deployed server pick up the new
  interface.
- `sw.js` added to the server's `OTA_FILES` list — without it a deployed
  server would keep serving the old service worker forever after a
  self-update.

## Robustness

- **Error boundary around every view** (handover PART 9F): a thrown
  exception in one view used to blank the whole page. `render()` now
  isolates each view and shows a retry card instead, logging the error.

## Repository hygiene

- Removed committed junk (a partial 20 MB `android-sdk/` with no platforms
  or build-tools, the nested `sonora/` copy, the duplicate `sonora-apk/`
  Gradle project, the stale `wavely/` snapshot, `uploads/image.png`, a
  binary `nsis_3.11-1_amd64.deb`, and the machine-specific
  `android/local.properties`). Bug 42 had crept back: the same APK existed
  in three places again. `apk/Sonora.apk` remains, untouched and current.
- `android/app/build.gradle` (the real one, from `sonora-apk/`) merged into
  `android/app/` where `build-apk.sh` expects it.
- **The Android Java sources are not in the repository** — no `MainActivity`,
  no `Updater.java`, no `AndroidManifest.xml`, never committed in any
  revision. `build-apk.sh` now detects this and fails with a clear message
  instead of a confusing Gradle error; `apk/Sonora.apk` in git is the
  prebuilt, signed, current build and keeps working (it is also what the
  release workflow publishes). Restoring the sources (or decompiling the
  APK) is the one remaining build gap — see HANDOVER.txt PART 10.
- `.gitignore` hardened: `android-sdk/`, `uploads/`, `wavely/`,
  `nsis_*.deb`, `apk/sonora-signing.jks`.

## Docs

- README: the "Builds currently published" table now tells the truth —
  installers come from the GitHub Release built by the workflow; the one
  committed binary is the APK.
- UPLOAD.md: automated path described on top; the manual Steps remain as
  the fallback.
- HANDOVER.txt: restored with v9 notes interleaved, password redacted.

## Verified

```
deep       63/63      room   12/12      hunt   17/17
platform   60/60      (with installers present; 56/60 without — same
                       documented root cause: no Releases exist yet)
release     7/7       perf   13/13      stress 18/18
```
Plus: `node --check` on every JS file, JSON/YAML validation, fuzzed API
inputs (no 500s), 300 concurrent requests (300×200 OK), stream proxy
byte-identical with the CDN, `/api/selfupdate/source` now 404.

# What v10 changed (2026-08-25)

Interface v36 / payload v10. Playback fix, phone fixes, glass widgets, room
modes, and the community/update hub.

## Playback — "music nahi aarha tha"
- **Quality ladder on errors** — instead of one downgrade to 96 kbps, every
  stream error steps down one rung (320→160→96→48→12) while "Adapt to
  network" is on.
- **Direct-CDN fallback** — if the proxy path fails twice, the current track
  is retried straight from the media CDN (CORS is open), so a hiccuping proxy
  no longer kills a track.
- **First-play retry** — the first `play()` in some WebViews fails with a
  NotAllowedError even after a tap; one retry 250ms later fixes the "nothing
  happens" first tap.
- **Buffering toast** — "Buffering…" instead of a silent stall, max once/12s.
- **Resume last queue** (Settings → Playback, on by default): the last queue
  (≤60 tracks) is saved when play starts, and on reopen Sonora offers
  "Resume …? [Play]". Off disables it entirely.

## Notification / lock screen
- Media Session scrubber position now updates on every timeupdate (real-time
  seek bar on the lock screen and notification, not a 5s interval).
- play/pause state pushed to the OS immediately on both events.
- Windows desktop build sets an AppUserModelId (proper taskbar/toast
  identity), `Ctrl+Q` quits, File menu has explicit "Close window (keeps
  playing)" vs "Quit Sonora", and the first close shows a tray hint once so
  the app never looks like it vanished.

## Glass widget (opt-in, default OFF)
- Settings → Appearance → **Glass widget**: frosted, floating now-playing
  chrome — the phone mini player and the desktop bottom player render as
  translucent glass cards.
- Home widgets now have a **style** setting (Default / Glass); the
  now-playing home card goes frosted in Glass.
- Cheaper blur (10px) on phones, where the GPU is the bottleneck.

## Rooms — APK + local, no Render needed
- The room gate is gone: **local mode** (this device or the served origin is
  the room server) works out of the box; **server mode** accepts any Sonora
  deployment **or your PC's address on the same Wi-Fi** (run
  `node server.js`, join from the phone by IP — rooms sync live over LAN).
- Room lobby shows the current mode chip; Settings → Rooms → Room server
  changes it. Invite links point at the room server in use.
- Real-time listener counter: every 6s while visible + on tab focus.

## Search & phone UI
- **Category tabs** on results: All / Songs / Albums / Artists / Playlists
  (All is default; nothing hidden).
- **Recently searched** chips under an empty search box (last 6).
- Card quick actions (playlist + 3-dot) fully visible on touch devices.
- 3-dot menu gains **Karaoke (vocal off)** and **Sleep after this** next to
  Play next / Add to queue / Add to playlist / Download / Radio / Artist /
  Album / Share.

## Get the App — updates & community hub
- "Interface vN — up to date", live **Check now** (self-update), last-checked
  time and the baked-in source, plus **Join Telegram** and **View repo**
  buttons. Not editable — the source stays baked in (bug 36).
- **Update-available notice** on boot (once/6h) when the feed has a newer
  interface: "Update vN available — See it".

## Studio
- "My playlists" section in Studio with one-tap open of each playlist and a
  Manage shortcut.

## Legal / presentation
- DISCLAIMER.md rewritten to be publishable as-is (copyright, no-hosted-
  content statement, usage risk, takedown contacts, MIT-code-only licence,
  third-party services and privacy summary).
- `banner.png` social preview added — set it in GitHub → Settings → Social
  preview (and the Telegram channel settings).
- Viewer polish: `content-visibility:auto` on rails, `contain` on cards —
  long pages skip more layout; nothing visual changes.

## Verified
deep 63/63 · room 12/12 · hunt 17/17 · perf 13/13 · stress 18/18 · release
7/7 (platform 56/60 without installers — documented; 60/60 with them, and
the release workflow produces them on push). No emoji in UI files.

## v11 (same day) — collection pages + karaoke polish
- **Collection hero page** for albums/playlists (the JioSaavn-style look from
  the reference screenshot, minus its quirk): big rounded artwork, PLAY playlist
  kicker, big bold title, meta line ("N songs · M min · year"), gradient
  **Play** pill + **Shuffle** pill + radio + queue-all round buttons — one
  API call loads info+tracks together. Rows keep ONE title (the reference
  page repeats the title in a middle column — that irregularity is gone).
- **Radio stations fixed**: home radio/mix cards no longer dead-end at
  `/api/playlist?id=`; they fall back to a name-based mix.
- **Karaoke word highlight** — the exact word being sung lights up; sung
  words stay tinted; 125 ms tick; auto-scroll keeps the line centred.
- **UI polish pass** — ambient aurora background (static on mobile, drifting
  on desktop, disabled with reduced-motion), hero shine sweep, card lift +
  cover zoom on hover (off on touch), row hover accent bar, press feedback
  on every control, gradient progress bars with glowing head, softer
  sheets/panels, custom scrollbars, accent selection colour, active-tab glow,
  full-screen artwork glow.

## v12 (same day) — brand, hero extras, terms (payload 12 · BUILD v38)
- **Logo now renders everywhere.** The mark was injected by
  `fetch('logo.svg')` — which fails silently in offline starts, sandboxed
  previews and some WebViews, leaving the brand as bare text. It is now
  inlined in index.html (sidebar + boot gate), so it can never be blank.
  Footer "vN" also syncs to the live interface build.
- **Collection hero: Save all** — the album/playlist page now has a fourth
  round button that copies the whole collection into a new or existing
  playlist ("add only the missing tracks" when the playlist already has
  some).
- **Phone tuning**: tighter hero/nav/brand spacing under 640 px, `touch-
  action:manipulation`, transparent tap highlight in the Android WebView.
- **Terms of Use & Copyright Disclaimer v2.0** — full legal-style document
  (definitions, IP, permitted/prohibited use, no warranty, liability cap,
  takedown procedure, privacy summary, third-party services, governing law,
  contact). Publishable as-is.
- Verified: deep 63/63, room 12/12, hunt 17/17, release 7/7, perf 13/13,
  stress 18/18 (platform 56/60 without installers — documented; the release
  workflow produces them on push).
