/* =========================================================================
   Sonora native shim.

   In the hosted build, server.js reshapes JioSaavn's raw JSON before the page
   sees it. Inside the APK there is no Node, so the same reshaping happens here
   and the DES media-URL decryption is handed to Java through window.Android.

   This file MUST load before app.js. It patches window.fetch so every /api/*
   request the app already makes keeps working unchanged.
   ========================================================================= */
(function () {
  'use strict';
  if (!window.Android || !window.Android.isNative) return;   // hosted build: do nothing

  var realFetch = window.fetch.bind(window);
  var QS = ['12', '48', '96', '160', '320'];

  function dec(s) {
    if (s == null) return '';
    var d = document.createElement('textarea');
    d.innerHTML = String(s);
    return d.value.trim();
  }
  var big = function (i) { return String(i || '').replace(/50x50|150x150/g, '500x500'); };

  function urlSet(base) {
    var o = {};
    if (base) QS.forEach(function (q) { o[q] = base.replace(/_(12|48|96|160|320)\.mp4/, '_' + q + '.mp4'); });
    return o;
  }

  function decryptUrl(enc) {
    if (!enc) return '';
    try { return window.Android.decrypt(enc) || ''; } catch (e) { return ''; }
  }

  function song(s) {
    if (!s || !s.id) return null;
    var mi = s.more_info || {};
    var base = decryptUrl(mi.encrypted_media_url);
    var art = '';
    try {
      if (mi.artistMap && mi.artistMap.primary_artists)
        art = mi.artistMap.primary_artists.map(function (a) { return a.name; }).join(', ');
      else if (mi.artistMap && mi.artistMap.artists)
        art = mi.artistMap.artists.slice(0, 3).map(function (a) { return a.name; }).join(', ');
    } catch (e) { }
    if (!art) art = String(s.subtitle || '').split(' - ')[0] || 'Unknown';
    return {
      id: s.id, t: dec(s.title || s.name), a: dec(art),
      al: dec(mi.album || s.album || ''), alId: mi.album_id || '',
      img: big(s.image), d: parseInt(mi.duration || s.duration || 0, 10) || 0,
      y: s.year || mi.year || '', lg: s.language || '',
      pl: parseInt(s.play_count || 0, 10) || 0, lb: dec(mi.label || ''),
      ly: mi.has_lyrics === 'true', u: urlSet(base), raw: base || ''
    };
  }

  function coll(c) {
    if (!c) return null;
    var mi = c.more_info || {};
    var sub = c.subtitle || mi.music ||
      (mi.artistMap && mi.artistMap.primary_artists && mi.artistMap.primary_artists[0] && mi.artistMap.primary_artists[0].name) ||
      (mi.song_count ? mi.song_count + ' songs' : '');
    return {
      id: c.id, k: c.type || 'album', t: dec(c.title || c.name), s: dec(sub),
      img: big(c.image), n: parseInt(mi.song_count || 0, 10) || 0, y: c.year || ''
    };
  }

  function artistC(a) {
    return { id: a.id, k: 'artist', t: dec(a.name || a.title), s: dec(a.description || a.role || 'Artist'), img: big(a.image) };
  }

  function uniq(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (x) { if (x && x.id && !seen[x.id]) { seen[x.id] = 1; out.push(x); } });
    return out;
  }
  var vals = function (x) { return Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.keys(x).map(function (k) { return x[k]; }) : []); };
  function mapSongs(list) { return uniq(vals(list).map(song).filter(Boolean)); }
  function mapColls(list) { return uniq(vals(list).map(coll).filter(Boolean)); }

  function json(o) {
    return new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  /* ---------------- endpoint reshaping ---------------- */

  var shape = {
    '/api/home': function (raw, url) {
      var d = (raw && raw.raw) || {};
      var lang = (raw && raw.lang) || 'hindi';
      var langOf = function (x) { return String((x && (x.language || (x.more_info && x.more_info.language))) || '').toLowerCase(); };
      var filt = function (a) {
        var all = vals(a), m = all.filter(function (x) { return langOf(x) === lang; });
        return m.length >= 4 ? m : all;
      };
      return {
        trending: uniq(filt(d.new_trending).map(function (x) { return x && x.type === 'song' ? song(x) : coll(x); }).filter(Boolean)).slice(0, 20),
        albums: mapColls(filt(d.new_albums)).slice(0, 20),
        playlists: mapColls(filt(d.top_playlists)).slice(0, 20),
        charts: mapColls(d.charts).slice(0, 20),
        radio: mapColls(d.radio).slice(0, 20)
      };
    },
    '/api/search': function (raw) { return { total: (raw && raw.total) || 0, songs: mapSongs(raw && raw.results) }; },
    '/api/mood': function (raw) { return { songs: mapSongs(raw && raw.results) }; },
    '/api/mix': function (raw) { return { songs: mapSongs(raw && raw.results) }; },
    '/api/searchall': function (raw) {
      raw = raw || {};
      return {
        songs: mapSongs(raw.songs && raw.songs.results),
        albums: mapColls(raw.albums && raw.albums.results),
        artists: uniq(vals(raw.artists && raw.artists.results).map(artistC).filter(Boolean)),
        playlists: mapColls(raw.playlists && raw.playlists.results).map(function (x) { x.k = 'playlist'; return x; })
      };
    },
    '/api/suggest': function (raw) {
      raw = raw || {};
      var grab = function (o, k, n) {
        return ((o && o.data) || []).slice(0, n).map(function (x) {
          return { k: k, id: x.id, t: dec(x.title), s: dec(x.description || x.subtitle || ''), img: big(x.image) };
        });
      };
      return { items: [].concat(grab(raw.songs, 'song', 5), grab(raw.artists, 'artist', 3),
        grab(raw.albums, 'album', 3), grab(raw.playlists, 'playlist', 2)) };
    },
    '/api/album': function (raw) { return { info: coll(raw), songs: mapSongs(raw && (raw.list || raw.songs)) }; },
    '/api/playlist': function (raw) { return { info: coll(raw), songs: mapSongs(raw && (raw.list || raw.songs)) }; },
    '/api/song': function (raw) {
      var arr = (raw && raw.songs) || vals(raw);
      return { song: song(arr && arr[0]) };
    },
    '/api/lyrics': function (raw) {
      var txt = dec(String((raw && raw.lyrics) || '').replace(/<br\s*\/?>/gi, '\n'));
      var lines = [], plain = [];
      txt.split('\n').forEach(function (l) {
        var m = l.match(/^\s*\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?\]\s*(.*)$/);
        if (m) { lines.push({ t: (+m[1]) * 60 + (+m[2]) + (m[3] ? +('0.' + m[3]) : 0), x: m[4].trim() }); plain.push(m[4].trim()); }
        else plain.push(l);
      });
      return { lyrics: plain.join('\n'), timed: lines.length > 3 ? lines : null };
    },
    '/api/similar': function (raw) { return { songs: mapSongs(Array.isArray(raw) ? raw : (raw && raw.data)) }; },
    '/api/top': function (raw) { return { items: mapColls(raw) }; },
    '/api/era': function (raw, url) {
      var e = parseInt((raw && raw.era) || '1990', 10);
      var all = [];
      ((raw && raw.parts) || []).forEach(function (p) { all = all.concat(mapSongs(p && p.results)); });
      all = uniq(all);
      var inEra = all.filter(function (s) { var y = +s.y; return y >= e && y <= e + 9; });
      var list = (inEra.length >= 12 ? inEra : all).sort(function (a, b) { return b.pl - a.pl; }).slice(0, 60);
      return { era: String(e), songs: list };
    },
    '/api/legends': function (raw) {
      var names = (raw && raw.names) || [], parts = (raw && raw.parts) || [], out = [];
      parts.forEach(function (p, i) {
        var r = p && p.results && p.results[0];
        if (r) { var a = artistC(r); a.t = names[i] || a.t; out.push(a); }
      });
      return { items: out };
    },
    '/api/goldmix': function (raw) {
      var labels = ['Modern remakes', 'Lo-fi classics', 'Timeless originals'];
      var out = {};
      ((raw && raw.parts) || []).forEach(function (p, i) {
        out[labels[i] || ('Mix ' + i)] = mapSongs(p && p.results).sort(function (a, b) { return b.pl - a.pl; }).slice(0, 20);
      });
      return out;
    }
  };

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
    if (path.indexOf('/api/room') === 0) return realFetch(input, init);   // proxied verbatim
    var fn = shape[path];
    if (!fn) return realFetch(input, init);
    return realFetch(input, init)
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (raw) {
        if (raw && raw.error) throw new Error(raw.error);
        try { return json(fn(raw, url)); }
        catch (e) { return json({ error: 'shape', detail: String(e && e.message) }); }
      });
  };

  /* ---------------- native niceties ---------------- */

  document.addEventListener('DOMContentLoaded', function () {
    var au = document.getElementById('au');
    if (!au) return;
    var push = function () {
      try {
        var t = (document.getElementById('pT') || {}).textContent || 'Sonora';
        var a = (document.getElementById('pA') || {}).textContent || '';
        window.Android.nowPlaying(t, a, !au.paused);
        window.Android.keepAwake(!au.paused);
      } catch (e) { }
    };
    au.addEventListener('play', push);
    au.addEventListener('pause', push);
    au.addEventListener('loadedmetadata', push);
    au.addEventListener('ended', function () { setTimeout(push, 600); });
  });

  // native share sheet
  if (!navigator.share) {
    navigator.share = function (o) {
      try { window.Android.share((o && (o.text || o.title)) || '', (o && o.url) || ''); return Promise.resolve(); }
      catch (e) { return Promise.reject(e); }
    };
  }
})();
