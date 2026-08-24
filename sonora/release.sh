#!/usr/bin/env bash
# =====================================================================
#  Ship an update to every install.
#
#      ./release.sh "what changed"
#
#  Works out your GitHub address from the git remote, bakes it into every
#  build so nobody ever types a URL, bumps the version, commits and pushes.
# =====================================================================
set -e
cd "$(cd "$(dirname "$0")" && pwd)"

NOTES="${1:-}"

# ---- 1. does the app still parse ------------------------------------
node --check app.js
node --check server.js
node --check sw.js
echo "code parses"

# reject any emoji that crept in — the UI is text and SVG only
node -e '
const fs=require("fs");
const re=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
let bad=0;
for(const f of ["index.html","app.js","styles.css"]){
  fs.readFileSync(f,"utf8").split("\n").forEach((l,i)=>{
    const m=l.match(re); if(m){console.error(f+":"+(i+1)+"  "+m[0]); bad++;}
  });
}
if(bad){console.error("emoji found — remove them before shipping"); process.exit(1);}
console.log("no emoji");
'

# if a server is up, run the platform test so a broken download page cannot ship
if curl -sf --max-time 2 http://127.0.0.1:${PORT:-3000}/healthz > /dev/null 2>&1; then
  if [ -d node_modules/jsdom ]; then
    node tests/platform.js > /tmp/sonora-platform.log 2>&1 \
      && echo "platform test passed" \
      || { echo "platform test FAILED — see /tmp/sonora-platform.log"; tail -20 /tmp/sonora-platform.log; exit 1; }
  else
    echo "platform test skipped (npm install jsdom to enable it)"
  fi
  if [ -d node_modules/jsdom ]; then
    node tests/perf.js > /tmp/sonora-perf.log 2>&1 \
      && echo "performance test passed" \
      || { echo "performance test FAILED — see /tmp/sonora-perf.log"; tail -20 /tmp/sonora-perf.log; exit 1; }
    node tests/stress.js > /tmp/sonora-stress.log 2>&1 \
      && echo "stress test passed" \
      || { echo "stress test FAILED — see /tmp/sonora-stress.log"; tail -20 /tmp/sonora-stress.log; exit 1; }
  fi
  # the release fallback needs no browser, so it always runs
  node tests/release.js > /tmp/sonora-release.log 2>&1 \
    && echo "release fallback test passed" \
    || { echo "release fallback test FAILED — see /tmp/sonora-release.log"; tail -20 /tmp/sonora-release.log; exit 1; }
else
  echo "platform test skipped (no server on :${PORT:-3000})"
fi

# ---- 2. work out where updates come from ----------------------------
RAW=""
if [ -d .git ]; then
  ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
  if [ -n "$ORIGIN" ]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
    # git@github.com:user/repo.git  →  user/repo
    # https://github.com/user/repo.git → user/repo
    SLUG="$(echo "$ORIGIN" \
      | sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#^ssh://git@github\.com/##; s#\.git$##')"
    case "$ORIGIN" in
      *gitlab*) RAW="https://gitlab.com/${SLUG}/-/raw/${BRANCH}/" ;;
      *)        RAW="https://raw.githubusercontent.com/${SLUG}/${BRANCH}/" ;;
    esac
  fi
fi

if [ -z "$RAW" ]; then
  echo
  echo "No git remote yet. Set one up first:"
  echo
  echo "  git init"
  echo "  git add . && git commit -m 'Sonora'"
  echo "  git branch -M main"
  echo "  git remote add origin https://github.com/YOURNAME/sonora.git"
  echo "  git push -u origin main"
  echo
  echo "Then run ./release.sh again — the update address configures itself."
  exit 1
fi
echo "✓ update source: $RAW"

# ---- 3. bake it in so no build ever asks ----------------------------
printf '{\n  "source": "%s"\n}\n' "$RAW" > update.json

UPD="android/app/src/main/java/com/sonora/player/Updater.java"
if [ -f "$UPD" ]; then
  ESCAPED="$(printf '%s' "$RAW" | sed 's/[&/\]/\\&/g')"
  sed -i -E "s#(DEFAULT_BASE = \")[^\"]*(\";)#\1${ESCAPED}\2#" "$UPD"
  echo "✓ baked into the Android build"
fi

# ---- 4. bump the version --------------------------------------------
[ -f version.json ] || echo '{"version":0,"minApk":1,"notes":""}' > version.json
NEXT=$(node -e "console.log((require('./version.json').version||0)+1)")
node -e "
const fs=require('fs');
const v=JSON.parse(fs.readFileSync('version.json','utf8'));
v.version=$NEXT;
v.minApk=v.minApk||1;
v.notes=process.argv[1]||'';
v.date=new Date().toISOString().slice(0,10);
v.source=process.argv[2];
fs.writeFileSync('version.json', JSON.stringify(v,null,2)+'\n');
" "$NOTES" "$RAW"
echo "✓ version $NEXT"

# ---- 5. keep the copies in the app bundles current -------------------
cp native.js android/app/src/main/assets/web/native.js 2>/dev/null || true
for f in index.html app.js styles.css logo.svg icon.svg manifest.webmanifest; do
  cp "$f" android/app/src/main/assets/web/ 2>/dev/null || true
  cp "$f" desktop/web/ 2>/dev/null || true
done
cp desktop-hooks.js desktop/web/ 2>/dev/null || true
cp server.js desktop/server/ 2>/dev/null || true

# ---- 6. publish ------------------------------------------------------
git add -A
git commit -m "${NOTES:-web update} (v$NEXT)" || echo "  nothing new to commit"
git push

echo
echo "────────────────────────────────────────────────"
echo " v$NEXT is live"
echo
echo " Website / Render : redeploys, then self-updates"
echo " Android app      : silent check on next launch"
echo " Desktop app      : checks on launch"
echo
echo " Nobody has to paste a URL — it is baked in."
echo "────────────────────────────────────────────────"
