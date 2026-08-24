# Putting Sonora on GitHub, and keeping it updated

The short version: push the source, attach the installers to a release, and
every copy updates itself from then on.

---

## Why there are three zips

GitHub refuses any single file over 100 MB in a push, and warns above 50 MB.
The desktop installers are 67 to 91 MB each. They cannot live in the repository
— but they can live on a **release**, which has no such limit and does not
count against repository size.

| Zip | Size | Where it goes |
|---|---|---|
| `Sonora-source.zip` | ~3 MB | **The repository.** Source, tests, docs, the APK. |
| `Sonora-apps-windows.zip` | 67 MB | A **release**, as an attached file. |
| `Sonora-apps-mac-linux.zip` | 225 MB | A **release**, as attached files. |

Upload them separately, at your own pace. Nothing breaks in between: the
website simply shows Android until the release exists, then picks up the rest
on its own.

---

## Step 1 — the repository

1. Go to <https://github.com/twgw9/sonora>
2. **Add file** → **Upload files**
3. Unzip `Sonora-source.zip` on your computer, then drag **everything inside
   it** into the browser — not the zip itself, the files
4. Commit

That is the website done. If Render is connected, it redeploys by itself.

## Step 2 — the desktop installers

1. On the repository, **Releases** → **Draft a new release**
2. Tag: `v6` — Title: `Sonora v6`
3. Unzip the two app zips and drag these four files into the attachments box:
   - `SonoraSetup.exe`
   - `Sonora-mac.zip`
   - `Sonora-1.0.0.AppImage`
   - `sonora-desktop_1.0.0_amd64.deb`
4. **Publish release**

Within the hour — instantly on a redeploy — the Get the App page shows all
five platforms. **You do not have to configure anything.** The server reads the
repository address out of `version.json`, asks GitHub for the newest release,
and links to whatever it finds there.

### Why Windows still said "not available"

Because a release had never been published, and the sandbox that builds these
does not keep large files between sessions. The exe existed but nothing was
serving it. Once step 2 is done that stops happening — the release is
permanent and the site reads from it.

---

## Step 3 — every later update

Replace the changed files in the repository the same way, and bump the
`version` number in `version.json`. That number is the whole mechanism:

- **The website** checks every 30 minutes and refreshes itself
- **The Android app** checks on launch and every six hours
- **The desktop apps** check on launch

Each one downloads the new interface into a temporary copy first and rejects
anything that fails to parse, so a bad upload cannot brick an installed app.
There is a Roll back button in Settings either way.

Only `version.json` needs the bump. If you forget it, nothing updates — the
files change but no client has any reason to look.

### If you changed native code

The interface updates over the air, but the Android shell and the desktop
shell do not. A change to `app.js`, `index.html` or `styles.css` reaches
everyone automatically. A change to the Java or to Electron needs a fresh APK
or installer attached to a new release.

---

## Things worth knowing

**The signing key is not in the zip, on purpose.** `apk/sonora-signing.jks`
must never be published. Anyone holding it can build an APK that Android
accepts as a genuine Sonora update and installs straight over yours. Keep it
in a password manager. Losing it means no future APK can ever install over an
existing one — every user would have to uninstall first and lose their library.

**The update source cannot be changed from inside the app.** It is baked in and
there is deliberately no field for it, because a box that repoints the app at
any URL is a way to hand someone a link that turns their copy into something
else.

**Read `DISCLAIMER.md` before making the repository public.** It is written to
be pasted as-is and covers ownership, the licence boundary and takedowns.
