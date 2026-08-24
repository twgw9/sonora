/* =============================================================
   SONORA — backend
   Node 18+. Zero npm dependencies.
   Static server + JioSaavn bridge + DES media decryption
   + live listening Rooms (SSE).
   Render-ready: honours process.env.PORT.
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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const HDRS = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9' };
const BASE = 'https://www.jiosaavn.com/api.php';

/* ---------------- cache ---------------- */
const cache = new Map(); const CAP = 900;
const cget = k => { const v = cache.get(k); if (!v) return null; if (Date.now() > v.exp) { cache.delete(k); return null; } cache.delete(k); cache.set(k, v); return v.d; };
const cset = (k, d, ttl) => { if (cache.size > CAP) cache.delete(cache.keys().next().value); cache.set(k, { d, exp: Date.now() + (ttl || 36e5) }); };

/* ---------------- upstream ---------------- */
const inflight = new Map();
async function saavn(params, ttl = 6e5) {
  const qs = new URLSearchParams({ _format: 'json', _marker: '0', api_version: '4', ctx: 'web6dot0', ...params });
  const url = `${BASE}?${qs}`;
  const hit = cget(url); if (hit) return hit;
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    let lastErr;
    for (let a = 0; a < 3; a++) {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 11000);
      try {
        const r = await fetch(url, { headers: HDRS, signal: ctl.signal });
        const txt = await r.text();
        let j; try { j = JSON.parse(txt); } catch { j = JSON.parse(txt.slice(txt.indexOf('{'))); }
        cset(url, j, ttl); return j;
      } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 300 * (a + 1))); }
      finally { clearTimeout(to); }
    }
    throw lastErr;
  })().finally(() => inflight.delete(url));
  inflight.set(url, p); return p;
}

/* ---------------- media decrypt ---------------- */
const KEY = Buffer.from('38346591', 'utf8');
function decryptUrl(enc) {
  if (!enc) return '';
  for (const pad of [true, false]) {
    try {
      const d = crypto.createDecipheriv('des-ecb', KEY, null); d.setAutoPadding(pad);
      const s = Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
      if (s.startsWith('http')) return s.replace(/[^\x20-\x7e]+$/g, '');
    } catch (e) { }
  }
  return '';
}
const QS = ['12', '48', '96', '160', '320'];
const urlSet = b => { const o = {}; if (b) QS.forEach(q => o[q] = b.replace(/_(12|48|96|160|320)\.mp4/, `_${q}.mp4`)); return o; };

/* ---------------- normalise ---------------- */
const dec = s => String(s ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'")
  .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
const bigImg = i => String(i || '').replace(/50x50|150x150/g, '500x500');

function song(s) {
  if (!s || !s.id) return null;
  const mi = s.more_info || {};
  const base = decryptUrl(mi.encrypted_media_url);
  const art = mi.artistMap?.primary_artists?.map(a => a.name).join(', ')
    || mi.artistMap?.artists?.slice(0, 3).map(a => a.name).join(', ')
    || (s.subtitle || '').split(' - ')[0] || 'Unknown';
  return {
    id: s.id, t: dec(s.title || s.name), a: dec(art),
    al: dec(mi.album || s.album || ''), alId: mi.album_id || '',
    img: bigImg(s.image), d: parseInt(mi.duration || s.duration || 0, 10) || 0,
    y: s.year || mi.year || '', lg: s.language || '',
    pl: parseInt(s.play_count || 0, 10) || 0, lb: dec(mi.label || ''),
    ly: mi.has_lyrics === 'true', u: urlSet(base), raw: base || '',
  };
}
const coll = c => c && ({
  id: c.id, k: c.type || 'album', t: dec(c.title || c.name),
  s: dec(c.subtitle || c.more_info?.music || c.more_info?.artistMap?.primary_artists?.[0]?.name ||
    (c.more_info?.song_count ? c.more_info.song_count + ' songs' : '')),
  img: bigImg(c.image), n: parseInt(c.more_info?.song_count || 0, 10) || 0, y: c.year || '',
});
const artistC = a => ({ id: a.id, k: 'artist', t: dec(a.name || a.title), s: dec(a.description || a.role || 'Artist'), img: bigImg(a.image) });
const dedupe = arr => { const s = new Set(); return arr.filter(x => x && !s.has(x.id) && s.add(x.id)); };

/* =============================================================
   ROOMS — live shared listening
   ============================================================= */
const rooms = new Map();
function room(code) {
  if (!rooms.has(code)) rooms.set(code, { code, queue: [], idx: 0, playing: false, at: 0, since: Date.now(), clients: new Set(), chat: [], host: null, users: {} });
  return rooms.get(code);
}
function pos(r) { return r.playing ? r.at + (Date.now() - r.since) / 1000 : r.at; }
function push(r, ev, data) {
  const s = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of r.clients) { try { c.write(s); } catch (e) { r.clients.delete(c); } }
}
const snap = r => ({ code: r.code, queue: r.queue, idx: r.idx, playing: r.playing, pos: pos(r), users: Object.values(r.users), chat: r.chat.slice(-40) });
setInterval(() => { for (const [k, r] of rooms) if (!r.clients.size && Date.now() - r.since > 18e5) rooms.delete(k); }, 3e5);

