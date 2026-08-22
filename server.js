/* =============================================================
   SONORA v4 — hardened backend
   Node 18+ · zero npm dependencies
   - never crashes (process guards + per-request try/catch)
   - multi-source failover (JioSaavn primary + 3 mirrors)
   - stale-while-revalidate cache, request coalescing
   - per-IP rate limit, connection caps, backpressure-safe proxy
   - circuit breaker per upstream, gzip, ETag, SSE rooms
   ============================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DEV = process.env.NODE_ENV !== 'production';

/* ---------- never die ---------- */
process.on('uncaughtException', e => console.error('[uncaught]', e && e.message));
process.on('unhandledRejection', e => console.error('[unhandled]', e && (e.message || e)));
process.on('SIGTERM', () => { console.log('SIGTERM'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000); });

/* ---------- constants ---------- */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const HDRS = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate' };
const SAAVN = 'https://www.jiosaavn.com/api.php';
/* backup mirrors (different shape — normalised in mirrorNorm) */
const MIRRORS = [
  'https://jiosaavan-api-2-harsh-patel.vercel.app',
  'https://saavn.dev/api',
  'https://jiosaavn-api-privatecvc2.vercel.app',
];

/* ---------- live presence ---------- */
const live = new Map();                     // id -> {t, song}
const LIVE_TTL = 75000;
function beat(id, song) { if (!id) return; live.set(id, { t: Date.now(), s: song || '' });
  if (live.size > 20000) { const cut = Date.now() - LIVE_TTL; for (const [k, v] of live) if (v.t < cut) live.delete(k); } }
function liveCount() { const cut = Date.now() - LIVE_TTL; let n = 0; for (const v of live.values()) if (v.t >= cut) n++; return n; }
const seenAll = new Set();                       // unique visitors since boot
let peakLive = 0, totalPlays = 0;
function liveTop() { const cut = Date.now() - LIVE_TTL, m = new Map();
  for (const v of live.values()) if (v.t >= cut && v.s) m.set(v.s, (m.get(v.s) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => ({ t, n })); }
setInterval(() => { const cut = Date.now() - LIVE_TTL; for (const [k, v] of live) if (v.t < cut) live.delete(k); }, 45000).unref();

/* ---------- metrics ---------- */
const M = { req: 0, hit: 0, miss: 0, err: 0, up: Date.now(), stream: 0, rooms: 0 };

/* ---------- LRU + SWR cache ---------- */
const CAP = 3000;
const cache = new Map();
function cget(k) {
  const v = cache.get(k); if (!v) return null;
  cache.delete(k); cache.set(k, v);                       // LRU bump
  if (Date.now() > v.hard) { cache.delete(k); return null; }
  return v;                                                // {d, soft, hard}
}
function cset(k, d, ttl) {
  if (cache.size >= CAP) { const it = cache.keys(); for (let i = 0; i < 60; i++) { const n = it.next(); if (n.done) break; cache.delete(n.value); } }
  cache.set(k, { d, soft: Date.now() + ttl, hard: Date.now() + ttl * 8 });
}

/* ---------- circuit breaker ---------- */
const brk = new Map();
const brkOk = h => { const b = brk.get(h); return !b || b.until < Date.now(); };
const brkFail = h => { const b = brk.get(h) || { n: 0 }; b.n++; if (b.n >= 3) { b.until = Date.now() + 45000; b.n = 0; } brk.set(h, b); };
const brkPass = h => brk.delete(h);

/* ---------- fetch with timeout + retry ---------- */
async function jget(url, { timeout = 11000, tries = 2, headers = HDRS } = {}) {
  let last;
  for (let i = 0; i <= tries; i++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: c.signal, redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      try { return JSON.parse(txt); }
      catch { const i2 = txt.indexOf('{'), i3 = txt.indexOf('['); const s = i2 < 0 ? i3 : i3 < 0 ? i2 : Math.min(i2, i3);
        if (s < 0) throw new Error('not json'); return JSON.parse(txt.slice(s)); }
    } catch (e) { last = e; if (i < tries) await new Promise(r => setTimeout(r, 250 * (i + 1) ** 2)); }
    finally { clearTimeout(t); }
  }
  throw last;
}

/* ---------- primary upstream ---------- */
const inflight = new Map();
let upBusy = 0; const UP_MAX = 24; const upQ = [];
function upSlot() { if (upBusy < UP_MAX) { upBusy++; return Promise.resolve(); }
  return new Promise(r => upQ.push(r)).then(() => { upBusy++; }); }
function upFree() { upBusy--; const n = upQ.shift(); if (n) n(); }

