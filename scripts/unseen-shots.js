/* One decoded clock, with the same circular real/simulation reveal as the CORL grid. */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('#prediction-results');
  const data = document.querySelector('#unseen-shot-data');
  if (!section || !data) return;
  let manifest;
  try { manifest = JSON.parse(data.textContent); } catch (_) { return; }
  const shots = manifest.shots;
  if (!shots?.length) return;
  const pair = section.querySelector('[data-unseen-pair]');
  const source = section.querySelector('[data-unseen-source]');
  const buttons = [...section.querySelectorAll('[data-unseen-shot]')];
  const controls = [...section.querySelectorAll('[data-unseen-view]')];
  const stage = pair.querySelector('.unseen-stage');
  const lens = pair.querySelector('.unseen-lens');
  const posters = [...pair.querySelectorAll('.unseen-poster')];
  const hint = section.querySelector('[data-unseen-hint]');
  const status = section.querySelector('[data-unseen-status]');
  const output = document.createElement('canvas');
  output.className = 'unseen-composite';
  output.setAttribute('aria-hidden', 'true');
  stage.prepend(output);
  const renderer = window.createVideoRevealRenderer?.(source, output);
  const animated = Boolean(renderer) && output.dataset.videoRenderer !== 'canvas2d';
  if (!animated) output.remove();
  let current = shots[0];
  let mode = 'real';
  let hovering = false;
  let full = false;
  let pointer = [0, 0];
  let radius = 115;
  let bounds;
  let visible = false;
  let ready = false;
  let expectedSource = '';
  let requested = null;
  let paintRequest = null;
  let lastTime = -1;
  let viewport = [0, 0, 1, 1];
  const nativeFrames = 'requestVideoFrameCallback' in source;
  source.muted = source.defaultMuted = true;
  source.loop = source.playsInline = true;
  source.controls = false;
  source.disablePictureInPicture = true;

  const updateLabel = () => {
    const base = mode === 'simulation' ? 'Simulation' : 'Real footage';
    const alternate = mode === 'simulation' ? 'Real footage' : 'Simulation';
    stage.setAttribute('aria-label', `Shot ${current.number}: ${current.target} ball. ${full ? alternate : base}${hovering && !full ? ` with a circular ${alternate.toLowerCase()} reveal` : ''}.`);
    if (hint) hint.textContent = mode === 'simulation' ? 'Hover to see the real footage' : 'Hover to see the simulation';
  };
  const draw = () => {
    paintRequest = null;
    if (!animated || !ready || !visible || document.hidden || source.readyState < 2) return;
    const scale = source.videoWidth / current.width;
    const scene = {
      viewport,
      real: current.real_region.map((v) => v * scale),
      simulation: current.model_region.map((v) => v * scale),
      mask: current.alpha_region.map((v) => v * scale),
      simulationBase: mode === 'simulation', revealing: hovering || full,
      full, pointer, radius,
    };
    if (renderer.render([scene])) pair.classList.add('has-frames');
    else pair.classList.remove('has-frames');
  };
  const requestPaint = () => {
    if (!animated || document.hidden) return;
    if (paintRequest === null) paintRequest = requestAnimationFrame(draw);
  };
  const measure = () => {
    const box = pair.getBoundingClientRect();
    renderer?.resize(box.width, box.height);
    bounds = stage.getBoundingClientRect();
    viewport = [bounds.left - box.left, bounds.top - box.top, bounds.width, bounds.height];
    radius = Math.max(65, Math.min(145, bounds.width * .23));
    lens.style.width = lens.style.height = `${2 * radius}px`;
    stage.style.setProperty('--unseen-radius', `${radius}px`);
    requestPaint();
  };
  const cancelFrame = () => {
    if (requested === null) return;
    if (nativeFrames) source.cancelVideoFrameCallback(requested);
    else cancelAnimationFrame(requested);
    requested = null;
  };
  const scheduleFrame = () => {
    if (requested !== null || !ready || source.paused || !visible || document.hidden) return;
    const tick = () => {
      requested = null;
      if (nativeFrames || lastTime !== source.currentTime) {
        lastTime = source.currentTime;
        renderer.invalidate();
        requestPaint();
      }
      scheduleFrame();
    };
    requested = nativeFrames ? source.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  };
  const load = () => {
    const url = new URL(current.video, window.location.href).href;
    if (expectedSource === url) return;
    expectedSource = url;
    source.preload = 'auto';
    source.src = url;
    source.load();
  };
  const syncPlayback = () => {
    if (!animated) return;
    if (!visible || document.hidden) {
      source.pause();
      cancelFrame();
      if (paintRequest !== null) { cancelAnimationFrame(paintRequest); paintRequest = null; }
      return;
    }
    load();
    if (ready) {
      const playing = expectedSource;
      source.play().then(() => {
        if (expectedSource === playing) scheduleFrame();
      }).catch((error) => {
        if (expectedSource === playing && error?.name !== 'AbortError') {
          status.textContent = 'Comparison posters are shown. Automatic video playback is unavailable.';
        }
      });
      requestPaint();
    }
  };
  const clearReveal = () => {
    hovering = full = false;
    pair.classList.remove('is-hovering', 'is-key-revealing');
    updateLabel();
    requestPaint();
  };
  const select = (index) => {
    const next = shots[index];
    if (!next || next.id === current.id) return;
    source.pause();
    cancelFrame();
    ready = false;
    expectedSource = '';
    lastTime = -1;
    current = next;
    pair.classList.remove('has-frames');
    posters[0].src = current.real_poster;
    posters[1].src = current.model_poster;
    clearReveal();
    section.querySelector('[data-unseen-title]').textContent = `Shot ${String(current.number).padStart(2, '0')} · ${current.target[0].toUpperCase() + current.target.slice(1)} ball`;
    section.querySelector('[data-unseen-speed]').textContent = `${current.speed_m_s.toFixed(3)} m/s cue speed`;
    section.querySelector('[data-unseen-path]').textContent = current.path_error_mm.toFixed(1);
    section.querySelector('[data-unseen-endpoint]').textContent = current.endpoint_error_mm.toFixed(1);
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    status.textContent = `Shot ${current.number} selected. Endpoint error ${current.endpoint_error_mm.toFixed(1)} millimeters.`;
    renderer?.invalidate();
    syncPlayback();
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % shots.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + shots.length - 1) % shots.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = shots.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next);
      buttons[next].focus();
    });
  });
  controls.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.unseenView;
    controls.forEach((control) => {
      const active = control === button;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
    });
    pair.classList.toggle('is-simulation', mode === 'simulation');
    clearReveal();
  }));
  const positionLens = (event) => {
    if (event.pointerType === 'touch') return;
    if (!bounds || !hovering) measure();
    pointer = [event.clientX - bounds.left, event.clientY - bounds.top];
    stage.style.setProperty('--unseen-x', `${pointer[0]}px`);
    stage.style.setProperty('--unseen-y', `${pointer[1]}px`);
    lens.style.transform = `translate3d(${pointer[0] - radius}px, ${pointer[1] - radius}px, 0)`;
    if (!hovering) {
      hovering = true;
      pair.classList.add('is-hovering');
      updateLabel();
    }
    requestPaint();
  };
  stage.addEventListener('pointerenter', positionLens);
  stage.addEventListener('pointermove', positionLens, { passive: true });
  const leave = () => {
    hovering = false;
    pair.classList.remove('is-hovering');
    updateLabel();
    requestPaint();
  };
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointercancel', leave);
  stage.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    full = true;
    pair.classList.add('is-key-revealing');
    updateLabel();
    requestPaint();
  });
  const release = () => {
    full = false;
    pair.classList.remove('is-key-revealing');
    updateLabel();
    requestPaint();
  };
  stage.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    release();
  });
  stage.addEventListener('blur', clearReveal);
  window.addEventListener('blur', clearReveal);
  window.addEventListener('scroll', () => { if (hovering) measure(); }, { passive: true });
  source.addEventListener('loadeddata', () => {
    if (!animated || !expectedSource || source.currentSrc !== expectedSource || source.readyState < 2) return;
    ready = true;
    renderer.invalidate();
    measure();
    syncPlayback();
  });
  source.addEventListener('play', scheduleFrame);
  source.addEventListener('pause', cancelFrame);
  source.addEventListener('seeked', () => { renderer?.invalidate(); requestPaint(); });
  source.addEventListener('error', () => {
    if (expectedSource && source.currentSrc && source.currentSrc !== expectedSource) return;
    ready = false;
    source.pause();
    cancelFrame();
    pair.classList.remove('has-frames');
    status.textContent = 'Comparison posters are shown. This shot could not load.';
  });
  document.addEventListener('visibilitychange', syncPlayback);
  updateLabel();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(pair);
  else window.addEventListener('resize', measure);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncPlayback(); }, { rootMargin: '180px' }).observe(pair);
  } else { visible = true; syncPlayback(); }
  measure();
});
