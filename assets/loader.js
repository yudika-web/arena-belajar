/* Prapemuat aset Arena Belajar.
   Hanya tema aktif yang disiapkan pada kunjungan awal. Tema lain baru diunduh
   saat pengunjung meminta pergantian tema, lalu halaman dibuka setelah siap. */
(function () {
  'use strict';

  const CACHE_VERSION = 'tema-20261006-12';
  const INITIAL_MIN_MS = 650;
  const REQUEST_MAX_MS = 15000;
  const IMAGE_MAX_MS = 15000;
  const APP_READY_MAX_MS = 12000;
  const FONT_READY_MAX_MS = 8000;

  const COMMON_FILES = [
    './assets/loading/arena-loading.webp?v=' + CACHE_VERSION,
    './assets/audio/final-chord.mp3',
    './assets/audio/final-boss.mp3',
    './assets/audio/final-stand.mp3'
  ];

  const THEME_FILES = {
    night: [
      './assets/space.js?v=' + CACHE_VERSION,
      './assets/space-art/bg-nebula.webp',
      './assets/space-art/bg-nebula-mobile.webp',
      './assets/space-art/lunar-playground.webp',
      './assets/space-art/meteor.webp',
      './assets/space-art/moon.webp',
      './assets/space-art/planet-mustard.webp',
      './assets/space-art/planet-pink.webp',
      './assets/space-art/planet-purple.webp',
      './assets/space-art/planet-teal.webp',
      './assets/space-art/satellite.webp',
      './assets/space-art/star-spark.webp',
      './assets/mascots/astronot-cilik.webp',
      './assets/mascots/kucing-astronot.webp'
    ],
    day: [
      './assets/day.js?v=' + CACHE_VERSION,
      './assets/day-art/bg-kerajaan.webp',
      './assets/day-art/bg-kerajaan-mobile.webp',
      './assets/day-art/hero-kerajaan.webp',
      './assets/day-art/kastil.webp',
      './assets/day-art/naga-kecil.webp',
      './assets/day-art/monster-slime.webp',
      './assets/day-art/monster-bulu.webp',
      './assets/day-art/monster-jamur.webp',
      './assets/day-art/awan-1.webp',
      './assets/day-art/awan-2.webp',
      './assets/day-art/awan-3.webp',
      './assets/mascots/ksatria-cilik.webp',
      './assets/mascots/kucing-penyihir.webp'
    ]
  };

  const root = document.documentElement;
  const preparedThemes = new Set();
  const loadedFiles = new Set();
  let initialPromise = null;
  let activeRun = 0;

  function validTheme(value) {
    return value === 'day' ? 'day' : 'night';
  }

  function absoluteURL(source) {
    try { return new URL(source, document.baseURI).href; }
    catch (error) { return source; }
  }

  function isImage(source) {
    return /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(source);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function withTimeout(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        window.setTimeout(function () { resolve(fallback); }, ms);
      })
    ]);
  }

  function getUI() {
    return {
      loader: document.getElementById('site-loader'),
      status: document.getElementById('loader-status'),
      percent: document.getElementById('loader-percent'),
      progress: document.getElementById('loader-progress'),
      bar: document.getElementById('loader-progress-bar'),
      copy: document.getElementById('loader-copy')
    };
  }

  function setPercent(value, label) {
    const ui = getUI();
    const percent = Math.max(0, Math.min(100, Math.round(value)));
    if (ui.status && label) ui.status.textContent = label;
    if (ui.percent) ui.percent.textContent = percent + '%';
    if (ui.progress) ui.progress.setAttribute('aria-valuenow', String(percent));
    if (ui.bar) ui.bar.style.width = percent + '%';
  }

  function showThemeLoader(theme) {
    const ui = getUI();
    root.classList.add('arena-theme-loading');
    if (ui.loader) ui.loader.hidden = false;
    if (ui.copy) ui.copy.textContent = theme === 'day'
      ? 'Menyiapkan kerajaan dan karakter sebelum mode siang dibuka.'
      : 'Menyiapkan angkasa dan maskot sebelum mode malam dibuka.';
    setPercent(0, theme === 'day' ? 'Menyiapkan mode siang…' : 'Menyiapkan mode malam…');
  }

  function hideThemeLoader() {
    root.classList.remove('arena-theme-loading');
  }

  function fetchAndConsume(source) {
    const url = absoluteURL(source);
    if (loadedFiles.has(url)) return Promise.resolve({ ok: true, cached: true });

    const controller = 'AbortController' in window ? new AbortController() : null;
    const timer = controller ? window.setTimeout(function () { controller.abort(); }, REQUEST_MAX_MS) : 0;
    const options = { cache: 'force-cache', credentials: 'same-origin' };
    if (controller) options.signal = controller.signal;

    return fetch(url, options).then(function (response) {
      if (!response.ok && response.type !== 'opaque') throw new Error('HTTP ' + response.status);
      if (!response.body || !response.body.getReader) return response.blob();
      const reader = response.body.getReader();
      function read() {
        return reader.read().then(function (part) {
          if (part.done) return;
          return read();
        });
      }
      return read();
    }).then(function () {
      loadedFiles.add(url);
      return { ok: true };
    }).catch(function () {
      return { ok: false, source: source };
    }).finally(function () {
      if (timer) window.clearTimeout(timer);
    });
  }

  function decodeImage(source) {
    const url = absoluteURL(source);
    if (loadedFiles.has(url)) return Promise.resolve({ ok: true, cached: true });
    return new Promise(function (resolve) {
      const image = new Image();
      let settled = false;
      const timer = window.setTimeout(function () { finish(false); }, IMAGE_MAX_MS);

      function finish(ok) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (ok) loadedFiles.add(url);
        resolve({ ok: ok, source: ok ? undefined : source });
      }

      image.decoding = 'async';
      image.onload = function () {
        if (typeof image.decode === 'function') {
          image.decode().catch(function () {}).then(function () { finish(true); });
        } else finish(true);
      };
      image.onerror = function () { finish(false); };
      image.src = url;
      if (image.complete && image.naturalWidth > 0) image.onload();
    });
  }

  function loadFile(source) {
    return isImage(source) ? decodeImage(source) : fetchAndConsume(source);
  }

  function loadFiles(files, labelPrefix, startPercent, endPercent) {
    const unique = Array.from(new Set(files));
    const failures = [];
    let done = 0;
    const start = Number(startPercent) || 0;
    const end = Number(endPercent) || 100;
    const span = end - start;

    if (!unique.length) {
      setPercent(end, labelPrefix);
      return Promise.resolve(failures);
    }

    setPercent(start, labelPrefix);
    return Promise.all(unique.map(function (source) {
      return loadFile(source).then(function (result) {
        done += 1;
        if (!result.ok) failures.push(source);
        setPercent(start + (done / unique.length) * span, labelPrefix + ' ' + done + '/' + unique.length);
        return result;
      });
    })).then(function () { return failures; });
  }

  function readCollectionImages() {
    return fetchAndConsume('./data/koleksi.json').then(function (result) {
      if (!result.ok) return [];
      return fetch(absoluteURL('./data/koleksi.json'), { cache: 'force-cache', credentials: 'same-origin' })
        .then(function (response) { return response.ok ? response.json() : []; })
        .then(function (data) {
          if (!Array.isArray(data)) return [];
          return data.map(function (item) { return item && item.image; })
            .filter(function (value) { return typeof value === 'string' && value.trim(); });
        })
        .catch(function () { return []; });
    });
  }

  function waitForFonts() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return withTimeout(document.fonts.ready.catch(function () {}), FONT_READY_MAX_MS);
  }

  function waitForApp() {
    const loading = document.getElementById('loading-state');
    if (!loading || loading.hidden) return Promise.resolve();

    return withTimeout(new Promise(function (resolve) {
      const observer = new MutationObserver(function () {
        if (loading.hidden) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(loading, { attributes: true, attributeFilter: ['hidden'] });
    }), APP_READY_MAX_MS);
  }

  function revealInitial(failures) {
    const ui = getUI();
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPercent(100, failures.length ? 'Beberapa aset tambahan tidak tersedia. Membuka Arena…' : 'Semua siap. Membuka Arena…');
    root.classList.remove('arena-loading');
    root.classList.add('arena-revealing');
    root.setAttribute('data-loader-ready', failures.length ? 'partial' : 'complete');
    if (ui.loader) ui.loader.setAttribute('aria-hidden', 'true');

    window.setTimeout(function () {
      root.classList.remove('arena-revealing');
      root.classList.add('arena-ready');
      if (ui.loader) ui.loader.hidden = true;
      window.dispatchEvent(new CustomEvent('arena:assetsready', {
        detail: { theme: validTheme(root.getAttribute('data-theme')), failures: failures.slice() }
      }));
    }, reduced ? 0 : 420);
  }

  function initialLoad() {
    if (initialPromise) return initialPromise;
    const started = performance.now();
    const theme = validTheme(root.getAttribute('data-theme'));
    const token = ++activeRun;
    const readiness = Promise.all([waitForFonts(), waitForApp()]);

    initialPromise = loadFiles(COMMON_FILES.concat(THEME_FILES[theme]), 'Memuat aset utama…', 0, 82)
      .then(function (failures) {
        return readCollectionImages().then(function (images) {
          return loadFiles(images, images.length ? 'Memuat gambar koleksi…' : 'Menyiapkan koleksi…', 82, 94)
            .then(function (imageFailures) { return failures.concat(imageFailures); });
        });
      })
      .then(function (failures) {
        setPercent(96, 'Menunggu konten dan font siap…');
        return readiness.then(function () { return failures; });
      })
      .catch(function () { return ['loader']; })
      .then(function (failures) {
        if (token !== activeRun) return { theme: theme, failures: failures || [] };
        preparedThemes.add(theme);
        const elapsed = performance.now() - started;
        return sleep(Math.max(0, INITIAL_MIN_MS - elapsed)).then(function () {
          revealInitial(failures || []);
          return { theme: theme, failures: failures || [] };
        });
      });

    return initialPromise;
  }

  function prepareTheme(theme, options) {
    const next = validTheme(theme);
    const settings = options || {};
    if (preparedThemes.has(next)) return Promise.resolve({ theme: next, failures: [] });

    const token = ++activeRun;
    if (settings.show !== false) showThemeLoader(next);

    return loadFiles(THEME_FILES[next], next === 'day' ? 'Memuat petualangan siang…' : 'Memuat petualangan malam…', 0, 100)
      .catch(function () { return ['loader']; })
      .then(function (failures) {
        if (token !== activeRun) return { theme: next, failures: failures || [] };
        preparedThemes.add(next);
        setPercent(100, failures.length ? 'Tema siap dengan beberapa fallback.' : 'Tema siap.');
        return sleep(120).then(function () {
          if (settings.show !== false) hideThemeLoader();
          return { theme: next, failures: failures || [] };
        });
      });
  }

  window.ArenaAssetLoader = {
    start: initialLoad,
    prepareTheme: prepareTheme,
    isThemeReady: function (theme) { return preparedThemes.has(validTheme(theme)); }
  };

  /* Defer script dieksekusi setelah DOM selesai diparsing, jadi loader dapat mulai langsung. */
  initialLoad();
})();