/* =============================================================
   ROUTES
   ============================================================= */
const R = {};

R['/api/home'] = async q => {
  const lang = (q.get('lang') || 'hindi').toLowerCase();
  const ck = 'H' + lang; const h = cget(ck); if (h) return h;
  const d = await saavn({ __call: 'webapi.getLaunchData' }, 9e5);
  const A = x => Array.isArray(x) ? x : Object.values(x || {});
  const lof = x => String(x.language || x.more_info?.language || '').toLowerCase();
  const filt = arr => { const a = A(arr); const m = a.filter(x => lof(x) === lang); return m.length >= 4 ? m : a; };
  const map = (arr, f) => dedupe(filt(arr).map(f).filter(Boolean)).slice(0, 20);
  const out = {
    trending: map(d.new_trending, x => x.type === 'song' ? song(x) : coll(x)),
    albums: map(d.new_albums, coll),
    playlists: map(d.top_playlists, coll),
    charts: dedupe(A(d.charts).map(coll).filter(Boolean)).slice(0, 20),
    radio: dedupe(A(d.radio).map(coll).filter(Boolean)).slice(0, 20),
  };
  cset(ck, out, 9e5); return out;
};

R['/api/search'] = async q => {
  const s = (q.get('q') || '').trim(); if (!s) return { songs: [] };
  const d = await saavn({ __call: 'search.getResults', q: s, n: q.get('n') || '40', p: q.get('p') || '1' }, 3e5);
  return { total: d.total || 0, songs: dedupe((d.results || []).map(song).filter(Boolean)) };
};

R['/api/searchall'] = async q => {
  const s = (q.get('q') || '').trim(); if (!s) return {};
  const [a, b, c, e] = await Promise.allSettled([
    saavn({ __call: 'search.getResults', q: s, n: '40' }),
    saavn({ __call: 'search.getAlbumResults', q: s, n: '14' }),
    saavn({ __call: 'search.getArtistResults', q: s, n: '14' }),
    saavn({ __call: 'search.getPlaylistResults', q: s, n: '14' })]);
  const V = r => r.status === 'fulfilled' ? (r.value.results || []) : [];
  return {
    songs: dedupe(V(a).map(song).filter(Boolean)),
    albums: dedupe(V(b).map(coll).filter(Boolean)),
    artists: dedupe(V(c).map(artistC).filter(Boolean)),
    playlists: dedupe(V(e).map(x => ({ ...coll(x), k: 'playlist' })).filter(Boolean)),
  };
};

R['/api/suggest'] = async q => {
  const s = (q.get('q') || '').trim(); if (s.length < 2) return { items: [] };
  const d = await saavn({ __call: 'autocomplete.get', query: s, cc: 'in', includeMetaData: 'n' }, 9e5);
  const g = (o, k, n = 4) => (o?.data || []).slice(0, n).map(x => ({ k, id: x.id, t: dec(x.title), s: dec(x.description || x.subtitle || ''), img: bigImg(x.image) }));
  return { items: [...g(d.songs, 'song', 5), ...g(d.artists, 'artist', 3), ...g(d.albums, 'album', 3), ...g(d.playlists, 'playlist', 2)] };
};

R['/api/top'] = async () => ({ items: dedupe((await saavn({ __call: 'content.getTopSearches' }, 18e5) || []).map(coll).filter(Boolean)) });
R['/api/album'] = async q => { const d = await saavn({ __call: 'content.getAlbumDetails', albumid: q.get('id') }); return { info: coll(d), songs: dedupe((d.list || d.songs || []).map(song).filter(Boolean)) }; };
R['/api/playlist'] = async q => { const d = await saavn({ __call: 'playlist.getDetails', listid: q.get('id'), n: '150' }); return { info: coll(d), songs: dedupe((d.list || d.songs || []).map(song).filter(Boolean)) }; };
R['/api/song'] = async q => { const d = await saavn({ __call: 'song.getDetails', pids: q.get('id') }); return { song: song((d.songs || Object.values(d))[0]) }; };

