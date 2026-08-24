# Final test report

Run on 2026-08-24 against `app.js` BUILD `v29-2026-08-24`, service worker
`sonora-v29`, `version.json` version 3.

---

## Automated tests: 158 / 158

| Suite | Checks | Result |
|---|---|---|
| `tests/deep.js` | 62 | pass |
| `tests/room.js` | 12 | pass |
| `tests/hunt.js` | 17 | pass |
| `tests/platform.js` | 60 | pass |
| `tests/release.js` | 7 | pass |

`platform.js` is new in this pass. It asks the server for its build list, does a
HEAD request against every advertised file, then boots the app six times
pretending to be an iPhone, an iPad, an Android phone, Windows, macOS and Linux.
For each device it checks the home strip names that platform, all six cards
render, the visitor's own build is highlighted and sorted first, no card is a
dead "Coming soon" end, and the download link resolves. On iOS it opens the Add
to Home Screen guide and checks the wording mentions Safari.

---

## Builds — every one rebuilt from the current source and verified

| Platform | File | Size | Verified how |
|---|---|---|---|
| Android | `Sonora.apk` | 2.8 MB | `apksigner verify` passes on v2 and v3 schemes; `aapt2 dump badging` reports `com.sonora.player` 1.8, minSdk 24, targetSdk 34; the `assets/web/app.js` inside reports BUILD v29 |
| Windows | `SonoraSetup.exe` | 67 MB | `file` reports a PE32 NSIS installer; makensis compressed 217 MB of payload down to 67 MB with no errors |
| macOS | `Sonora-mac.zip` | 91 MB | zip contains a complete `Sonora.app` bundle, 197 entries |
| Linux | `Sonora-1.0.0.AppImage` | 71 MB | `file` reports an ELF x86-64 executable |
| Linux | `sonora-desktop_1.0.0_amd64.deb` | 64 MB | `dpkg-deb -I` reads the control file; extracted, and the `app.asar` inside was unpacked and confirmed to hold BUILD v29 |
| iPhone, iPad | — | — | no download; Safari Add to Home Screen, covered by the platform test |

All five files return HTTP 200 from the running server with the right
`Content-Length`.

---

## Server

- **500 concurrent requests** to `/api/home`: 500 × 200 OK in 2.7 s, zero errors, 64 MB RSS
- **SIGKILL of the worker mid-traffic**: supervisor respawned it in under 4 s; the very next `/healthz` returned 200
- Every static and API route returns 200 (21 routes checked)
- Brotli is negotiated correctly: `app.js` transfers as 52 KB
- Search returns 40 results; the 96 kbps and 320 kbps CDN URLs both return HTTP 206 with real MP4 data

---

## Bugs found and fixed in this pass

1. **Windows, macOS and Linux builds were missing entirely.** The sandbox strips
   any directory named `dist/`, `out/`, `build/` or `node_modules/` from its
   snapshots, so `desktop/out/` had been wiped and `/api/downloads` was
   advertising Android only. All four desktop targets were rebuilt.

2. **`desktop/web/`, `desktop/server/` and `desktop/assets/` were gone** for the
   same reason. Restored from `Sonora-source.zip`.

3. **No macOS build at all.** `package.json` only ever asked for a `.dmg`, which
   cannot be produced off a Mac, so macOS silently showed "Coming soon" forever.
   Now built as a `.zip` of the `.app`, and the server accepts `mac*.zip` as a
   macOS build.

4. **The Get the App page had no iPhone card.** iOS users saw five cards, none of
   them theirs. Added an iPhone and iPad card with a real four-step Safari guide.

5. **iPad was detected as macOS.** iPadOS reports `MacIntel` and a Mac user agent;
   the only distinguishing signal is `maxTouchPoints > 1`. Both the home strip
   and the download page now check it, so an iPad is offered the Home Screen
   guide instead of a 91 MB desktop zip it cannot run.

6. **The home strip fell back to the Windows icon** for any unrecognised
   platform, so a Linux visitor on an odd browser was shown a Windows logo.
   Falls back to the neutral Linux mark now.

7. **Install instructions were wrong on two platforms.** Windows said "unzip
   anywhere and run Sonora.exe" when it is now a real installer, and macOS said
   "open the DMG" when it ships as a zip. Both rewritten to match what actually
   downloads, including the Gatekeeper right-click-Open step for the unsigned
   Mac build.

8. **The APK carried a stale web bundle** — v17, from before the last several
   rounds of fixes. The Android Java sources had been wiped by the sandbox, so
   rather than lose the app, the existing APK's `assets/web/` was replaced with
   the current build, then re-zipaligned and re-signed. Verified: the DEX code
   is untouched, all 357 entries intact, and the bundle inside now reports v29.

