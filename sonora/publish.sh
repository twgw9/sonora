#!/usr/bin/env bash
# =====================================================================
#  Upload the desktop installers to a GitHub Release.
#
#      ./publish.sh              # tag from version.json, e.g. v3
#      ./publish.sh v3.1         # explicit tag
#
#  Why this exists: the Windows, macOS and Linux builds are 60-90 MB each.
#  GitHub warns above 50 MB and hard-refuses above 100 MB in a git push, so
#  they cannot live in the repository. They go to a Release instead, and
#  server.js falls back to the latest Release's assets whenever downloads/
#  is empty. That means a Render deploy offers every platform without the
#  repo ever carrying a single large binary.
#
#  Needs the GitHub CLI, signed in:  gh auth login
# =====================================================================
set -e
cd "$(cd "$(dirname "$0")" && pwd)"

command -v gh > /dev/null || {
  echo "The GitHub CLI is not installed."
  echo
  echo "  Debian/Ubuntu : sudo apt install gh"
  echo "  macOS         : brew install gh"
  echo "  Windows       : winget install GitHub.cli"
  echo
  echo "Then: gh auth login"
  exit 1
}

gh auth status > /dev/null 2>&1 || { echo "Not signed in. Run: gh auth login"; exit 1; }

TAG="${1:-v$(node -e "console.log(require('./version.json').version||0)")}"
NOTES="$(node -e "console.log(require('./version.json').notes||'')")"

FILES=()
for f in downloads/*.exe downloads/*.AppImage downloads/*.deb downloads/*.dmg \
         downloads/*mac*.zip apk/Sonora.apk; do
  [ -f "$f" ] && FILES+=("$f")
done

[ ${#FILES[@]} -eq 0 ] && {
  echo "Nothing in downloads/ to publish."
  echo "Build first:  cd desktop && ./build.sh"
  exit 1
}

echo "Tag:   $TAG"
echo "Files:"
for f in "${FILES[@]}"; do printf '  %-42s %s\n' "$f" "$(du -h "$f" | cut -f1)"; done
echo

if gh release view "$TAG" > /dev/null 2>&1; then
  echo "Release $TAG exists — replacing its files"
  gh release upload "$TAG" "${FILES[@]}" --clobber
else
  gh release create "$TAG" "${FILES[@]}" \
    --title "Sonora $TAG" \
    --notes "${NOTES:-Sonora $TAG}"
fi

echo
echo "────────────────────────────────────────────────"
echo " Published $TAG"
echo
echo " The Get the App page picks these up automatically,"
echo " on Render as well as locally. Nothing else to set."
echo "────────────────────────────────────────────────"
