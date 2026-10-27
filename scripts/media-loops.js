/* Integrated, silent video loops. Empty media slots remain placeholders. */
document.addEventListener('DOMContentLoaded', () => {
  const hasSource = (video) => Boolean(video.getAttribute('src') || video.querySelector('source[src]'));
  const videos = [...document.querySelectorAll('video[data-loop-video]')];

  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.controls = video.hasAttribute('data-video-controls');
    video.playsInline = true;
    video.disablePictureInPicture = !video.controls;
    const reveal = () => {
      video.classList.add('is-ready');
      video.parentElement.classList.add('has-loop-video');
    };
    video.addEventListener('loadeddata', reveal);
    video.addEventListener('error', () => {
      video.classList.remove('is-ready');
      video.parentElement.classList.remove('has-loop-video');
    });
    if (video.readyState >= 2) reveal();
  });

  document.querySelectorAll('[data-video-sync]').forEach((group) => {
    const tracks = [...group.querySelectorAll('video[data-loop-video]')];
    if (tracks.length < 2 || !tracks.every(hasSource)) return;
    const leader = tracks[0];
    let frame = 0;
    let starting = false;
    let generation = 0;

    // All matching views share a start and restart at the shortest clip's end.
    tracks.forEach((video) => {
      video.autoplay = false;
      video.loop = false;
      video.pause();
    });
    const ready = () => tracks.every((video) => video.readyState >= 3 && !video.seeking);
    const align = (time) => {
      tracks.forEach((video) => {
        if (Math.abs(video.currentTime - time) > .06) video.currentTime = time;
      });
    };
    const tick = () => {
      frame = 0;
      if (leader.paused) return;
      const duration = Math.min(...tracks.map((video) => video.duration));
      if (Number.isFinite(duration) && leader.currentTime >= duration - .03) {
        group.dispatchEvent(new Event('media:loop'));
        tracks.forEach((video) => { video.currentTime = 0; });
      } else {
        align(leader.currentTime);
      }
      frame = requestAnimationFrame(tick);
    };
    const playTogether = async () => {
      if (starting || !ready()) return;
      const currentGeneration = generation;
      starting = true;
      align(leader.currentTime);
      await Promise.allSettled(tracks.map((video) => video.play()));
      if (currentGeneration !== generation) return;
      starting = false;
      if (!leader.paused && !frame) frame = requestAnimationFrame(tick);
    };
    group.addEventListener('media:reset', () => {
      generation++;
      starting = false;
      tracks.forEach((video) => {
        video.pause();
        video.classList.remove('is-ready');
        video.parentElement.classList.remove('has-loop-video');
      });
      cancelAnimationFrame(frame);
      frame = 0;
    });
    tracks.forEach((video) => {
      video.addEventListener('canplay', playTogether);
      video.addEventListener('waiting', () => {
        tracks.forEach((track) => track.pause());
        cancelAnimationFrame(frame);
        frame = 0;
      });
      video.addEventListener('ended', () => {
        group.dispatchEvent(new Event('media:loop'));
        tracks.forEach((track) => { track.currentTime = 0; });
        playTogether();
      });
    });
    playTogether();
  });
});