9. **The Windows installer was silently truncated.** A background makensis run
   was killed by its timeout partway through, leaving a 19 MB `SonoraSetup.exe`
   that looked valid to `file` but was missing most of its payload. Rebuilt to
   the correct 67 MB and checked against the compressor's own byte count.

10. **`platform.js` would have passed while testing nothing.** jsdom accepts a
    `userAgent` option and then ignores it — every simulated device reported as
    Linux. Caught because the iPhone case failed; fixed by pinning
    `navigator.userAgent` directly. This is documented in `tests/README.md` so
    it does not get reintroduced.

11. **Toolchain repair.** The JDK had lost `lib/server/libjvm.so` and the Android
    SDK had lost its build-tools and platforms, so nothing Android could build.
    Both reinstalled. NSIS was also gone from the electron-builder cache; the
    Debian `nsis` package works as a drop-in.

---

## Second pass — getting it ready to actually deploy

Setting up the git repository surfaced three problems that would each have
produced a broken public site.

12. **The installers cannot go in the repository.** Windows 67 MB, macOS 91 MB,
    AppImage 71 MB, deb 64 MB — 293 MB per release. GitHub warns above 50 MB and
    hard-refuses above 100 MB, and git never forgets a blob, so a few versions
    would push the repo past a gigabyte. The first Render deploy would have
    offered **Android only**, with four cards reading "Coming soon".

    `server.js` now reads the repository address out of `version.json`, asks
    GitHub for the latest release, and serves whichever assets it finds whenever
    `downloads/` is empty. A local file always wins, so a machine that built the
    installers still serves its own copies. `publish.sh` uploads the builds to a
    Release in one command. `tests/release.js` proves the whole path against a
    fake `api.github.com`, with no network and no real release needed.

13. **The signing keystore was about to be published**, with the password
    `sonora123` written in the docs beside it. Anyone who pulled the repo could
    have signed an APK that Android accepts as a genuine Sonora update and
    installs over a user's copy. It is now gitignored, and `apk/INSTALL.md`
    explains how to change the password and why the file must be backed up
    privately.

14. **The same 2.8 MB APK was committed three times** — `apk/Sonora.apk`,
    `apk/Sonora-release.apk` and `downloads/Sonora.apk` were byte for byte
    identical. Now one copy; the server already falls back from `downloads/` to
    `apk/`.

Also fixed while wiring this up: a cross-origin release link was still carrying
the `download` attribute, which browsers ignore across origins, so the file would
have opened in a tab instead of downloading. The attribute is now only set for
same-origin links, and `platform.js` checks this on every platform.

The sandbox had again wiped `desktop/web/`, `desktop/server/` and
`desktop/assets/`, plus every build in `desktop/out/`. All restored and rebuilt,
so the shipped installers contain the current v29 code — verified by unpacking
the `app.asar` out of the Linux build and reading the BUILD string.

## Guard rails added

`release.sh` now refuses to ship if:

- `app.js`, `server.js` or `sw.js` fails to parse
- any emoji appears in `index.html`, `app.js` or `styles.css`
- `tests/platform.js` fails, when a server is running and jsdom is installed
- `tests/release.js` fails — this one always runs, it needs no browser

so a broken download page cannot reach a device.

## Repository

Initialised, committed, three commits, ready to push. 55 files, 3.4 MB of git
history, largest tracked file 2.8 MB. Deliberately excluded: the signing
keystore, the desktop installers, `node_modules`, and build output.

---

## Known limits

- **macOS is a `.zip`, not a `.dmg`.** A `.dmg` can only be built on a Mac.
  `cd desktop && ./build.sh mac` produces one there.
- **The macOS build is unsigned and x64.** Apple silicon runs it through
  Rosetta. Gatekeeper asks once on first launch; right-click, Open.
- **The Windows installer has no custom icon.** Rewriting exe resources needs
  wine, which cannot be installed without root here.
- **APK 1.8 is signed with a new key**, so it will not install over 1.7 —
  Android reports `App not installed`. Uninstall first, and export your library
  from Settings beforehand. `apk/sonora-signing.jks` is now kept in the repo, so
  every version after this one upgrades cleanly in place.
- **Rooms still need a hosted server** to work on the phone build. Point
  Settings, Rooms, Room server at the Render URL once it is deployed.
- **Nothing is pushed to GitHub yet.** The repository is committed and ready,
  but pushing needs your credentials, which this sandbox does not have. Until
  the push happens, OTA updates have no source to read from and the Release
  fallback finds nothing —
  `raw.githubusercontent.com/twgw9/sonora/main/version.json` still 404s.

  ```bash
  cd sonora
  git remote add origin https://github.com/twgw9/sonora.git
  git push -u origin main
  ```

  Then `./publish.sh` to put the installers on a Release.
- **The legal position has not changed.** Sonora reads JioSaavn's internal API
  without authorisation. Disclaimers do not prevent a takedown.
