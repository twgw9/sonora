#!/usr/bin/env bash
# =====================================================================
#  Sonora — rebuild the Android app after changing the web files.
#
#  Usage:   ./build-apk.sh
#
#  It copies index.html / app.js / styles.css / logo.svg / icon.svg into
#  the Android project, re-applies the two native patches, bumps the
#  version, builds, and drops fresh APKs in ./apk/
# =====================================================================
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
AND="$ROOT/android"
WEB="$AND/app/src/main/assets/web"

# ---- toolchain ----------------------------------------------------
: "${JAVA_HOME:=/home/user/jdk17}"
: "${ANDROID_HOME:=/home/user/android-sdk}"
export JAVA_HOME ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

[ -x "$JAVA_HOME/bin/java" ] || { echo "JDK 17 not found at $JAVA_HOME"; exit 1; }
[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK not found at $ANDROID_HOME"; exit 1; }
echo "sdk.dir=$ANDROID_HOME" > "$AND/local.properties"

# The Android Java sources (MainActivity, the in-app server, Updater) are not
# in this checkout — the repository only carries the prebuilt apk/Sonora.apk.
# Fail loudly instead of letting gradle produce a confusing error later.
[ -f "$AND/app/src/main/AndroidManifest.xml" ] || {
  echo
  echo "The Android source project is missing from this checkout."
  echo "Only the prebuilt apk/Sonora.apk is stored in git (it is current and"
  echo "installable). To rebuild the APK you need the Java sources restored"
  echo "under android/app/src/main/ — see HANDOVER.txt PART 10 and the"
  echo "Android section of CHANGES.md."
  echo
  exit 1
}

# ---- 1. copy the web app -------------------------------------------
echo "→ copying web files"
mkdir -p "$WEB"
cp "$ROOT/index.html" "$ROOT/app.js" "$ROOT/styles.css" "$ROOT/logo.svg" \
   "$ROOT/icon.svg" "$ROOT/manifest.webmanifest" "$WEB/"

# ---- 2. re-apply the native patches --------------------------------
echo "→ applying native patches"
python3 - "$WEB" <<'PY'
import sys, os
web = sys.argv[1]

p = os.path.join(web, 'index.html')
s = open(p).read()
if 'native.js' not in s:
    s = s.replace('<script src="app.js"></script>',
                  '<script src="native.js"></script>\n<script src="app.js"></script>')
s = s.replace('<link rel="manifest" href="manifest.webmanifest">', '')
open(p, 'w').write(s)

p = os.path.join(web, 'app.js')
s = open(p).read()
s = s.replace("if ('serviceWorker' in navigator) addEventListener('load', async () => {",
              "if ('serviceWorker' in navigator && !(window.Android && window.Android.isNative)) addEventListener('load', async () => {")
if 'isNative) {\n  document.querySelectorAll' not in s:
    s = s.replace("setTheme(S.theme); setDens(S.dens); setAccent(S.accent); setFont(S.font); setCorner(S.corner);",
"""if (window.Android && window.Android.isNative) {
  document.querySelectorAll('.nav[data-v="room"]').forEach(n => n.style.display = 'none');
  try { SET('room', null); } catch (e) {}
  S.room = null;
}
setTheme(S.theme); setDens(S.dens); setAccent(S.accent); setFont(S.font); setCorner(S.corner);""")
s = s.replace("beat(); liveTimer = setInterval(() => { if (!document.hidden) beat(); }, 30000);",
              "if (!(window.Android && window.Android.isNative)) { beat(); liveTimer = setInterval(() => { if (!document.hidden) beat(); }, 30000); }")
open(p, 'w').write(s)
print('   patches ok')
PY

# ---- 3. bump versionCode / versionName ------------------------------
GRADLE="$AND/app/build.gradle"
CODE=$(grep -oP 'versionCode\s+\K[0-9]+' "$GRADLE")
NEW=$((CODE + 1))
sed -i "s/versionCode $CODE/versionCode $NEW/" "$GRADLE"
sed -i "s/versionName \"[^\"]*\"/versionName \"1.$NEW\"/" "$GRADLE"
echo "→ version $CODE → $NEW  (versionName 1.$NEW)"

# ---- 4. build --------------------------------------------------------
echo "→ building (a minute or two)"
cd "$AND"
./gradlew assembleDebug assembleRelease --no-daemon -q

# ---- 5. collect ------------------------------------------------------
mkdir -p "$ROOT/apk"
cp app/build/outputs/apk/debug/app-debug.apk       "$ROOT/apk/Sonora.apk"
cp app/build/outputs/apk/release/app-release.apk   "$ROOT/apk/Sonora-release.apk"

echo
echo "done — version 1.$NEW"
ls -lh "$ROOT/apk"/*.apk
echo
echo "Copy apk/Sonora.apk to the phone and tap it. Installing over the"
echo "existing app keeps your likes, playlists and settings."
