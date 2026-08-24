#!/usr/bin/env bash
# Build the desktop apps. Run from the project root or from desktop/.
set -e
cd "$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd .. && pwd)"

echo "→ syncing the web app"
mkdir -p web server
cp "$ROOT"/index.html "$ROOT"/app.js "$ROOT"/styles.css "$ROOT"/logo.svg \
   "$ROOT"/icon.svg "$ROOT"/manifest.webmanifest "$ROOT"/desktop-hooks.js web/
cp "$ROOT"/server.js server/

[ -d node_modules ] || { echo "→ installing build tools"; npm install --no-audit --no-fund; }

TARGET="${1:-}"
case "$TARGET" in
  win)   echo "→ Windows";  npx electron-builder --win   --publish never ;;
  mac)   echo "→ macOS";    npx electron-builder --mac   --publish never ;;
  linux) echo "→ Linux";    npx electron-builder --linux --publish never ;;
  *)     echo "→ every target this machine can build"
         npx electron-builder --linux --publish never || true
         npx electron-builder --win   --publish never || true
         [ "$(uname)" = "Darwin" ] && npx electron-builder --mac --publish never || true ;;
esac

# a single-file Windows installer, built with the bundled NSIS
if [ -d out/win-unpacked ]; then
  NS="$HOME/.cache/electron-builder/nsis/nsis-3.0.4.1"
  if [ -x "$NS/linux/makensis" ]; then
    echo "→ trimming the Windows build"
    rm -f out/win-unpacked/LICENSES.chromium.html out/win-unpacked/LICENSE.electron.txt
    find out/win-unpacked/locales -name '*.pak' ! -name 'en-US.pak' -delete 2>/dev/null || true
    echo "→ Windows installer (a few minutes)"
    NSISDIR="$NS" "$NS/linux/makensis" -NOCD -V2 installer.nsi || echo "  (installer step skipped)"
  fi
fi

echo "→ publishing to the website"
mkdir -p "$ROOT/downloads"
cp out/*.AppImage out/*.deb out/*.exe out/*.dmg "$ROOT/downloads/" 2>/dev/null || true
rm -f "$ROOT/downloads"/*-win.zip 2>/dev/null || true

echo
echo "done — these are now on the Get the App page:"
ls -lh "$ROOT/downloads" 2>/dev/null | tail -n +2
