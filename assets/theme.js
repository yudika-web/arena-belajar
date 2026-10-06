/* Pengelola tema Arena Belajar.
   Berkas ini dimuat sinkron di <head> agar tema tersimpan diterapkan sebelum render pertama. */
(function () {
  'use strict';

  const DEFAULT_THEME = 'night';
  const STORAGE_KEY = 'arena-theme-v1';
  const CACHE_VERSION = 'tema-20261006-12';
  const THEMES = {
    night: { color: '#0B1730', scheme: 'dark', runtime: './assets/space.js' },
    day: { color: '#7BCBF2', scheme: 'light', runtime: './assets/day.js' }
  };
  const root = document.documentElement;
  /* Kelas dipasang sebelum render pertama; loader.js akan melepasnya setelah aset siap. */
  root.classList.add('arena-loading');
  /* Pengaman: bila loader gagal karena berkas tidak terunggah/skrip rusak, jangan pernah mengunci halaman. */
  window.setTimeout(function () {
    if (!root.classList.contains('arena-loading')) return;
    root.classList.remove('arena-loading');
    root.classList.add('arena-ready');
    root.setAttribute('data-loader-ready', 'fallback');
  }, 40000);
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let toastTimer = 0;
  let initialRuntimeWritten = false;
  let themeChangePending = false;

  function validTheme(value) {
    return value === 'day' || value === 'night' ? value : DEFAULT_THEME;
  }

  function readTheme() {
    try {
      return validTheme(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return DEFAULT_THEME;
    }
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* Penyimpanan dapat diblokir; tema tetap berlaku selama halaman terbuka. */
    }
  }

  function updateHead(theme) {
    const config = THEMES[theme];
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = config.scheme;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const schemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (themeMeta) themeMeta.setAttribute('content', config.color);
    if (schemeMeta) schemeMeta.setAttribute('content', config.scheme);
  }

  function installTransitionStyle() {
    if (document.getElementById('arena-theme-transition-style')) return;
    const style = document.createElement('style');
    style.id = 'arena-theme-transition-style';
    style.textContent =
      '::view-transition-old(root),::view-transition-new(root){animation-duration:400ms;animation-timing-function:ease;mix-blend-mode:normal;}' +
      '::view-transition-old(root){animation-name:arena-theme-old;}' +
      '::view-transition-new(root){animation-name:arena-theme-new;}' +
      '@keyframes arena-theme-old{from{opacity:1}to{opacity:0}}' +
      '@keyframes arena-theme-new{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(style);
  }

  function writeInitialRuntime(theme) {
    if (initialRuntimeWritten) return;
    initialRuntimeWritten = true;
    const source = THEMES[theme].runtime + '?v=' + CACHE_VERSION;
    document.write('<script defer data-arena-theme-runtime="' + theme + '" src="' + source + '"><\/script>');
  }

  function ensureRuntime(theme) {
    if (document.querySelector('script[data-arena-theme-runtime="' + theme + '"]')) return;
    const script = document.createElement('script');
    script.src = THEMES[theme].runtime + '?v=' + CACHE_VERSION;
    script.defer = true;
    script.async = false;
    script.setAttribute('data-arena-theme-runtime', theme);
    document.head.appendChild(script);
  }

  function setImageSource(image, theme) {
    const source = theme === 'day' ? image.dataset.themeSrcDay : image.dataset.themeSrcNight;
    if (!source) {
      image.removeAttribute('src');
      image.hidden = true;
      return;
    }

    const absoluteCurrent = image.currentSrc || image.getAttribute('src') || '';
    const requested = new URL(source, document.baseURI).href;
    image.hidden = false;
    if (absoluteCurrent === requested || image.getAttribute('src') === source) return;

    image.onerror = function () {
      image.hidden = true;
      image.removeAttribute('src');
    };
    image.onload = function () {
      image.hidden = false;
    };
    image.setAttribute('src', source);
  }

  function syncImages(theme, scope) {
    const base = scope || document;
    base.querySelectorAll('img[data-theme-src-night],img[data-theme-src-day]').forEach(function (image) {
      setImageSource(image, theme);
    });
  }

  function syncText(theme, scope) {
    const base = scope || document;
    base.querySelectorAll('[data-theme-text-night][data-theme-text-day]').forEach(function (node) {
      node.textContent = theme === 'day' ? node.dataset.themeTextDay : node.dataset.themeTextNight;
    });
    base.querySelectorAll('[data-alt-night][data-alt-day]').forEach(function (image) {
      image.setAttribute('alt', theme === 'day' ? image.dataset.altDay : image.dataset.altNight);
    });
  }

  function syncBackdrop(theme) {
    const space = document.querySelector('.space-bg');
    const day = document.querySelector('.day-bg');
    if (space) {
      space.hidden = theme !== 'night';
      space.classList.toggle('space-paused', theme !== 'night');
    }
    if (day) day.hidden = theme !== 'day';
    root.classList.toggle('space-page-paused', theme !== 'night');
  }

  function syncBrand(theme) {
    const brandIcon = document.getElementById('brand-icon-use');
    if (brandIcon) brandIcon.setAttribute('href', theme === 'day' ? '#icon-shield' : '#icon-record');
  }

  function syncToggle(theme) {
    const button = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon-use');
    if (!button || !icon) return;
    const isDay = theme === 'day';
    const label = isDay ? 'Ganti ke mode malam' : 'Ganti ke mode siang';
    button.setAttribute('aria-pressed', isDay ? 'true' : 'false');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    icon.setAttribute('href', isDay ? '#icon-moon' : '#icon-sun');
  }

  function announce(theme) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = theme === 'day' ? 'Mode siang aktif: petualangan negeri dongeng.' : 'Mode malam aktif: petualangan luar angkasa.';
    toast.hidden = false;
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 2300);
  }

  function syncDocument(theme) {
    syncBackdrop(theme);
    syncImages(theme);
    syncText(theme);
    syncBrand(theme);
    syncToggle(theme);
  }

  function dispatchThemeChange(theme, previous) {
    window.dispatchEvent(new CustomEvent('arena:themechange', {
      detail: { theme: theme, previousTheme: previous }
    }));
  }

  function commitTheme(theme, announceChange) {
    const previous = validTheme(root.getAttribute('data-theme'));
    updateHead(theme);
    saveTheme(theme);
    syncDocument(theme);
    ensureRuntime(theme);
    dispatchThemeChange(theme, previous);
    if (announceChange) announce(theme);
  }

  function fallbackFade(theme) {
    if (!document.body || !document.body.animate) {
      commitTheme(theme, true);
      return Promise.resolve();
    }
    const out = document.body.animate([{ opacity: 1 }, { opacity: 0.08 }], {
      duration: 180,
      easing: 'ease',
      fill: 'forwards'
    });
    return out.finished.catch(function () {}).then(function () {
      commitTheme(theme, true);
      const fadeIn = document.body.animate([{ opacity: 0.08 }, { opacity: 1 }], {
        duration: 220,
        easing: 'ease',
        fill: 'both'
      });
      return fadeIn.finished.catch(function () {});
    });
  }

  function performThemeChange(theme) {
    const motionReduced = !!(reduceMotion && reduceMotion.matches);
    if (motionReduced) {
      commitTheme(theme, true);
      return Promise.resolve();
    }

    if (document.startViewTransition) {
      const transition = document.startViewTransition(function () {
        commitTheme(theme, true);
      });
      return transition.finished.catch(function () {});
    }
    return fallbackFade(theme);
  }

  function changeTheme(theme) {
    const next = validTheme(theme);
    if (next === root.getAttribute('data-theme') || themeChangePending) return;

    const button = document.getElementById('theme-toggle');
    const loader = window.ArenaAssetLoader;
    const preparation = loader && typeof loader.prepareTheme === 'function'
      ? loader.prepareTheme(next, { show: true })
      : Promise.resolve();

    themeChangePending = true;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }

    Promise.resolve(preparation)
      .catch(function () { /* Fallback tema tetap dapat dipakai bila pramuat gagal. */ })
      .then(function () { return performThemeChange(next); })
      .finally(function () {
        themeChangePending = false;
        if (button) {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
      });
  }

  function bindToggle() {
    const button = document.getElementById('theme-toggle');
    if (!button || button.dataset.themeBound === 'true') return;
    button.dataset.themeBound = 'true';
    button.addEventListener('click', function () {
      changeTheme(root.getAttribute('data-theme') === 'day' ? 'night' : 'day');
    });
  }

  function hydrate() {
    const theme = validTheme(root.getAttribute('data-theme'));
    syncDocument(theme);
    bindToggle();
  }

  const initialTheme = readTheme();
  updateHead(initialTheme);
  installTransitionStyle();

  /* Dipanggil oleh slot di index.html pada posisi lama space.js, setelah app.js/music.js,
     sehingga urutan eksekusi mode malam tetap sedekat mungkin dengan V6.1. */
  window.ArenaThemeRuntime = function () {
    writeInitialRuntime(validTheme(root.getAttribute('data-theme')));
  };

  const observer = new MutationObserver(function (records) {
    const theme = validTheme(root.getAttribute('data-theme'));
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (!(node instanceof Element)) return;
        if (node.matches('.space-bg,.day-bg') || node.querySelector('.space-bg,.day-bg')) syncBackdrop(theme);
        if (node.matches('img[data-theme-src-night],img[data-theme-src-day]')) setImageSource(node, theme);
        syncImages(theme, node);
        syncText(theme, node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  } else {
    hydrate();
  }
})();