async function saavn(params, ttl = 6e5) {
  const qs = new URLSearchParams({ _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0', ...params });
  const url = `${SAAVN}?${qs}`;
  const c = cget(url);
  if (c && Date.now() < c.soft) { M.hit++; return c.d; }
  if (inflight.has(url)) return inflight.get(url);
  M.miss++;
  const p = (async () => {
    await upSlot();
    try { const j = await jget(url); brkPass('saavn'); cset(url, j, ttl); return j; }
    catch (e) { brkFail('saavn'); if (c) return c.d; throw e; }        // serve stale on failure
    finally { upFree(); }
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  if (c) { p.catch(() => { }); return c.d; }                            // SWR: instant stale, refresh behind
  return p;
}

/* ---------- backup mirrors ---------- */
async function mirror(pathQ) {
  for (const h of MIRRORS) {
    if (!brkOk(h)) continue;
    try { const j = await jget(h + pathQ, { timeout: 8000, tries: 0 }); brkPass(h); return j.data ?? j.results ?? j; }
    catch (e) { brkFail(h); }
  }
  return null;
}
const mSong = s => s && ({
  id: s.id, t: dec(s.name || s.title), a: dec(s.artists?.primary?.map(x => x.name).join(', ') || s.primaryArtists || ''),
  al: dec(s.album?.name || s.album || ''), alId: s.album?.id || '',
  img: pickImg(s.image), d: +(s.duration || 0) || 0, y: s.year || '', lg: s.language || '',
  pl: +(s.playCount || 0) || 0, lb: dec(s.label || ''), ly: !!s.hasLyrics,
  u: mUrls(s.downloadUrl || s.downloadUrls), raw: (mUrls(s.downloadUrl || s.downloadUrls) || {})['320'] || '',
});
function pickImg(im) { if (!im) return ''; if (typeof im === 'string') return im;
  const a = Array.isArray(im) ? im : Object.values(im);
  const n = a.map(x => typeof x === 'string' ? { url: x } : x).filter(Boolean);
  const b = n.find(x => String(x.quality || '').includes('500')) || n[n.length - 1] || {};
  return b.url || b.link || ''; }
function mUrls(dl) { const o = {}; if (!dl) return o;
  (Array.isArray(dl) ? dl : Object.values(dl)).forEach(x => { if (!x || typeof x === 'string') return;
    const q = String(x.quality || '').replace(/\D/g, ''); if (q) o[q] = x.url || x.link; }); return o; }

/* ---------- media decrypt ---------- */
const KEY = Buffer.from('38346591', 'utf8');
function decryptUrl(enc) {
  if (!enc) return '';
  for (const pad of [true, false]) {
    try { const d = crypto.createDecipheriv('des-ecb', KEY, null); d.setAutoPadding(pad);
      const s = Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
      if (s.startsWith('http')) return s.replace(/[^\x20-\x7e]+$/g, '');
    } catch (e) { }
  }
  return '';
}
const QS = ['12', '48', '96', '160', '320'];
const urlSet = b => { const o = {}; if (b) QS.forEach(q => o[q] = b.replace(/_(12|48|96|160|320)\.mp4/, `_${q}.mp4`)); return o; };

/* ---------- normalise ---------- */
const dec = s => String(s ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'")
  .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
const big = i => String(i || '').replace(/50x50|150x150/g, '500x500');
function song(s) {
  if (!s || !s.id) return null;
  const mi = s.more_info || {};
  const base = decryptUrl(mi.encrypted_media_url);
  const art = mi.artistMap?.primary_artists?.map(a => a.name).join(', ')
    || mi.artistMap?.artists?.slice(0, 3).map(a => a.name).join(', ')
    || (s.subtitle || '').split(' - ')[0] || 'Unknown';
  return { id: s.id, t: dec(s.title || s.name), a: dec(art), al: dec(mi.album || s.album || ''),
    alId: mi.album_id || '', img: big(s.image), d: parseInt(mi.duration || s.duration || 0, 10) || 0,
    y: s.year || mi.year || '', lg: s.language || '', pl: parseInt(s.play_count || 0, 10) || 0,
    lb: dec(mi.label || ''), ly: mi.has_lyrics === 'true', u: urlSet(base), raw: base || '' };
}
const coll = c => c && ({ id: c.id, k: c.type || 'album', t: dec(c.title || c.name),
  s: dec(c.subtitle || c.more_info?.music || c.more_info?.artistMap?.primary_artists?.[0]?.name ||
    (c.more_info?.song_count ? c.more_info.song_count + ' songs' : '')),
  img: big(c.image), n: parseInt(c.more_info?.song_count || 0, 10) || 0, y: c.year || '' });
const artistC = a => ({ id: a.id, k: 'artist', t: dec(a.name || a.title), s: dec(a.description || a.role || 'Artist'), img: big(a.image) });
const uniq = a => { const s = new Set(); return a.filter(x => x && x.id && !s.has(x.id) && s.add(x.id)); };

/* =============================================================
   ROOMS
   ============================================================= */
const rooms = new Map();
const MAXROOM = 400;
function room(code) {
  code = String(code || '').toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, '') || 'LOBBY';
  if (!rooms.has(code)) {
    if (rooms.size >= MAXROOM) { for (const [k, r] of rooms) if (!r.cl.size) { rooms.delete(k); break; } }
    rooms.set(code, { code, q: [], i: 0, playing: false, at: 0, since: Date.now(), cl: new Set(), chat: [], users: new Map(), host: null, born: Date.now() });
  }
  return rooms.get(code);
}
const rpos = r => r.playing ? r.at + (Date.now() - r.since) / 1000 : r.at;
const snap = r => ({ code: r.code, queue: r.q, idx: r.i, playing: r.playing, pos: rpos(r),
  users: [...r.users.entries()].map(([id, u]) => ({ n: u.n, id, host: id === r.host })),
  host: r.host, chat: r.chat.slice(-50), n: r.users.size });
function push(r) {
  const s = `event: state\ndata: ${JSON.stringify(snap(r))}\n\n`;
  for (const c of [...r.cl]) { try { if (!c.writableEnded) c.write(s); else r.cl.delete(c); } catch { r.cl.delete(c); } }
}
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rooms) {
    for (const [id, u] of r.users) if (now - u.t > 12e4) r.users.delete(id);
    if (!r.cl.size && now - r.since > 12e5) rooms.delete(k);
  }
  M.rooms = rooms.size;
}, 6e4).unref();

/* =============================================================
   RATE LIMIT
   ============================================================= */
const buckets = new Map();
const BURST = 600, RATE = 60;                            // burst 600, refill 60/s per IP
function allow(ip, cost = 1) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) { b = { t: BURST, ts: now }; buckets.set(ip, b); }
  b.t = Math.min(BURST, b.t + (now - b.ts) / 1000 * RATE);
  b.ts = now;
  if (b.t < cost) return false;
  b.t -= cost; return true;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.ts > 12e4) buckets.delete(k); }, 6e4).unref();
