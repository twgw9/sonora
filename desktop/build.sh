#!/usr/bin/env bash
# Build the desktop apps. Run from the project root or from desktop/.
#
#   ./build.sh            # every target this machine can build
#   ./build.sh win        # Windows
#   ./build.sh mac        # macOS
#   ./build.sh linux      # Linux
#
# On GitHub's Windows runners (release.yml) the package.json target is nsis,
# which produces the single-file SonoraSetup.exe natively. Locally without
# wine, electron-builder builds a win-unpacked folder instead and the
# installer is assembled from it with makensis (apt install nsis /
# brew install makensis).
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
  win)
    if [ "$(uname -s)" = "MINGW"* ] || [ "$(uname -s)" = "MSYS"* ] || [ "$(uname -s)" = "CYGWIN"* ] || [ -n "$RUNNER_OS" ] && [ "$RUNNER_OS" = "Windows" ]; then
      # native NSIS on a Windows runner — no wine needed
      echo "→ Windows (nsis)"; npx electron-builder --win --publish never
    else
      echo "→ Windows (dir, installer assembled with makensis afterwards)"
      npx electron-builder --win dir --publish never
    fi ;;
  mac)   echo "→ macOS";    npx electron-builder --mac   --publish never ;;
  linux) echo "→ Linux";    npx electron-builder --linux --publish never ;;
  *)     echo "→ every target this machine can build"
         npx electron-builder --linux --publish never || true
         if [ "$(uname -s)" = "MINGW"* ] || [ "$(uname -s)" = "MSYS"* ] || [ "$(uname -s)" = "CYGWIN"* ] || [ "$(uname -s)" = "Darwin" ]; then
           npx electron-builder --win --publish never || true
         else
           npx electron-builder --win dir --publish never || true
         fi
         [ "$(uname)" = "Darwin" ] && npx electron-builder --mac --publish never || true ;;
esac

# a single-file Windows installer, built with the bundled NSIS
if [ -d out/win-unpacked ] && [ ! -f out/SonoraSetup.exe ]; then
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
