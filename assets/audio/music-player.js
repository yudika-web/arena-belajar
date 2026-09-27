(() => {
  'use strict';

  const audio = document.getElementById('arena-bgm');
  const controller = document.getElementById('music-controller');
  const muteButton = document.getElementById('music-mute');
  const volumeInput = document.getElementById('music-volume');
  const volumeValue = document.getElementById('music-volume-value');
  const stateText = document.getElementById('music-state');

  if (!audio || !controller || !muteButton || !volumeInput || !stateText) return;

  const STORAGE_VOLUME = 'arenaBelajar.musicVolume';
  const STORAGE_MUTED = 'arenaBelajar.musicMuted';
  const DEFAULT_VOLUME = 0.30;
  let autoplayMutedFallback = false;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const getStoredVolume = () => {
    const value = Number.parseFloat(localStorage.getItem(STORAGE_VOLUME));
    return Number.isFinite(value) ? clamp(value, 0, 1) : DEFAULT_VOLUME;
  };
  const getStoredMuted = () => localStorage.getItem(STORAGE_MUTED) === 'true';

  let preferredVolume = getStoredVolume();
  let userMuted = getStoredMuted();

  audio.volume = preferredVolume;
  audio.muted = userMuted;
  volumeInput.value = String(Math.round(preferredVolume * 100));

  const isEffectivelyMuted = () => audio.muted || audio.volume === 0;

  const updateUI = () => {
    const volumePercent = Math.round(audio.volume * 100);
    const muted = isEffectivelyMuted();
    const playing = !audio.paused && !audio.ended;

    controller.classList.toggle('is-muted', muted);
    controller.classList.toggle('is-playing', playing);
    controller.classList.toggle('is-paused', !playing);
    controller.classList.toggle('is-autoplay-muted', autoplayMutedFallback);

    muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteButton.setAttribute('aria-label', muted ? 'Nyalakan musik latar' : 'Matikan musik latar');
    volumeInput.setAttribute('aria-valuetext', `${volumePercent}%`);
    if (volumeValue) volumeValue.value = `${volumePercent}%`;

    if (autoplayMutedFallback && muted && !userMuted) {
      stateText.textContent = 'Ketuk untuk suara';
    } else if (muted) {
      stateText.textContent = 'Dibisukan';
    } else if (playing) {
      stateText.textContent = `${volumePercent}% · Loop`;
    } else {
      stateText.textContent = 'Siap diputar';
    }
  };

  const persistVolume = () => localStorage.setItem(STORAGE_VOLUME, String(audio.volume));
  const persistMuted = () => localStorage.setItem(STORAGE_MUTED, String(userMuted));

  const playAudio = async () => {
    try {
      await audio.play();
      updateUI();
      return true;
    } catch (_) {
      updateUI();
      return false;
    }
  };

  const attemptAutoplay = async () => {
    // First try the requested audible autoplay. Browsers may block this.
    audio.muted = userMuted;
    if (await playAudio()) return;

    // If the browser blocks audible autoplay, start silently so playback is
    // already running, then restore sound on the first user interaction.
    if (!userMuted) {
      autoplayMutedFallback = true;
      audio.muted = true;
      await playAudio();
      updateUI();
    }
  };

  const unlockSound = async () => {
    if (!autoplayMutedFallback || userMuted) return;
    autoplayMutedFallback = false;
    audio.muted = false;
    if (audio.volume === 0) {
      audio.volume = preferredVolume || DEFAULT_VOLUME;
      volumeInput.value = String(Math.round(audio.volume * 100));
    }
    await playAudio();
    updateUI();
  };

  const unlockOnce = (event) => {
    // Let the dedicated music controls handle their own first interaction.
    // This avoids a click on the mute button being interpreted twice.
    if (event?.target instanceof Node && controller.contains(event.target)) return;
    unlockSound();
    window.removeEventListener('pointerdown', unlockOnce, true);
    window.removeEventListener('keydown', unlockOnce, true);
  };

  window.addEventListener('pointerdown', unlockOnce, true);
  window.addEventListener('keydown', unlockOnce, true);

  muteButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    autoplayMutedFallback = false;

    if (isEffectivelyMuted()) {
      userMuted = false;
      audio.muted = false;
      if (audio.volume === 0) {
        audio.volume = preferredVolume || DEFAULT_VOLUME;
        volumeInput.value = String(Math.round(audio.volume * 100));
      }
      await playAudio();
    } else {
      userMuted = true;
      audio.muted = true;
    }

    persistMuted();
    updateUI();
  });

  volumeInput.addEventListener('input', async () => {
    const nextVolume = clamp(Number(volumeInput.value) / 100, 0, 1);
    preferredVolume = nextVolume || preferredVolume || DEFAULT_VOLUME;
    audio.volume = nextVolume;
    autoplayMutedFallback = false;

    if (nextVolume > 0) {
      userMuted = false;
      audio.muted = false;
      await playAudio();
    }

    persistVolume();
    persistMuted();
    updateUI();
  });

  audio.addEventListener('play', updateUI);
  audio.addEventListener('pause', updateUI);
  audio.addEventListener('volumechange', updateUI);
  audio.addEventListener('error', () => {
    controller.classList.add('is-paused');
    stateText.textContent = 'Audio tidak tersedia';
    muteButton.disabled = true;
    volumeInput.disabled = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audio.paused && !userMuted) playAudio();
  });

  updateUI();
  attemptAutoplay();
})();
