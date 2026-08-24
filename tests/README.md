# Tests

Headless DOM tests that load the real `index.html` + `app.js` and drive them
like a user, against a running server.

```bash
npm start                       # terminal 1
npm install jsdom               # once
node tests/deep.js              # 62 checks: every view, panel, edge case
node tests/room.js              # 12 checks: two browsers sharing one room
node tests/hunt.js              # 17 checks: downloads page + room stress
node tests/platform.js          # 60 checks: every OS gets the right build
node tests/release.js           # 7 checks: GitHub Release fallback
node tests/perf.js              # 13 checks: runtime cost and stale replies
node tests/stress.js            # 18 checks: heavy use, leaks, missing browser APIs
```

All seven together: **190 checks**.

`deep.js` covers all 14 views twice, every panel, all 16 sound modes, 10 EQ
presets, 5 quality tiers, 8 themes, 4 densities, 4 typefaces, 3 corner styles,
6 accents, empty-queue transport, every keyboard shortcut, six search edge cases
including HTML injection, rapid clicking, playlists, queue tools, fullscreen
tabs, sleep timer, command palette, context menu, bad room codes, corrupt local
storage and a fully offline start.

`room.js` runs two independent browsers: host creates a room and plays a track,
guest joins by code, and it verifies both hear the same song, both see the
member count, a guest-added track reaches the host queue, chat flows both ways,
and the host's Next button moves the guest too.


`hunt.js` hammers the newer surfaces: the Get the App page, every room button
with an empty queue, rapid adds, removing every track, chat spam, leave and
rejoin, and navigating away from an active room and back.

`platform.js` first asks the server for its build list and does a HEAD request
against every advertised file, so a download that 404s or is truncated fails the
run. It then boots the app six times pretending to be an iPhone, an iPad, an
Android phone, Windows, macOS and Linux, and for each one checks that the home
strip names that platform, that all six cards render, that the visitor's own
build is highlighted and sorted first, that no card is a dead "Coming soon"
end, and that the download link actually resolves. On iOS it opens the Add to
Home Screen guide instead and checks the wording mentions Safari.

`release.js` covers the case that matters on Render: the desktop installers are
too big for git, so the repository ships without them and the server has to fall
back to the assets on the latest GitHub Release. It stands up a fake
`api.github.com` on localhost, runs a copy of `server.js` against a tree with an
**empty** `downloads/`, and checks all five platforms are still offered, that
every advertised URL resolves, and that dropping a real file into `downloads/`
makes the local copy win again. No network and no real release required.

Note: jsdom silently ignores its `userAgent` option, so `platform.js` pins
`navigator.userAgent`, `navigator.platform` and `navigator.maxTouchPoints` by
hand. Without that every simulated device reports as Linux and the test is
meaningless while still appearing to pass.

`perf.js` guards the things that were measurably wrong and are easy to bring
back. It instruments the DOM after the app has booted, then fires a second's
worth of `timeupdate` events and counts the work: the tick must stay under 600
operations a second, must not re-query the DOM, and must write nothing at all
when the clock has not moved. It also pumps forty animation frames while idle
and requires zero writes, walks twelve views three times and requires the node
count not to grow, and checks the CSS does not leave `will-change` on at rest,
does not keep the boot equaliser animating behind `visibility:hidden`, and does
not drift the artwork while paused.

The last check is a real race: the first `/api/suggest` reply is delayed by 1.4
seconds while a second query answers in 40 ms. Before the fix the slow reply
landed last and the suggestion list showed results for a query the user had
already moved on from.

`stress.js` uses the app the way an impatient person does and then checks
nothing has quietly broken. It mashes next 120 times, scrubs the seek bar
through 120 positions, flips all sixteen sound modes four times over, spams
every appearance control three times, plays thirty tracks and ends a hundred
and fifty, and exports the library five times. Then it asserts the DOM has not
grown, the seek position is still sane, the audio graph has not spawned nodes
without end, history is recording and capped at 120 with no duplicates,
storage is nowhere near the 5 MB browser budget, object URLs are released,
nothing is still animating, and the session finished with zero runtime errors.

Every error it sees is printed with the section that was running, so a failure
tells you where to look rather than only that something went wrong.

It also runs without some browser APIs on purpose. That is how the EventSource
crash was found: in a browser with no `EventSource` the room joined, set its
state, and then threw before the polling fallback was ever started, leaving a
room that looked connected and never updated again.
