const audioTriggerEl       = document.getElementById('audio-trigger');
  const audioIconContainerEl = document.getElementById('audio-icon-container');
  const audioPlayerEl        = document.getElementById('audio-player');

  let audioIconBuilt = false;

  function audioBuildIconOnce() {
    if (audioIconBuilt) return;
    audioIconContainerEl.innerHTML = `
     <img src="/assets/cdn.prod.website-files.com/68b73cd966b9c097c35f357b/68e6fb1b58eb55bbfb2a72fd_soundwave.gif" class="img-audio-icon"/>
    `;
    audioIconBuilt = true;
  }

  function audioSetUI(isPlaying) {
    audioTriggerEl.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    audioIconContainerEl.classList.toggle('visible', isPlaying);
  }

  async function audioToggle(e) {
    e.preventDefault();
    audioBuildIconOnce();

    if (audioPlayerEl.paused) {
      try {
        await audioPlayerEl.play();
        audioSetUI(true);
      } catch (err) {
        console.warn('Audio playback failed:', err);
        audioSetUI(false);
      }
    } else {
      audioPlayerEl.pause();
      audioSetUI(false);
    }
  }

  audioTriggerEl.addEventListener('click', audioToggle);
  audioTriggerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') audioToggle(e);
  });

  audioPlayerEl.addEventListener('ended', () => audioSetUI(false));
