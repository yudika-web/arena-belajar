/* Pengaturan tampilan kaca: transparansi panel dan kecerahan latar.
   Nilai tersimpan di perangkat (localStorage) dan hanya mengubah dua variabel CSS:
   --glass-clear (0 pekat … 1 bening) dan --bg-bright (0 gelap … 1 terang).
   Dimuat tanpa defer di <head> agar nilai tersimpan dipakai sebelum halaman digambar. */
(function () {
  'use strict';

  var KEY = 'arena-glass-v1';
  var DEFAULTS = { clear: 70, bright: 75 }; /* samakan dengan :root di style.css */
  var root = document.documentElement;

  function clamp(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        return { clear: clamp(saved.clear, DEFAULTS.clear), bright: clamp(saved.bright, DEFAULTS.bright) };
      }
    } catch (error) { /* penyimpanan tidak tersedia: pakai bawaan */ }
    return { clear: DEFAULTS.clear, bright: DEFAULTS.bright };
  }

  function save(state) {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* diabaikan */ }
  }

  function forget() {
    try { window.localStorage.removeItem(KEY); } catch (error) { /* diabaikan */ }
  }

  var state = load();
  var frame = 0;

  function apply() {
    root.style.setProperty('--glass-clear', (state.clear / 100).toFixed(2));
    root.style.setProperty('--bg-bright', (state.bright / 100).toFixed(2));
  }
  apply();

  function build() {
    if (document.querySelector('.glass-settings')) return;

    var box = document.createElement('div');
    box.className = 'glass-settings';
    box.innerHTML =
      '<button type="button" class="glass-toggle" aria-expanded="false" aria-controls="glass-panel" aria-label="Pengaturan tampilan kaca">' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>' +
      '</button>' +
      '<div class="glass-panel" id="glass-panel" role="group" aria-label="Pengaturan tampilan kaca" hidden>' +
        '<p class="glass-title">Tampilan kaca</p>' +
        '<div class="glass-row"><label for="glass-clear">Transparansi panel</label><output for="glass-clear" id="glass-clear-out"></output></div>' +
        '<input id="glass-clear" type="range" min="0" max="100" step="5">' +
        '<p class="glass-hint">Makin tinggi, makin bening.</p>' +
        '<div class="glass-row"><label for="glass-bright">Kecerahan latar</label><output for="glass-bright" id="glass-bright-out"></output></div>' +
        '<input id="glass-bright" type="range" min="0" max="100" step="5">' +
        '<p class="glass-hint">Makin tinggi, makin terang di balik panel.</p>' +
        '<p class="glass-note" id="glass-note" hidden></p>' +
        '<p class="glass-auto">Saat latar terang, panel otomatis dijaga cukup pekat agar teks tetap terbaca.</p>' +
        '<div class="glass-actions"><button type="button" class="glass-reset">Atur ulang</button><button type="button" class="glass-close">Tutup</button></div>' +
      '</div>';
    document.body.appendChild(box);

    var toggle = box.querySelector('.glass-toggle');
    var panel = box.querySelector('.glass-panel');
    var clear = box.querySelector('#glass-clear');
    var bright = box.querySelector('#glass-bright');
    var clearOut = box.querySelector('#glass-clear-out');
    var brightOut = box.querySelector('#glass-bright-out');
    var note = box.querySelector('#glass-note');

    function show() {
      clear.value = state.clear;
      bright.value = state.bright;
      clearOut.textContent = state.clear + '%';
      brightOut.textContent = state.bright + '%';
      clear.setAttribute('aria-valuetext', state.clear + ' persen');
      bright.setAttribute('aria-valuetext', state.bright + ' persen');
    }

    function sync() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(function () { apply(); });
    }

    function open() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }

    function close(returnFocus) {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
    }

    function onInput() {
      state.clear = clamp(clear.value, DEFAULTS.clear);
      state.bright = clamp(bright.value, DEFAULTS.bright);
      show();
      sync();
      save(state);
    }

    /* Kontras tinggi memakai permukaan solid, jadi transparansi panel tidak berlaku. */
    var highContrast = window.matchMedia ? window.matchMedia('(prefers-contrast: more)') : null;
    function updateNote() {
      var on = !!(highContrast && highContrast.matches);
      clear.disabled = on;
      note.hidden = !on;
      note.textContent = on ? 'Mode kontras tinggi aktif di perangkatmu: panel dibuat solid, jadi transparansi panel tidak berlaku.' : '';
    }
    if (highContrast) {
      if (highContrast.addEventListener) highContrast.addEventListener('change', updateNote);
      else if (highContrast.addListener) highContrast.addListener(updateNote);
    }

    toggle.addEventListener('click', function () { if (panel.hidden) open(); else close(false); });
    box.querySelector('.glass-close').addEventListener('click', function () { close(true); });
    box.querySelector('.glass-reset').addEventListener('click', function () {
      state = { clear: DEFAULTS.clear, bright: DEFAULTS.bright };
      show(); apply(); forget();
    });
    clear.addEventListener('input', onInput);
    bright.addEventListener('input', onInput);
    box.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) { event.stopPropagation(); close(true); }
    });
    document.addEventListener('pointerdown', function (event) {
      if (!panel.hidden && !box.contains(event.target)) close(false);
    });

    show();
    updateNote();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
