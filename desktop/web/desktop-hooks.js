/* =====================================================================
   Sonora desktop hooks.

   Loaded by every build; does nothing unless window.Desktop exists
   (that is only injected by the Electron preload).

   Wires the native menu, media keys, taskbar progress and mini player
   into the exact same app the browser and phone run.
   ===================================================================== */
(function () {
  'use strict';
  if (!window.Desktop || !window.Desktop.isDesktop) return;

  document.documentElement.dataset.desktop = '1';

  var ready = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  ready(function () {
    var au = document.getElementById('au');
    var $ = function (s) { return document.querySelector(s); };
    var click = function (s) { var e = $(s); if (e) e.click(); };

    /* ---- native menu + media keys ---- */
    window.Desktop.on('media', function (a) {
      switch (a) {
        case 'toggle': click('#play'); break;
        case 'next': click('#next'); break;
        case 'prev': click('#prev'); break;
        case 'pause': if (au && !au.paused) au.pause(); break;
        case 'quick': click('#qMode'); break;
        case 'fullscreen': click('#fsB'); break;
        case 'volup': case 'voldown': {
          var v = document.getElementById('vol');
          if (!v) break;
          v.value = Math.max(0, Math.min(100, (+v.value) + (a === 'volup' ? 5 : -5)));
          v.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
    });
    window.Desktop.on('focus-search', function () { var q = $('#q'); if (q) { q.focus(); q.select(); } });
    window.Desktop.on('palette', function () {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    window.Desktop.on('shortcuts', function () {
      var n = document.querySelector('.nav[data-v="prefs"]'); if (n) n.click();
    });
    window.Desktop.on('download-done', function (d) {
      if (!d) return;
      var t = document.getElementById('toastT'), box = document.getElementById('toast');
      if (t && box) { t.textContent = d.ok ? 'Saved to Downloads — ' + d.name : 'Download failed'; box.classList.add('show');
        setTimeout(function () { box.classList.remove('show'); }, 2600); }
    });
    window.Desktop.on('mini', function (on) { document.documentElement.dataset.mini = on ? '1' : '0'; });
    window.Desktop.on('updated', function (msg) {
      var t = document.getElementById('toastT'), box = document.getElementById('toast');
      if (t && box) { t.textContent = (msg || 'Updated') + ' — reloading'; box.classList.add('show'); }
    });
    window.Desktop.on('checking', function () {
      var t = document.getElementById('toastT'), box = document.getElementById('toast');
      if (t && box) { t.textContent = 'Checking for updates'; box.classList.add('show');
        setTimeout(function () { box.classList.remove('show'); }, 2200); }
    });

    /* ---- taskbar progress + window title ---- */
    if (au) {
      var last = 0;
      au.addEventListener('timeupdate', function () {
        var now = Date.now();
        if (now - last < 900) return;
        last = now;
        if (au.duration && isFinite(au.duration)) window.Desktop.setProgress(au.currentTime / au.duration);
      });
      var title = function () {
        var t = (document.getElementById('pT') || {}).textContent || '';
        var a = (document.getElementById('pA') || {}).textContent || '';
        window.Desktop.setTitle(t && t !== 'Nothing playing' ? t + ' · ' + a : '');
      };
      au.addEventListener('play', title);
      au.addEventListener('pause', function () { title(); window.Desktop.setProgress(-1); });
      au.addEventListener('loadedmetadata', title);
      au.addEventListener('ended', function () { window.Desktop.setProgress(-1); });
    }

    /* ---- extra rows in Settings ---- */
    var addRows = function () {
      var view = document.getElementById('view');
      if (!view) return;
      if (view.querySelector('[data-desktop-rows]')) return;
      var heads = view.querySelectorAll('.shead h2');
      var target = null;
      heads.forEach(function (h) { if (/^About$/i.test(h.textContent.trim())) target = h.closest('.shead'); });
      if (!target) return;

      var grid = document.createElement('div');
      grid.className = 'setgrid';
      grid.setAttribute('data-desktop-rows', '1');

      var mkRow = function (title, desc, label, fn) {
        var r = document.createElement('div');
        r.className = 'setrow';
        r.innerHTML = '<div class="si2"><b></b><span></span></div>';
        r.querySelector('b').textContent = title;
        r.querySelector('span').textContent = desc;
        var b = document.createElement('button');
        b.className = 'sbtn'; b.textContent = label; b.onclick = fn;
        r.appendChild(b);
        grid.appendChild(r);
        return r;
      };

      var head = document.createElement('div');
      head.className = 'shead';
      head.innerHTML = '<div class="txt"><h2>Desktop</h2><div class="sub2">Window and system integration</div></div>';

      mkRow('Downloads folder', 'Where saved tracks land', 'Open', function () { window.Desktop.openDownloads(); });
      mkRow('Mini player', 'Small always-on-top window', 'Toggle', function () { window.Desktop.toggleMini(); });
      var vRow = mkRow('Version', 'Loading…', 'Copy', function () {
        window.Desktop.info().then(function (i) {
          navigator.clipboard && navigator.clipboard.writeText('Sonora ' + i.version + ' (' + i.platform + ')');
        });
      });
      window.Desktop.info().then(function (i) {
        vRow.querySelector('span').textContent = 'Sonora ' + i.version + ' on ' + i.platform;
      }).catch(function () { });

      target.parentNode.insertBefore(head, target);
      target.parentNode.insertBefore(grid, target);
    };

    // Settings is rendered on demand, so watch for it
    var mo = new MutationObserver(function () { try { addRows(); } catch (e) { } });
    var v = document.getElementById('view');
    if (v) mo.observe(v, { childList: true });
    setTimeout(addRows, 800);
  });
})();
