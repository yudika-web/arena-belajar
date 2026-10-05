'use strict';

// Playlist mandiri: aset MP3 tetap terpisah dari HTML dan data koleksi.
(() => {
  const player = document.querySelector('#music-player');
  const audio = document.querySelector('#background-music');
  if (!player || !audio) return;
  const tracks = [
    { title: 'Final Chord', src: './assets/audio/final-chord.mp3' },
    { title: 'Final Boss', src: './assets/audio/final-boss.mp3' },
    { title: 'Final Stand', src: './assets/audio/final-stand.mp3' }
  ];
  const toggle = document.querySelector('#music-toggle');
  const toggleLabel = document.querySelector('#music-toggle-label');
  const toggleIcon = document.querySelector('#music-toggle-icon');
  const select = document.querySelector('#music-track');
  const volume = document.querySelector('#music-volume');
  const volumeValue = document.querySelector('#music-volume-value');
  const mute = document.querySelector('#music-mute');
  const muteIcon = document.querySelector('#music-mute-icon');
  const status = document.querySelector('#music-status');
  let selected = 0;
  let loaded = -1;
  let desired = false;
  let pending = false;
  let generation = 0;
  let rememberedVolume = 20;

  function updateButton() {
    const running = desired && (pending || !audio.paused);
    toggleLabel.textContent = running ? 'Jeda' : 'Putar';
    toggle.setAttribute('aria-label', running ? 'Jeda musik latar' : 'Putar musik latar');
    toggleIcon.setAttribute('href', running ? '#icon-pause' : '#icon-play');
    player.classList.toggle('is-playing', running && !pending);
  }

  function setVolume(value) {
    const amount = Math.max(0, Math.min(100, Number(value) || 0));
    audio.volume = amount / 100;
    volume.value = String(amount);
    volumeValue.textContent = `${amount}%`;
    volume.setAttribute('aria-valuetext', `${amount} persen`);
    mute.setAttribute('aria-pressed', String(amount === 0));
    mute.setAttribute('aria-label', amount === 0 ? 'Aktifkan suara musik' : 'Senyapkan musik');
    muteIcon.setAttribute('href', amount === 0 ? '#icon-mute' : '#icon-volume');
    if (amount > 0) rememberedVolume = amount;
  }

  function reportFailure(message) {
    generation += 1;
    desired = false;
    pending = false;
    audio.pause();
    // Permintaan berikutnya akan memuat ulang sumber yang gagal.
    loaded = -1;
    status.textContent = message;
    updateButton();
  }

  async function start() {
    const request = ++generation;
    desired = true;
    pending = true;
    status.textContent = `Menyiapkan ${tracks[selected].title}…`;
    updateButton();
    try {
      if (loaded !== selected) {
        // Gunakan penyaring URL yang sama dengan aplikasi utama.
        const source = safeURL(tracks[selected].src);
        if (!source) throw new Error('Sumber audio tidak valid');
        audio.src = source;
        loaded = selected;
        audio.load();
      }
      await audio.play();
      if (request !== generation) return;
      pending = false;
      status.textContent = `Sedang diputar: ${tracks[selected].title}.`;
      updateButton();
    } catch (error) {
      if (request !== generation) return;
      const message = error.name === 'NotAllowedError'
        ? 'Browser menahan pemutaran. Tekan Putar untuk mencoba lagi.'
        : 'Musik belum bisa diputar. Periksa koneksi dan aset audio, lalu tekan Putar untuk mencoba lagi.';
      reportFailure(message);
    }
  }

  function pause() {
    generation += 1;
    desired = false;
    pending = false;
    audio.pause();
    status.textContent = `Musik dijeda: ${tracks[selected].title}.`;
    updateButton();
  }

  toggle.addEventListener('click', () => desired ? pause() : start());
  select.addEventListener('change', () => {
    const index = Number(select.value);
    if (!Number.isInteger(index) || !tracks[index]) return;
    const resume = desired;
    generation += 1;
    desired = false;
    pending = false;
    audio.pause();
    selected = index;
    // Saat dijeda, memilih judul saja tidak mengunduh lagu baru.
    if (resume) start();
    else {
      status.textContent = `${tracks[selected].title} dipilih. Tekan Putar untuk mulai.`;
      updateButton();
    }
  });
  volume.addEventListener('input', () => setVolume(volume.value));
  mute.addEventListener('click', () => setVolume(audio.volume === 0 ? rememberedVolume : 0));
  audio.addEventListener('ended', () => {
    if (!desired) return;
    selected = (selected + 1) % tracks.length;
    select.value = String(selected);
    start();
  });
  audio.addEventListener('error', () => {
    if (desired) reportFailure('Musik gagal dimuat. Periksa koneksi dan folder assets/audio, lalu tekan Putar untuk mencoba lagi.');
  });
  // Jika sistem/browser menjeda audio, tombol mengikuti keadaan sebenarnya.
  audio.addEventListener('pause', () => {
    if (!pending && desired && !audio.ended) {
      desired = false;
      status.textContent = `Musik dijeda: ${tracks[selected].title}.`;
      updateButton();
    }
  });
  audio.addEventListener('playing', () => {
    if (!desired) { audio.pause(); return; }
    status.textContent = `Sedang diputar: ${tracks[selected].title}.`;
  });

  setVolume(volume.value);
  player.hidden = false;
  updateButton();
})();