const ipOf = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';

/* =============================================================
   ROUTES
   ============================================================= */
const R = {};

R['/api/health'] = async () => ({ ok: true, uptime: Math.round((Date.now() - M.up) / 1000), req: M.req, hits: M.hit, miss: M.miss, err: M.err, streams: M.stream, cache: cache.size, rooms: rooms.size, mem: Math.round(process.memoryUsage().rss / 1048576) + 'MB' });

R['/api/live'] = async (q, req) => {
  const id = String(q.get('id') || '').slice(0, 40);
  if (id) { beat(id, String(q.get('s') || '').slice(0, 90));
    if (seenAll.size < 200000) seenAll.add(id);
    if (q.get('p') === '1') totalPlays++; }
  const n = liveCount(); if (n > peakLive) peakLive = n;
  return { n, top: liveTop(), total: seenAll.size, peak: peakLive, plays: totalPlays,
    up: Math.round((Date.now() - M.up) / 1000) };
};

R['/api/home'] = async q => {
  const lang = String(q.get('lang') || 'hindi').toLowerCase().replace(/[^a-z]/g, '') || 'hindi';
  const ck = 'H:' + lang; const c = cget(ck);
  if (c && Date.now() < c.soft) return c.d;
  try {
    const d = await saavn({ __call: 'webapi.getLaunchData' }, 9e5);
    const A = x => Array.isArray(x) ? x : Object.values(x || {});
    const lof = x => String(x.language || x.more_info?.language || '').toLowerCase();
    const filt = arr => { const a = A(arr); const m = a.filter(x => lof(x) === lang); return m.length >= 4 ? m : a; };
    const map = (arr, f) => uniq(filt(arr).map(f).filter(Boolean)).slice(0, 20);
    const out = {
      trending: map(d.new_trending, x => x.type === 'song' ? song(x) : coll(x)),
      albums: map(d.new_albums, coll), playlists: map(d.top_playlists, coll),
      charts: uniq(A(d.charts).map(coll).filter(Boolean)).slice(0, 20),
      radio: uniq(A(d.radio).map(coll).filter(Boolean)).slice(0, 20),
    };
    if (!out.trending.length && !out.albums.length) throw new Error('empty');
    cset(ck, out, 9e5); return out;
  } catch (e) {
    if (c) return c.d;
    const m = await mirror(`/modules?language=${lang}`);
    if (m) { const out = { trending: uniq((m.trending?.songs || []).map(mSong).filter(Boolean)),
        albums: uniq((m.albums || []).map(x => ({ id: x.id, k: 'album', t: dec(x.name), s: dec(x.artists?.primary?.[0]?.name || ''), img: pickImg(x.image) }))),
        playlists: uniq((m.playlists || []).map(x => ({ id: x.id, k: 'playlist', t: dec(x.name), s: '', img: pickImg(x.image) }))),
        charts: uniq((m.charts || []).map(x => ({ id: x.id, k: 'playlist', t: dec(x.title || x.name), s: '', img: pickImg(x.image) }))), radio: [] };
      cset(ck, out, 3e5); return out; }
    const s = await R['/api/mood'](new URLSearchParams({ q: 'top ' + lang + ' hits' })).catch(() => null);
    return { trending: s?.songs || [], albums: [], playlists: [], charts: [], radio: [], degraded: true };
  }
};

