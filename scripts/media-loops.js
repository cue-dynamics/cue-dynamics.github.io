/* Integrated, silent video loops. Empty media slots remain placeholders. */
document.addEventListener('DOMContentLoaded', () => {
  const hasSource = (video) => Boolean(video.getAttribute('src') || video.querySelector('source[src]'));
  const videos = [...document.querySelectorAll('video[data-loop-video]')];
  const compact = window.matchMedia('(max-width: 767px)').matches;

  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.controls = video.hasAttribute('data-video-controls');
    video.playsInline = true;
    video.disablePictureInPicture = !video.controls;
    if (!video.controls && compact && video.dataset.mobileSrc) video.src = video.dataset.mobileSrc;
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
    let frame = 0;
    let generation = 0;
    let inView = !('IntersectionObserver' in window);
    let blocked = false;
    const pending = new Map();
    const buffering = new Set();
    const failed = new Set();
    const active = () => tracks.filter((video) => !failed.has(video) && !video.error);
    const shouldPlay = () => inView && !document.hidden;
    const stopFrame = () => { cancelAnimationFrame(frame); frame = 0; };
    const pause = () => {
      generation++;
      pending.clear();
      stopFrame();
      tracks.forEach((video) => video.pause());
    };

    // All matching views share a start and restart at the shortest clip's end.
    tracks.forEach((video) => {
      video.autoplay = false;
      video.loop = false;
      video.pause();
    });
    const align = (time) => {
      active().forEach((video) => {
        if (video.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - time) > .06) video.currentTime = time;
      });
    };
    const restart = () => {
      pause();
      group.dispatchEvent(new Event('media:loop'));
      active().forEach((video) => { if (video.readyState >= 1) video.currentTime = 0; });
      buffering.clear();
      start();
    };
    const tick = () => {
      frame = 0;
      const playing = active();
      if (!shouldPlay() || !playing.length || playing.some((video) => video.paused || video.seeking || buffering.has(video))) return;
      const leader = playing[0];
      const duration = Math.min(...playing.map((video) => video.duration));
      if (Number.isFinite(duration) && leader.currentTime >= duration - .03) {
        restart();
        return;
      }
      align(leader.currentTime);
      frame = requestAnimationFrame(tick);
    };
    const requestPlay = (video, force = false) => {
      if (!force && (pending.has(video) || !video.paused)) return;
      const attempt = { generation };
      pending.set(video, attempt);
      // Ask for playback before canplay: iPhone may defer loading until play().
      // Keep this call synchronous when reached from a tap or keypress.
      let result;
      try { result = video.play(); } catch (error) { result = Promise.reject(error); }
      Promise.resolve(result).then(() => {
        if (pending.get(video) !== attempt || attempt.generation !== generation) return;
        pending.delete(video);
        settle();
      }, (error) => {
        if (pending.get(video) !== attempt || attempt.generation !== generation) return;
        pending.delete(video);
        if (error?.name === 'NotAllowedError') {
          blocked = true;
          pause();
        } else if (error?.name === 'NotSupportedError') {
          failed.add(video);
          settle();
        } else if (error?.name === 'AbortError') {
          settle();
        }
        // AbortError is expected while a source changes or a partner buffers.
      });
    };
    const settle = () => {
      if (!shouldPlay() || blocked) return;
      const playing = active();
      if (!playing.length) return;
      if (playing.some((video) => video.readyState < 2 || video.seeking || buffering.has(video))) {
        stopFrame();
        // Freeze the ready view, keeping the buffering video's play request alive.
        // Pausing both here can prevent Safari from loading either stream.
        playing.forEach((video) => {
          if (video.readyState >= 2 && !video.seeking && !buffering.has(video)) video.pause();
        });
        return;
      }
      align(playing[0].currentTime);
      playing.forEach((video) => requestPlay(video));
      if (playing.every((video) => !video.paused) && !frame) frame = requestAnimationFrame(tick);
    };
    const start = (force = false) => {
      if (!shouldPlay() || (blocked && !force)) return;
      if (force) blocked = false;
      active().forEach((video) => requestPlay(video, force));
      settle();
    };
    group.addEventListener('media:reset', () => {
      pause();
      blocked = false;
      buffering.clear();
      failed.clear();
      tracks.forEach((video) => {
        video.classList.remove('is-ready');
        video.parentElement.classList.remove('has-loop-video');
      });
    });
    group.addEventListener('media:play', () => start(true));
    group.addEventListener('click', () => start(true));
    tracks.forEach((video) => {
      video.addEventListener('loadeddata', settle);
      ['canplay', 'playing', 'seeked'].forEach((name) => video.addEventListener(name, () => {
        buffering.delete(video);
        settle();
      }));
      video.addEventListener('waiting', () => { buffering.add(video); settle(); });
      video.addEventListener('ended', restart);
      video.addEventListener('error', () => { failed.add(video); settle(); });
    });
    const updateVisibility = () => {
      if (shouldPlay()) {
        blocked = false;
        start();
      } else pause();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        updateVisibility();
      }, { threshold: 0 }).observe(group);
    }
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', updateVisibility);
    start();
  });
});