R['/api/lyrics'] = async q => {
  try { const d = await saavn({ __call: 'lyrics.getLyrics', lyrics_id: q.get('id') }, 36e5);
    return { lyrics: dec(String(d.lyrics || '').replace(/<br\s*\/?>/gi, '\n')) }; }
  catch { return { lyrics: '' }; }
};
R['/api/similar'] = async q => {
  try { const d = await saavn({ __call: 'reco.getreco', pid: q.get('id') }, 18e5);
    return { songs: dedupe((Array.isArray(d) ? d : d.data || []).map(song).filter(Boolean)) }; }
  catch { return { songs: [] }; }
};
R['/api/mood'] = async q => {
  const d = await saavn({ __call: 'search.getResults', q: q.get('q') || 'lofi', n: q.get('n') || '35' }, 12e5);
  return { songs: dedupe((d.results || []).map(song).filter(Boolean)) };
};

/* ---- ERA / retro engine ---- */
const ERA_SEEDS = {
  '1950': ['mohammed rafi 1950s', 'lata mangeshkar 1950s', 'talat mahmood', 'geeta dutt', 'hemant kumar'],
  '1960': ['mohammed rafi 1960s', 'lata mangeshkar 1960s', 'kishore kumar 1960s', 'asha bhosle 1960s', 'mukesh old'],
  '1970': ['kishore kumar 1970s', 'mohammed rafi 1970', 'rd burman', 'asha bhosle 1970s', 'mukesh 1970s'],
  '1980': ['kishore kumar 1980s', 'lata mangeshkar 1980s', 'amit kumar', 'suresh wadkar', 'bappi lahiri'],
  '1990': ['kumar sanu 90s', 'udit narayan 90s', 'alka yagnik 90s', 'nadeem shravan', 'sonu nigam 90s'],
  '2000': ['himesh reshammiya 2000s', 'sonu nigam 2000s', 'shreya ghoshal 2000s', 'kk hits', 'atif aslam old'],
  '2010': ['arijit singh 2010s', 'atif aslam 2010s', 'shreya ghoshal 2010s', 'honey singh', 'mithoon'],
};
R['/api/era'] = async q => {
  const e = q.get('e') || '1990';
  const lang = (q.get('lang') || 'hindi').toLowerCase();
  const ck = `E${e}:${lang}`; const h = cget(ck); if (h) return h;
  const seeds = ERA_SEEDS[e] || [`${e}s ${lang} hits`];
  const lo = +e, hi = lo + 9;
  const res = await Promise.allSettled(seeds.map(s => saavn({ __call: 'search.getResults', q: lang === 'hindi' ? s : `${s} ${lang}`, n: '25' }, 36e5)));
  let all = [];
  res.forEach(r => { if (r.status === 'fulfilled') all.push(...(r.value.results || []).map(song).filter(Boolean)); });
  all = dedupe(all);
  const inEra = all.filter(s => { const y = +s.y; return y >= lo && y <= hi; });
  const out = { era: e, songs: (inEra.length >= 12 ? inEra : all).sort((a, b) => b.pl - a.pl).slice(0, 60) };
  cset(ck, out, 36e5); return out;
};
R['/api/legends'] = async () => {
  const ck = 'LEG'; const h = cget(ck); if (h) return h;
  const names = ['Kishore Kumar', 'Mohammed Rafi', 'Lata Mangeshkar', 'Asha Bhosle', 'Mukesh', 'R.D. Burman', 'Kumar Sanu', 'Udit Narayan', 'Alka Yagnik', 'Jagjit Singh', 'Nusrat Fateh Ali Khan', 'Sonu Nigam'];
  const res = await Promise.allSettled(names.map(n => saavn({ __call: 'search.getArtistResults', q: n, n: '1' }, 864e5)));
  const items = [];
  res.forEach((r, i) => { if (r.status === 'fulfilled' && r.value.results?.[0]) items.push({ ...artistC(r.value.results[0]), t: names[i] }); });
  const out = { items };
  cset(ck, out, 864e5); return out;
};