R['/api/search'] = async q => {
  const s = String(q.get('q') || '').trim().slice(0, 120); if (!s) return { songs: [] };
  const n = Math.min(60, +q.get('n') || 40);
  try { const d = await saavn({ __call: 'search.getResults', q: s, n: String(n), p: q.get('p') || '1' }, 3e5);
    const songs = uniq((d.results || []).map(song).filter(Boolean));
    if (songs.length) return { total: d.total || songs.length, songs };
    throw new Error('empty');
  } catch (e) {
    const m = await mirror(`/search/songs?query=${encodeURIComponent(s)}&limit=${n}`);
    return { songs: uniq(((m?.results) || []).map(mSong).filter(Boolean)), backup: true };
  }
};

R['/api/searchall'] = async q => {
  const s = String(q.get('q') || '').trim().slice(0, 120); if (!s) return {};
  const [a, b, c, e] = await Promise.allSettled([
    saavn({ __call: 'search.getResults', q: s, n: '40' }),
    saavn({ __call: 'search.getAlbumResults', q: s, n: '14' }),
    saavn({ __call: 'search.getArtistResults', q: s, n: '14' }),
    saavn({ __call: 'search.getPlaylistResults', q: s, n: '14' })]);
  const V = r => r.status === 'fulfilled' ? (r.value.results || []) : [];
  let songs = uniq(V(a).map(song).filter(Boolean));
  if (!songs.length) { const m = await mirror(`/search/songs?query=${encodeURIComponent(s)}&limit=40`);
    songs = uniq(((m?.results) || []).map(mSong).filter(Boolean)); }
  return { songs, albums: uniq(V(b).map(coll).filter(Boolean)),
    artists: uniq(V(c).map(artistC).filter(Boolean)),
    playlists: uniq(V(e).map(x => ({ ...coll(x), k: 'playlist' })).filter(Boolean)) };
};

R['/api/suggest'] = async q => {
  const s = String(q.get('q') || '').trim().slice(0, 80); if (s.length < 2) return { items: [] };
  try { const d = await saavn({ __call: 'autocomplete.get', query: s, cc: 'in', includeMetaData: 'n' }, 9e5);
    const g = (o, k, n = 4) => (o?.data || []).slice(0, n).map(x => ({ k, id: x.id, t: dec(x.title), s: dec(x.description || x.subtitle || ''), img: big(x.image) }));
    return { items: [...g(d.songs, 'song', 5), ...g(d.artists, 'artist', 3), ...g(d.albums, 'album', 3), ...g(d.playlists, 'playlist', 2)] };
  } catch { return { items: [] }; }
};
R['/api/top'] = async () => { try { return { items: uniq((await saavn({ __call: 'content.getTopSearches' }, 18e5) || []).map(coll).filter(Boolean)) }; } catch { return { items: [] }; } };
R['/api/album'] = async q => { try { const d = await saavn({ __call: 'content.getAlbumDetails', albumid: q.get('id') });
    return { info: coll(d), songs: uniq((d.list || d.songs || []).map(song).filter(Boolean)) }; }
  catch { const m = await mirror(`/albums?id=${q.get('id')}`); return { songs: uniq((m?.songs || []).map(mSong).filter(Boolean)) }; } };
R['/api/playlist'] = async q => { try { const d = await saavn({ __call: 'playlist.getDetails', listid: q.get('id'), n: '150' });
    return { info: coll(d), songs: uniq((d.list || d.songs || []).map(song).filter(Boolean)) }; }
  catch { const m = await mirror(`/playlists?id=${q.get('id')}`); return { songs: uniq((m?.songs || []).map(mSong).filter(Boolean)) }; } };
