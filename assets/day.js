/* Gerak latar mode siang: paralaks lembut dan naga terbang sesekali.
   Skrip hanya aktif saat data-theme="day", berhenti saat tab tersembunyi,
   dan tidak menjalankan loop animasi bila pengguna meminta gerak dikurangi. */
(function () {
  'use strict';

  const POINTER_RANGE = 12;
  const SCROLL_RANGE = 1;
  const DRAGON_GAP_MIN = 12000;
  const DRAGON_GAP_MAX = 25000;
  const DRAGON_FLIGHT_MIN = 5600;
  const DRAGON_FLIGHT_MAX = 7200;
  const FINE_POINTER = '(hover:hover) and (pointer:fine)';
  const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

  const root = document.documentElement;
  const background = document.querySelector('.day-bg');
  if (!background) return;

  const layers = Array.from(background.querySelectorAll('[data-day-depth]'));
  const dragon = background.querySelector('.day-dragon');
  const finePointer = window.matchMedia ? window.matchMedia(FINE_POINTER) : null;
  const reducedMotion = window.matchMedia ? window.matchMedia(REDUCED_MOTION) : null;

  let active = false;
  let raf = 0;
  let flightRaf = 0;
  let flightTimer = 0;
  let flightActive = false;
  let scrollY = window.scrollY || 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function themeIsDay() {
    return root.getAttribute('data-theme') === 'day';
  }

  function motionIsReduced() {
    return !!(reducedMotion && reducedMotion.matches);
  }

  function shouldRun() {
    return themeIsDay() && !document.hidden && !motionIsReduced();
  }

  function resetLayers() {
    layers.forEach(function (layer) {
      layer.style.transform = '';
    });
    flightActive = false;
    if (dragon) {
      dragon.style.opacity = '';
      dragon.style.transform = '';
    }
  }

  function updateParallax() {
    raf = 0;
    if (!active || !shouldRun()) return;

    pointerX += (targetPointerX - pointerX) * 0.08;
    pointerY += (targetPointerY - pointerY) * 0.08;

    layers.forEach(function (layer) {
      if (flightActive && layer === dragon) return;
      const depth = Number(layer.dataset.dayDepth) || 0;
      const scrollOffset = scrollY * depth * SCROLL_RANGE;
      const pointerScale = depth * POINTER_RANGE;
      const x = pointerX * pointerScale;
      const y = pointerY * pointerScale + scrollOffset;
      layer.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
    });

    raf = window.requestAnimationFrame(updateParallax);
  }

  function startParallax() {
    if (raf || !active || !shouldRun()) return;
    raf = window.requestAnimationFrame(updateParallax);
  }

  function stopParallax() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function scheduleFlight() {
    window.clearTimeout(flightTimer);
    flightTimer = 0;
    if (!active || !shouldRun() || !dragon) return;
    const delay = randomBetween(DRAGON_GAP_MIN, DRAGON_GAP_MAX);
    flightTimer = window.setTimeout(startFlight, delay);
  }

  function startFlight() {
    flightTimer = 0;
    if (!active || !shouldRun() || !dragon || flightRaf) return;

    flightActive = true;
    const start = performance.now();
    const duration = randomBetween(DRAGON_FLIGHT_MIN, DRAGON_FLIGHT_MAX);
    const top = randomBetween(12, 34);
    const baseTop = window.matchMedia && window.matchMedia('(max-width:600px)').matches ? 31 : 28;
    const rise = randomBetween(-5, 8);

    function frame(now) {
      if (!active || !shouldRun()) {
        flightRaf = 0;
        dragon.style.opacity = '';
        dragon.style.transform = '';
        flightActive = false;
        scheduleFlight();
        return;
      }

      const progress = Math.min(1, (now - start) / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const x = -18 + eased * 136;
      const y = top - baseTop + rise * eased + Math.sin(progress * Math.PI * 2) * 1.6;
      const visible = Math.min(1, progress * 8, (1 - progress) * 8);

      dragon.style.opacity = Math.max(0, visible).toFixed(3);
      dragon.style.transform = 'translate3d(' + x.toFixed(2) + 'vw,' + y.toFixed(2) + 'vh,0)';

      if (progress < 1) {
        flightRaf = window.requestAnimationFrame(frame);
      } else {
        flightRaf = 0;
        dragon.style.opacity = '';
        dragon.style.transform = '';
        flightActive = false;
        scheduleFlight();
      }
    }

    flightRaf = window.requestAnimationFrame(frame);
  }

  function stopFlight() {
    window.clearTimeout(flightTimer);
    flightTimer = 0;
    if (flightRaf) window.cancelAnimationFrame(flightRaf);
    flightRaf = 0;
    flightActive = false;
    if (dragon) {
      dragon.style.opacity = '';
      dragon.style.transform = '';
    }
  }

  function activate() {
    active = themeIsDay();
    background.classList.toggle('day-static', motionIsReduced());
    background.classList.toggle('day-paused', !active || document.hidden);

    if (!active || motionIsReduced() || document.hidden) {
      stopParallax();
      stopFlight();
      resetLayers();
      return;
    }

    scrollY = window.scrollY || 0;
    startParallax();
    if (!flightTimer && !flightRaf) scheduleFlight();
  }

  function onScroll() {
    scrollY = window.scrollY || 0;
    if (active) startParallax();
  }

  function onPointerMove(event) {
    if (!active || !finePointer || !finePointer.matches) return;
    targetPointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    targetPointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  }

  function onPointerLeave() {
    targetPointerX = 0;
    targetPointerY = 0;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('arena:themechange', activate);
  document.addEventListener('visibilitychange', activate);

  if (reducedMotion) {
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', activate);
    else if (reducedMotion.addListener) reducedMotion.addListener(activate);
  }
  if (finePointer) {
    const resetPointer = function () {
      if (!finePointer.matches) onPointerLeave();
    };
    if (finePointer.addEventListener) finePointer.addEventListener('change', resetPointer);
    else if (finePointer.addListener) finePointer.addListener(resetPointer);
  }

  activate();
})();
