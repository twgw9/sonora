# Sonora — Android app

`Sonora.apk` is signed and installs directly. `Sonora-release.apk` is the same
build under a second name.

| File | Size | Use this if |
|---|---|---|
| **Sonora.apk** | 2.8 MB | Normal install — recommended |
| Sonora-release.apk | 2.8 MB | Identical, kept for older links |

- Package: `com.sonora.player`, version **1.8**
- Works on **Android 7.0 and newer** (minSdk 24, targetSdk 34)
- Signed with APK Signature Scheme v2 and v3 using `sonora-signing.jks`
  (store and key password `sonora123`), so no Play Store is needed

## Upgrading from version 1.7 or earlier

Version 1.8 is signed with a new key, so Android will refuse to install it over
an older Sonora with `App not installed`. Uninstall the old app first, then
install this one.

**Before you uninstall**, open the old app and go to
**Settings → Your library → Export**, save the file, then import it again after
installing 1.8. Likes, playlists and history live on the device, so an
uninstall clears them.

From 1.8 onwards, keep `apk/sonora-signing.jks` — reusing it means every future
version installs straight over the top with nothing lost.

### Keep the keystore private

`apk/sonora-signing.jks` is deliberately **not** committed to git, and it must
never be. Anyone who has that file can build an APK that Android accepts as a
genuine Sonora update and installs over yours.

Two things to do with it:

- **Back it up somewhere private** — a password manager, an encrypted drive.
  Lose it and no future version can ever install over an existing one; every
  user would have to uninstall and lose their library.
- **Change the password.** It is currently `sonora123`, which was fine for a
  build sitting in a sandbox and is not fine for a key you intend to keep:

  ```bash
  keytool -storepasswd -keystore apk/sonora-signing.jks
  keytool -keypasswd -alias sonora -keystore apk/sonora-signing.jks
  ```

---

## Install on your phone

1. Copy `Sonora.apk` to the phone (USB, WhatsApp to yourself, Google Drive, anything).
2. Tap the file in your Files app.
3. Android will warn about installing from an unknown source — tap
   **Settings → Allow from this source**, then go back and tap **Install**.
4. Open **Sonora** from your app drawer.

That's it. No account, no setup.

---

## What runs where

The whole app lives inside the APK. On launch it starts a tiny HTTP server bound
to `127.0.0.1:8731` — reachable only by this app on this phone — and loads the
interface from it. That server does what `server.js` did on the web build:

- talks to JioSaavn
- decrypts media URLs with DES-ECB (in Java, `LocalServer.decryptMediaUrl`)
- proxies audio with Range support so seeking and 320 kbps work

You still need internet to stream, but there is **no server of yours to deploy
and nothing to pay for**.

## What you get

- 7-band equaliser, 16 sound modes, all the presets
- Studio / High / Balanced / Saver / Lite quality
- Trending, Golden Era, Moods, search, lyrics (synced when available)
- Likes, playlists, history, downloads, insights
- 8 themes × 6 accents × 4 typefaces × 3 corner styles × 4 densities
- Command palette, queue reordering, sleep timer
- Playback notification, screen stays awake while playing
- Android back button closes the panel you are in, not the app
- Native share sheet

## Not in the app build

**Listening rooms are hidden.** Rooms need a shared server so two phones can
meet somewhere — a phone-local server cannot do that. If you deploy the web
build to Render (see `DEPLOY.md`), rooms work there and you can open that link
in any browser.

## Rebuilding it yourself

```bash
cd sonora-apk
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk
./gradlew assembleDebug      # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease    # app/build/outputs/apk/release/app-release.apk
```

To update the interface later, copy the changed `index.html`, `app.js` or
`styles.css` into `sonora-apk/app/src/main/assets/web/` and rebuild.

## A note before you share it

Sonora hosts no audio. It reads publicly reachable endpoints, the same way a
browser does. Keep it for personal listening; see the About & Legal screen in
the app.