R['/api/song'] = async q => { try { const d = await saavn({ __call: 'song.getDetails', pids: q.get('id') });
    return { song: song((d.songs || Object.values(d))[0]) }; }
  catch { const m = await mirror(`/songs/${q.get('id')}`); return { song: mSong(Array.isArray(m) ? m[0] : m?.songs?.[0] || m) }; } };
R['/api/lyrics'] = async q => { try { const d = await saavn({ __call: 'lyrics.getLyrics', lyrics_id: q.get('id') }, 36e5);
    return { lyrics: dec(String(d.lyrics || '').replace(/<br\s*\/?>/gi, '\n')) }; } catch { return { lyrics: '' }; } };
R['/api/similar'] = async q => { try { const d = await saavn({ __call: 'reco.getreco', pid: q.get('id') }, 18e5);
    return { songs: uniq((Array.isArray(d) ? d : d.data || []).map(song).filter(Boolean)) }; } catch { return { songs: [] }; } };
R['/api/mood'] = async q => {
  const s = String(q.get('q') || 'lofi').slice(0, 100);
  try { const d = await saavn({ __call: 'search.getResults', q: s, n: String(Math.min(50, +q.get('n') || 35)) }, 12e5);
    const songs = uniq((d.results || []).map(song).filter(Boolean)); if (songs.length) return { songs }; throw 0;
  } catch { const m = await mirror(`/search/songs?query=${encodeURIComponent(s)}&limit=35`);
    return { songs: uniq(((m?.results) || []).map(mSong).filter(Boolean)) }; }
};

const ERAS = {
  '1950': ['mohammed rafi 1950s', 'lata mangeshkar 1950s', 'talat mahmood', 'geeta dutt', 'hemant kumar'],
  '1960': ['mohammed rafi 1960s', 'lata mangeshkar 1960s', 'kishore kumar 1960s', 'asha bhosle 1960s', 'mukesh old'],
  '1970': ['kishore kumar 1970s', 'mohammed rafi 1970', 'rd burman', 'asha bhosle 1970s', 'mukesh 1970s'],
  '1980': ['kishore kumar 1980s', 'lata mangeshkar 1980s', 'amit kumar', 'suresh wadkar', 'bappi lahiri'],
  '1990': ['kumar sanu 90s', 'udit narayan 90s', 'alka yagnik 90s', 'nadeem shravan', 'sonu nigam 90s'],
  '2000': ['himesh reshammiya 2000s', 'sonu nigam 2000s', 'shreya ghoshal 2000s', 'kk hits', 'atif aslam old'],
  '2010': ['arijit singh 2010s', 'atif aslam 2010s', 'shreya ghoshal 2010s', 'yo yo honey singh', 'mithoon'],
};
R['/api/goldmix'] = async q => {
  const ck = 'GOLDMIX'; const c = cget(ck); if (c && Date.now() < c.soft) return c.d;
  const groups = [
    ['Modern remakes', ['bollywood recreated songs', 'old song new version hindi', 'unplugged cover hindi']],
    ['Lo-fi classics', ['old hindi lofi flip', 'retro lofi bollywood']],
    ['Timeless originals', ['evergreen hindi classics', 'golden melodies hindi']],
  ];
  const out = {};
  await Promise.all(groups.map(async ([label, qs]) => {
    const res = await Promise.allSettled(qs.map(x => saavn({ __call: 'search.getResults', q: x, n: '18' }, 36e5)));
    let all = []; res.forEach(r => { if (r.status === 'fulfilled') all.push(...(r.value.results || []).map(song).filter(Boolean)); });
    out[label] = uniq(all).sort((a, b) => b.pl - a.pl).slice(0, 20);
  }));
  if (!Object.values(out).some(a => a.length) && c) return c.d;
  cset(ck, out, 36e5); return out;
};

R['/api/era'] = async q => {
  const e = ERAS[q.get('e')] ? q.get('e') : '1990';
  const lang = String(q.get('lang') || 'hindi').toLowerCase().replace(/[^a-z]/g, '');
  const ck = `E:${e}:${lang}`; const c = cget(ck); if (c && Date.now() < c.soft) return c.d;
  const lo = +e, hi = lo + 9;
  const res = await Promise.allSettled(ERAS[e].map(s => saavn({ __call: 'search.getResults', q: lang === 'hindi' ? s : `${s} ${lang}`, n: '25' }, 36e5)));
  let all = []; res.forEach(r => { if (r.status === 'fulfilled') all.push(...(r.value.results || []).map(song).filter(Boolean)); });
  all = uniq(all);
  if (!all.length && c) return c.d;
  const inE = all.filter(s => { const y = +s.y; return y >= lo && y <= hi; });
  const out = { era: e, songs: (inE.length >= 12 ? inE : all).sort((a, b) => b.pl - a.pl).slice(0, 60) };
  cset(ck, out, 36e5); return out;
};
R['/api/legends'] = async () => {
  const ck = 'LEG'; const c = cget(ck); if (c && Date.now() < c.soft) return c.d;
  const N = ['Kishore Kumar', 'Mohammed Rafi', 'Lata Mangeshkar', 'Asha Bhosle', 'Mukesh', 'R.D. Burman',
    'Kumar Sanu', 'Udit Narayan', 'Alka Yagnik', 'Jagjit Singh', 'Nusrat Fateh Ali Khan', 'Sonu Nigam'];
  const res = await Promise.allSettled(N.map(n => saavn({ __call: 'search.getArtistResults', q: n, n: '1' }, 864e5)));
  const items = []; res.forEach((r, i) => { if (r.status === 'fulfilled' && r.value.results?.[0]) items.push({ ...artistC(r.value.results[0]), t: N[i] }); });
  if (!items.length && c) return c.d;
  const out = { items }; cset(ck, out, 864e5); return out;
};

