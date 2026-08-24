# Updating the app

## The short version

```bash
cd sonora
./build-apk.sh
```

Fresh APKs land in `apk/`. Copy `apk/Sonora.apk` to the phone, tap it, install
over the old one. **Your likes, playlists, history and settings are kept** —
same package name and same signing key, so Android treats it as an upgrade, not
a new app.

---

## What the script does

1. Copies `index.html`, `app.js`, `styles.css`, `logo.svg`, `icon.svg` from the
   project root into `android/app/src/main/assets/web/`
2. Re-applies the two native patches (loads `native.js` first, hides Rooms,
   skips the service worker)
3. Bumps `versionCode` and `versionName` automatically
4. Builds debug **and** release
5. Drops both into `apk/`

Takes about 30 seconds after the first run.

---

## Changing things

### Interface, colours, features
Edit `app.js`, `styles.css` or `index.html` in the project root — the same files
the website uses — then run `./build-apk.sh`. Web and app never drift apart.

### App name
`android/app/src/main/res/values/strings.xml` → `app_name`

### Launcher icon
`android/app/src/main/res/drawable/ic_launcher_fg.xml` (the mark) and
`ic_launcher_bg.xml` (the background colour)

### Status bar / theme colour
`android/app/src/main/res/values/colors.xml`

### Version shown in Android settings
The script bumps it, but you can set it by hand in
`android/app/build.gradle` → `versionCode` / `versionName`

### Anything native — notifications, back button, the local server
`android/app/src/main/java/com/sonora/player/`
- `MainActivity.java` — WebView, back button, JS bridge
- `LocalServer.java` — the JioSaavn bridge and DES decryption
- `PlaybackService.java` — the playback notification

---

## Test before you build

The web build and the app run identical code, so test in the browser first:

```bash
npm start                 # http://localhost:3000
node tests/deep.js        # 62 checks
node tests/room.js        # 12 checks
```

Green there means green in the app.

---

## Toolchain

The script expects:

- JDK 17 at `/home/user/jdk17`
- Android SDK at `/home/user/android-sdk`

Different machine? Point it at yours:

```bash
JAVA_HOME=/your/jdk17 ANDROID_HOME=/your/android-sdk ./build-apk.sh
```

---

## Troubleshooting

**"INSTALL_FAILED_UPDATE_INCOMPATIBLE"** — the old app was signed with a
different key. Uninstall it first (this does erase your library, so use
Settings → Library → Export first if you care).

**Install button greyed out** — Android blocks installs from unknown sources
until you allow it for the app you are installing from (Files, Chrome, Drive).

**App opens but stays blank** — the bundled web files are stale or broken.
Run `node --check app.js` in the project root, fix any error, rebuild.

**Nothing plays** — the phone has no internet, or JioSaavn is unreachable.
The app needs a connection to stream; only your library is stored locally.
