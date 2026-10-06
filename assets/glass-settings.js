/* Pengaturan tampilan kaca: transparansi panel dan kecerahan latar.
   Nilai disimpan per tema pada localStorage kunci arena-glass-v1.
   --glass-clear: 0 pekat … 1 bening; --bg-bright: 0 teduh/gelap … 1 terang.
   Dimuat tanpa defer di <head> agar nilai tersimpan dipakai sebelum halaman digambar. */
(function () {
  'use strict';

  var KEY = 'arena-glass-v1';
  var DEFAULTS = {
    night: { clear: 70, bright: 75 }, /* sama dengan :root malam di style.css */
    day: { clear: 55, bright: 80 }    /* sama dengan html[data-theme="day"] di day.css */
  };
  var root = document.documentElement;
  var frame = 0;
  var controls = null;

  function getTheme() {
    return root.getAttribute('data-theme') === 'day' ? 'day' : 'night';
  }

  function clamp(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
  }

  function cleanState(value, theme) {
    var fallback = DEFAULTS[theme];
    value = value && typeof value === 'object' ? value : {};
    return {
      clear: clamp(value.clear, fallback.clear),
      bright: clamp(value.bright, fallback.bright)
    };
  }

  function loadAll() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        /* Migrasi V6: bentuk lama {clear, bright} dianggap sebagai nilai mode malam. */
        if (saved && (saved.clear !== undefined || saved.bright !== undefined)) {
          return { night: cleanState(saved, 'night') };
        }
        return {
          night: saved && saved.night ? cleanState(saved.night, 'night') : null,
          day: saved && saved.day ? cleanState(saved.day, 'day') : null
        };
      }
    } catch (error) {
      /* Penyimpanan tidak tersedia: pakai bawaan. */
    }
    return { night: null, day: null };
  }

  var savedStates = loadAll();
  var mode = getTheme();
  var state = cleanState(savedStates[mode], mode);

  function save() {
    savedStates[mode] = { clear: state.clear, bright: state.bright };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(savedStates));
    } catch (error) {
      /* Penyimpanan dapat diblokir tanpa mengganggu kontrol. */
    }
  }

  function apply() {
    root.style.setProperty('--glass-clear', (state.clear / 100).toFixed(2));
    root.style.setProperty('--bg-bright', (state.bright / 100).toFixed(2));
  }
  apply();

  function updateCopy() {
    if (!controls) return;
    controls.brightHint.textContent = mode === 'day'
      ? '0% teduh bernuansa sore; 100% terik cerah.'
      : 'Makin tinggi, makin terang di balik panel.';
    controls.auto.textContent = mode === 'day'
      ? 'Saat lanskap lebih teduh, batas bawah alpha putih otomatis dinaikkan agar teks gelap tetap terbaca.'
      : 'Saat latar terang, panel otomatis dijaga cukup pekat agar teks tetap terbaca.';
  }

  function show() {
    if (!controls) return;
    controls.clear.value = state.clear;
    controls.bright.value = state.bright;
    controls.clearOut.textContent = state.clear + '%';
    controls.brightOut.textContent = state.bright + '%';
    controls.clear.setAttribute('aria-valuetext', state.clear + ' persen');
    controls.bright.setAttribute('aria-valuetext', state.bright + ' persen');
    updateCopy();
  }

  function switchMode(nextMode) {
    mode = nextMode === 'day' ? 'day' : 'night';
    state = cleanState(savedStates[mode], mode);
    apply();
    show();
  }

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
        '<p class="glass-hint glass-bright-hint"></p>' +
        '<p class="glass-note" id="glass-note" hidden></p>' +
        '<p class="glass-auto"></p>' +
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

    controls = {
      clear: clear,
      bright: bright,
      clearOut: clearOut,
      brightOut: brightOut,
      brightHint: box.querySelector('.glass-bright-hint'),
      auto: box.querySelector('.glass-auto')
    };

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
      state.clear = clamp(clear.value, DEFAULTS[mode].clear);
      state.bright = clamp(bright.value, DEFAULTS[mode].bright);
      show();
      sync();
      save();
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
      state = { clear: DEFAULTS[mode].clear, bright: DEFAULTS[mode].bright };
      show();
      apply();
      save();
    });
    clear.addEventListener('input', onInput);
    bright.addEventListener('input', onInput);
    box.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        event.stopPropagation();
        close(true);
      }
    });
    document.addEventListener('pointerdown', function (event) {
      if (!panel.hidden && !box.contains(event.target)) close(false);
    });

    show();
    updateNote();
  }

  window.addEventListener('arena:themechange', function (event) {
    switchMode(event.detail && event.detail.theme);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