/* ---- rooms ---- */
R['/api/room/state'] = async q => { const r = rooms.get(String(q.get('c') || '').toUpperCase()); return r ? snap(r) : { error: 'no room' }; };
R['/api/room/peek'] = async q => {
  const c = String(q.get('c') || '').toUpperCase();
  const r = rooms.get(c);
  if (!r) return { exists: false, code: c };
  return { exists: true, code: c, n: r.users.size, tracks: r.q.length,
    now: r.q[r.i] ? { t: r.q[r.i].t, a: r.q[r.i].a, img: r.q[r.i].img } : null,
    users: [...r.users.values()].map(u => u.n).slice(0, 8) };
};
function sysMsg(r, m) { r.chat.push({ u: '', m, t: Date.now(), sys: 1 }); r.chat = r.chat.slice(-70); }

R['/api/room/act'] = async (q, req) => {
  const r = room(q.get('c')); const a = q.get('a');
  const uid = String(q.get('uid') || '').slice(0, 24) || (ipOf(req) + ':' + (q.get('u') || 'g'));
  const name = String(q.get('u') || 'Guest').slice(0, 18);
  const known = r.users.has(uid);
  r.users.set(uid, { n: name, t: Date.now() });
  if (!r.host || !r.users.has(r.host)) r.host = uid;          // first in becomes host
  const isHost = r.host === uid;
  const parse = () => { try { return JSON.parse(q.get('v')); } catch { return null; } };

  if (a === 'join') { if (!known) sysMsg(r, name + ' joined the room'); }
  else if (a === 'leave') { r.users.delete(uid); sysMsg(r, name + ' left');
    if (r.host === uid) r.host = [...r.users.keys()][0] || null; }
  else if (a === 'play') { if (isHost) { r.playing = true; r.since = Date.now(); } }
  else if (a === 'pause') { if (isHost) { r.at = rpos(r); r.playing = false; } }
  else if (a === 'seek') { if (isHost) { r.at = Math.max(0, +q.get('v') || 0); r.since = Date.now(); } }
  else if (a === 'idx') { if (isHost) { r.i = clampI(+q.get('v'), r.q.length); r.at = 0; r.since = Date.now(); r.playing = true; } }
  else if (a === 'jump') { r.i = clampI(+q.get('v'), r.q.length); r.at = 0; r.since = Date.now(); r.playing = true;
    sysMsg(r, name + ' jumped to track ' + (r.i + 1)); }
  else if (a === 'queue') { const j = parse(); if (Array.isArray(j)) { r.q = j.slice(0, 100); r.i = 0; r.at = 0;
    r.since = Date.now(); r.playing = true; sysMsg(r, name + ' shared ' + r.q.length + ' tracks'); } }
  else if (a === 'playnow') { const j = parse(); if (j && j.id) {
      const ex = r.q.findIndex(x => x.id === j.id);
      if (ex >= 0) r.i = ex; else { r.q.splice(r.i + 1, 0, j); r.i = clampI(r.i + 1, r.q.length); }
      r.at = 0; r.since = Date.now(); r.playing = true;
      sysMsg(r, name + ' started ' + String(j.t || 'a track').slice(0, 40)); } }
  else if (a === 'add') { const j = parse(); if (j && j.id && r.q.length < 250) {
    if (!r.q.some(x => x.id === j.id)) { r.q.push(j); sysMsg(r, name + ' added ' + String(j.t || 'a track').slice(0, 40)); } } }
  else if (a === 'addmany') { const j = parse(); if (Array.isArray(j)) { let n = 0;
    j.slice(0, 60).forEach(x => { if (x && x.id && r.q.length < 250 && !r.q.some(y => y.id === x.id)) { r.q.push(x); n++; } });
    if (n) sysMsg(r, name + ' added ' + n + ' tracks'); } }
  else if (a === 'rm') { const i = +q.get('v'); if (i >= 0 && i < r.q.length) { const g = r.q.splice(i, 1)[0];
    if (i < r.i) r.i--; else if (i === r.i) { r.at = 0; r.since = Date.now(); }
    r.i = clampI(r.i, r.q.length); sysMsg(r, name + ' removed ' + String(g?.t || 'a track').slice(0, 40)); } }
  else if (a === 'clear') { r.q = []; r.i = 0; r.at = 0; r.playing = false; sysMsg(r, name + ' cleared the queue'); }
  else if (a === 'next') { if (r.q.length) { r.i = clampI(r.i + 1, r.q.length); r.at = 0; r.since = Date.now(); r.playing = true; } }
  else if (a === 'prev') { if (r.q.length) { r.i = clampI(r.i - 1, r.q.length); r.at = 0; r.since = Date.now(); r.playing = true; } }
  else if (a === 'host') { const t = String(q.get('v') || ''); if (isHost && r.users.has(t)) { r.host = t;
    sysMsg(r, (r.users.get(t)?.n || 'Someone') + ' is now host'); } }
  else if (a === 'chat') { const m = String(q.get('v') || '').slice(0, 220);
    if (m) { r.chat.push({ u: name, m, t: Date.now() }); r.chat = r.chat.slice(-70); } }
  push(r); return snap(r);
};
function clampI(i, len) { if (!len) return 0; return Math.max(0, Math.min(len - 1, i | 0)); }