/* ---- ROOMS ---- */
R['/api/room/state'] = async q => { const r = rooms.get(q.get('c')); return r ? snap(r) : { error: 'no room' }; };
R['/api/room/act'] = async q => {
  const r = room(q.get('c')); const a = q.get('a');
  if (a === 'play') { r.playing = true; r.since = Date.now(); }
  if (a === 'pause') { r.at = pos(r); r.playing = false; }
  if (a === 'seek') { r.at = +q.get('v') || 0; r.since = Date.now(); }
  if (a === 'idx') { r.idx = +q.get('v') || 0; r.at = 0; r.since = Date.now(); r.playing = true; }
  if (a === 'queue') { try { r.queue = JSON.parse(decodeURIComponent(q.get('v'))); r.idx = 0; r.at = 0; r.since = Date.now(); r.playing = true; } catch (e) { } }
  if (a === 'add') { try { r.queue.push(JSON.parse(decodeURIComponent(q.get('v')))); } catch (e) { } }
  if (a === 'chat') { r.chat.push({ u: q.get('u') || 'guest', m: String(q.get('v') || '').slice(0, 200), t: Date.now() }); r.chat = r.chat.slice(-60); }
  if (a === 'join') { r.users[q.get('u')] = { n: q.get('u'), t: Date.now() }; }
  push(r, 'state', snap(r));
  return snap(r);
};

/* =============================================================
   STREAM PROXY
   ============================================================= */
async function stream(req, res, u) {
  const t = u.searchParams.get('u'), name = u.searchParams.get('name');
  if (!t || !/^https:\/\/[a-z0-9.-]*saavncdn\.com\//i.test(t)) { res.writeHead(400); return res.end('bad'); }
  const h = { ...HDRS }; if (req.headers.range) h.Range = req.headers.range;
  try {
    const r = await fetch(t, { headers: h });
    const o = { 'Content-Type': r.headers.get('content-type') || 'audio/mp4', 'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=604800' };
    const cl = r.headers.get('content-length'); if (cl) o['Content-Length'] = cl;
    const cr = r.headers.get('content-range'); if (cr) o['Content-Range'] = cr;
    if (name) o['Content-Disposition'] = `attachment; filename="${encodeURIComponent(name).replace(/['()*]/g, '')}"`;
    res.writeHead(r.status, o);
    if (req.method === 'HEAD') return res.end();
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; if (!res.write(Buffer.from(value))) await new Promise(x => res.once('drain', x)); }
    res.end();
  } catch (e) { try { res.writeHead(502); res.end(); } catch (_) { } }
}

/* =============================================================
   SERVER
   ============================================================= */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const statics = new Map();

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': '*' }); return res.end(); }
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (p === '/stream' || p === '/dl') return stream(req, res, u);

  if (p === '/api/room/sub') {
    const r = room(u.searchParams.get('c'));
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: state\ndata: ${JSON.stringify(snap(r))}\n\n`);
    r.clients.add(res);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (e) { } }, 20000);
    req.on('close', () => { clearInterval(ka); r.clients.delete(res); push(r, 'state', snap(r)); });
    return;
  }

  if (R[p]) {
    try {
      const d = await R[p](u.searchParams);
      const body = Buffer.from(JSON.stringify(d));
      const gz = /gzip/.test(req.headers['accept-encoding'] || '');
      const out = gz ? zlib.gzipSync(body) : body;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60',
        ...(gz ? { 'Content-Encoding': 'gzip' } : {}), 'Content-Length': out.length });
      return res.end(out);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
  }
  if (p.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"nf"}'); }

  let f = path.join(ROOT, p === '/' ? 'index.html' : decodeURIComponent(p).replace(/\.\./g, ''));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  const send = file => {
    const ck = 'S' + file;
    let c = statics.get(ck);
    if (!c) {
      let buf; try { buf = fs.readFileSync(file); } catch { return false; }
      c = { raw: buf, gz: zlib.gzipSync(buf), mime: MIME[path.extname(file)] || 'application/octet-stream',
        et: '"' + crypto.createHash('md5').update(buf).digest('hex').slice(0, 16) + '"' };
      statics.set(ck, c);
    }
    if (req.headers['if-none-match'] === c.et) { res.writeHead(304); res.end(); return true; }
    const gz = /gzip/.test(req.headers['accept-encoding'] || '');
    const body = gz ? c.gz : c.raw;
    res.writeHead(200, { 'Content-Type': c.mime, ETag: c.et, 'Cache-Control': 'public, max-age=0, must-revalidate',
      ...(gz ? { 'Content-Encoding': 'gzip' } : {}), 'Content-Length': body.length });
    res.end(body); return true;
  };
  if (!send(f)) if (!send(path.join(ROOT, 'index.html'))) { res.writeHead(404); res.end('404'); }
});

server.keepAliveTimeout = 65000; server.headersTimeout = 70000;
server.listen(PORT, '0.0.0.0', () => console.log('Sonora listening on ' + PORT));
