# Sonora — Disclaimer, Copyright and Legal Notice

**Last updated: 2026-08-25. Please read this before using, redistributing or
building on Sonora.** It is written to be published as-is.

---

## 1. What Sonora is and is not

Sonora is a **player application** — an interface with a real 7-band
equaliser, sound modes, synced lyrics, downloads and listening rooms. It is
**not a content provider**:

- Sonora hosts **no audio, no artwork, no lyrics of its own**.
- Music metadata is fetched from a third-party catalogue service
  (JioSaavn / Saavn) through an endpoint that service publishes for its own
  website. Sonora has no agreement with that service; the API is neither
  licensed nor authorised for third-party use and may be changed, limited
  or blocked at any time.
- Audio streams are served directly from that service's CDN to the
  listener's device. Sonora's servers do not store, transcode or
  redistribute any audio.

## 2. Copyright

All music, artwork, lyrics and other audio-visual content accessible through
Sonora is the property of its respective owners:

- **record labels, artists, composers and publishers** who own the
  recordings, compositions and cover art, and
- **the catalogue service** (JioSaavn/Saavn) and its licensors.

No ownership is claimed over any of it. Nothing in this project grants any
right to that content.

## 3. Usage at your own risk

You are responsible for how you use Sonora:

- Laws on streaming, downloading and private/public playback differ by
  country. What is lawful where you live is **your** responsibility to
  determine.
- **Private, personal listening** is the least risky use.
- **Downloading files, public playback, or redistribution of any content**
  is materially riskier and may infringe copyright in your jurisdiction.
- The operators of Sonora provide it "as is" with **no warranty** and accept
  **no liability** for any use, infringement or loss arising from it.

## 4. Takedowns and rights-holders

If you are a rights-holder and believe content should be removed or
restricted:

1. Contact us on Telegram: **https://t.me/sonoramusicm** (the fastest route),
   or open an issue on **https://github.com/twgw9/sonora**.
2. Include the specific items (song/album/artwork), and proof of ownership.
3. Because no media passes through Sonora's servers, the practical remedy is
   removal of the metadata entry and/or the whole project — which we will do
   promptly and without argument on a valid request.

## 5. Licence (code only)

The **code** in this repository (HTML, CSS, JavaScript, Electron shell,
server, build scripts, documentation text authored by the project) is
licensed under the **MIT Licence** — see `LICENSE`. That licence covers **the
code only**. It does **not** cover the music, artwork or lyrics reachable
through it, which remain the property of their owners and are not offered,
licensed or conveyed by this repository in any way. Forking, modifying and
redistributing the code does not transfer any content rights.

No attribution, credit or fee is given or implied for any content that the
application happens to render.

## 6. Data and privacy (summary)

- Accounts: **none**. Sonora has no login, no user database, no tracking
  cookies.
- Your library (likes, playlists, history, settings) stays **on your
  device** (localStorage). Export it from Settings if you want a backup.
- The optional self-update feature reads the version file from the repository
  listed in `version.json`; the update source is baked in and cannot be
  redirected by a user.
- Requests to the catalogue service reveal your IP address to that service,
  as with any direct stream. See DEPLOY.md for the hosted server's logging.

## 7. Third-party services

- **JioSaavn / Saavn** — catalogue metadata and audio CDN; their own terms
  of service apply to their content.
- **LRCLIB** — open synced-lyrics database (CC-BY-NC-SA for its data);
  used as a supplemental lyrics source when the primary one has none.

## 8. Changes

This document may be updated as the project changes; the date at the top is
the authoritative version. Continuing to use Sonora after an update means
you accept the revised terms.