/* =============================================================
   STREAM PROXY — backpressure + abort safe
   ============================================================= */
let liveStreams = 0;
const MAXSTREAM = 600;
async function proxyStream(req, res, u) {
  const t = u.searchParams.get('u'), nm = u.searchParams.get('name');
  if (!t || !/^https:\/\/[a-z0-9.-]*saavncdn\.com\/[\w\-./%]+$/i.test(t)) { res.writeHead(400); return res.end('bad url'); }
  if (liveStreams >= MAXSTREAM) { res.writeHead(503, { 'Retry-After': '3' }); return res.end('busy'); }
  liveStreams++; M.stream++;
  const ac = new AbortController();
  let done = false;
  const cleanup = () => { if (done) return; done = true; liveStreams--; try { ac.abort(); } catch { } };
  req.on('close', cleanup); req.on('aborted', cleanup); res.on('close', cleanup); res.on('error', cleanup);
  try {
    const h = { 'User-Agent': UA }; if (req.headers.range) h.Range = req.headers.range;
    const r = await fetch(t, { headers: h, signal: ac.signal });
    if (!r.ok && r.status !== 206) { res.writeHead(r.status === 404 ? 404 : 502); return res.end(); }
    const o = { 'Content-Type': r.headers.get('content-type') || 'audio/mp4', 'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=604800, immutable' };
    const cl = r.headers.get('content-length'); if (cl) o['Content-Length'] = cl;
    const cr = r.headers.get('content-range'); if (cr) o['Content-Range'] = cr;
    if (nm) o['Content-Disposition'] = `attachment; filename="${encodeURIComponent(nm).replace(/['()*]/g, '')}"`;
    res.writeHead(r.status, o);
    if (req.method === 'HEAD') { res.end(); return cleanup(); }
    const rd = r.body.getReader();
    for (;;) {
      if (done || res.destroyed || res.writableEnded) break;
      const { done: fin, value } = await rd.read();
      if (fin) break;
      if (!res.write(Buffer.from(value))) {
        // wait for drain, but bail out if socket dies
        const ok = await new Promise(resolve => {
          let settled = false;
          const fin2 = v => { if (settled) return; settled = true;
            res.off('drain', okFn); res.off('close', bad); res.off('error', bad); resolve(v); };
          const okFn = () => fin2(true), bad = () => fin2(false);
          res.once('drain', okFn); res.once('close', bad); res.once('error', bad);
          setTimeout(() => fin2(false), 30000);
        });
        if (!ok) break;
      }
    }
    try { res.end(); } catch { }
  } catch (e) {
    if (!res.headersSent) { try { res.writeHead(502); } catch { } }
    try { res.end(); } catch { }
  } finally { cleanup(); }
}

/* =============================================================
   STATIC
   ============================================================= */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const files = new Map();
function loadFile(f) {
  let c = files.get(f);
  if (c && !DEV) return c;
  let buf; try { const st = fs.statSync(f); if (!st.isFile()) return null;
    if (c && c.mtime === st.mtimeMs) return c;
    buf = fs.readFileSync(f);
    c = { raw: buf, gz: zlib.gzipSync(buf, { level: 8 }), br: null, mtime: st.mtimeMs,
      mime: MIME[path.extname(f)] || 'application/octet-stream',
      et: '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"' };
    try { c.br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } }); } catch { }
    files.set(f, c); return c;
  } catch { return null; }
}
function sendFile(req, res, f, immutable) {
  const c = loadFile(f); if (!c) return false;
  const isHTML = /\.html$/.test(f);
  if (!isHTML && req.headers['if-none-match'] === c.et) { res.writeHead(304, { ETag: c.et }); res.end(); return true; }
  const ae = req.headers['accept-encoding'] || '';
  let body = c.raw, enc = null;
  if (c.br && /\bbr\b/.test(ae)) { body = c.br; enc = 'br'; }
  else if (/\bgzip\b/.test(ae)) { body = c.gz; enc = 'gzip'; }
  res.writeHead(200, { 'Content-Type': c.mime, ETag: c.et, 'Content-Length': body.length,
    'Cache-Control': isHTML ? 'no-store, no-cache, must-revalidate' : (immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate'),
    ...(enc ? { 'Content-Encoding': enc, Vary: 'Accept-Encoding' } : {}),
    'X-Content-Type-Options': 'nosniff' });
  req.method === 'HEAD' ? res.end() : res.end(body);
  return true;
}

/* =============================================================
   SERVER
   ============================================================= */
const server = http.createServer(async (req, res) => {
  M.req++;
  res.setHeader('Access-Control-Allow-Origin', '*');
  let u; try { u = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  const p = u.pathname;
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }); return res.end(); }
    if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    if (p === '/stream' || p === '/dl') {
      if (!allow(ipOf(req), 3)) { res.writeHead(429, { 'Retry-After': '2' }); return res.end('slow down'); }
      return proxyStream(req, res, u);
    }
    if (p === '/api/room/sub') {
      const r = room(u.searchParams.get('c'));
      if (r.cl.size > 120) { res.writeHead(503); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      res.write(`event: state\ndata: ${JSON.stringify(snap(r))}\n\n`);
      r.cl.add(res);
      const ka = setInterval(() => { try { res.write(': k\n\n'); } catch { clearInterval(ka); r.cl.delete(res); } }, 20000);
      const bye = () => { clearInterval(ka); r.cl.delete(res); push(r); };
      req.on('close', bye); res.on('error', bye);
      return;
    }
    if (R[p]) {
      const warm = p === '/api/live' || p === '/api/health' || (cache.size > 0 && p === '/api/home');
      if (!warm && !allow(ipOf(req))) { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '1' }); return res.end('{"error":"rate","retry":1}'); }
      const d = await R[p](u.searchParams, req);
      const body = Buffer.from(JSON.stringify(d));
      const ae = req.headers['accept-encoding'] || '';
      const gz = /\bgzip\b/.test(ae) && body.length > 900;
      const out = gz ? zlib.gzipSync(body, { level: 6 }) : body;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=45, stale-while-revalidate=600',
        ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}), 'Content-Length': out.length });
      return res.end(out);
    }
    if (p.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not found"}'); }

    const clean = decodeURIComponent(p).replace(/\0/g, '');
    if (clean.includes('..')) { res.writeHead(403); return res.end(); }
    const f = path.join(ROOT, clean === '/' ? 'index.html' : clean);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (clean === '/sw.js') {
      const c = loadFile(f);
      if (c) { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate', 'Service-Worker-Allowed': '/' });
        return res.end(c.raw); }
    }
    const asset = /\.(svg|png|ico|woff2)$/.test(f);
    if (sendFile(req, res, f, asset)) return;
    if (sendFile(req, res, path.join(ROOT, 'index.html'))) return;
    res.writeHead(404); res.end('404');
  } catch (e) {
    M.err++; console.error('[req]', p, e && e.message);
    if (!res.headersSent) { try { res.writeHead(500, { 'Content-Type': 'application/json' }); } catch { } }
    try { res.end('{"error":"server"}'); } catch { }
  }
});

server.on('clientError', (e, sock) => { try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { } });
server.keepAliveTimeout = 72000;
server.headersTimeout = 76000;
server.requestTimeout = 0;
server.maxRequestsPerSocket = 0;
server.timeout = 0;
/* Render free tier idles after ~15 min of no traffic; a light self-ping keeps
   the instance warm without burning quota. Set KEEPALIVE_URL in Render env. */
const KA = process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (KA) setInterval(() => { fetch(KA.replace(/\/$/, '') + '/healthz').catch(() => { }); }, 6e5).unref();

server.listen(PORT, '0.0.0.0', () => console.log('Sonora v5 on :' + PORT + (KA ? ' (keepalive on)' : '')));
