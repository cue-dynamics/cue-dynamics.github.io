/* Translucent prediction over real footage, sampled from one 60 fps frame. */
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
  const views = [...pair.querySelectorAll('.unseen-stage')];
  const posters = [...pair.querySelectorAll('.unseen-poster')];
  const opacityControl = section.querySelector('[data-unseen-opacity]');
  const opacityValue = section.querySelector('[data-unseen-opacity-value]');
  const status = section.querySelector('[data-unseen-status]');
  const output = document.createElement('canvas');
  output.className = 'unseen-composite';
  output.setAttribute('aria-hidden', 'true');
  pair.prepend(output);
  const renderer = window.createVideoRevealRenderer?.(source, output);
  const animated = Boolean(renderer) && output.dataset.videoRenderer !== 'canvas2d';
  if (!animated) output.remove();
  let current = shots[0];
  let opacity = .5;
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

  const draw = () => {
    paintRequest = null;
    if (!animated || !ready || !visible || document.hidden || source.readyState < 2) return;
    const scale = source.videoWidth / current.width;
    const scenes = [{
      viewport,
      real: current.real_region.map((v) => v * scale),
      simulation: current.model_region.map((v) => v * scale),
      mask: current.alpha_region.map((v) => v * scale),
      overlayOpacity: opacity,
      simulationBase: false, revealing: false, full: false, pointer: [0, 0], radius: 0,
    }];
    if (renderer.render(scenes)) pair.classList.add('has-frames');
    else pair.classList.remove('has-frames');
  };
  const requestPaint = () => {
    if (!animated) return;
    if (paintRequest === null) paintRequest = requestAnimationFrame(draw);
  };
  const measure = () => {
    const bounds = pair.getBoundingClientRect();
    renderer?.resize(bounds.width, bounds.height);
    const b = views[0].getBoundingClientRect();
    viewport = [b.left - bounds.left, b.top - bounds.top, b.width, b.height];
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
      source.play().then(scheduleFrame).catch(() => {
        status.textContent = 'Comparison posters are shown. Automatic video playback is unavailable.';
      });
      requestPaint();
    }
  };
  const updateOverlayLabel = () => {
    views[0].setAttribute('aria-label', `Shot ${current.number}: ${current.target} ball, real footage with the prediction overlaid at ${Math.round(opacity * 100)} percent opacity`);
  };
  const updateOpacity = () => {
    const value = Number(opacityControl?.value ?? 50);
    opacity = Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : .5;
    const percent = Math.round(opacity * 100);
    pair.style.setProperty('--unseen-prediction-opacity', String(opacity));
    if (opacityValue) opacityValue.textContent = `${percent}%`;
    opacityControl?.setAttribute('aria-valuetext', `${percent} percent`);
    updateOverlayLabel();
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
    updateOverlayLabel();
    section.querySelector('[data-unseen-title]').textContent = `Shot ${String(current.number).padStart(2, '0')} · ${current.target[0].toUpperCase() + current.target.slice(1)} ball`;
    section.querySelector('[data-unseen-speed]').textContent = `${current.speed_m_s.toFixed(3)} m/s cue speed`;
    section.querySelector('[data-unseen-path]').textContent = current.path_error_mm.toFixed(1);
    section.querySelector('[data-unseen-endpoint]').textContent = current.endpoint_error_mm.toFixed(1);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    status.textContent = `Shot ${current.number} selected. Endpoint error ${current.endpoint_error_mm.toFixed(1)} millimeters.`;
    source.removeAttribute('src');
    source.load();
    renderer?.invalidate();
    syncPlayback();
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', (event) => {
      let next;
      const columns = window.matchMedia('(max-width: 600px)').matches ? 2 : 5;
      if (event.key === 'ArrowRight') next = (index + 1) % shots.length;
      if (event.key === 'ArrowLeft') next = (index + shots.length - 1) % shots.length;
      if (event.key === 'ArrowDown') next = (index + columns) % shots.length;
      if (event.key === 'ArrowUp') next = (index + shots.length - columns) % shots.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = shots.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      select(next);
      buttons[next].focus();
    });
  });
  source.addEventListener('loadeddata', () => {
    if (!expectedSource || source.currentSrc !== expectedSource || source.readyState < 2) return;
    ready = true;
    renderer.invalidate();
    measure();
    syncPlayback();
  });
  source.addEventListener('play', scheduleFrame);
  source.addEventListener('pause', cancelFrame);
  source.addEventListener('seeked', () => { renderer?.invalidate(); requestPaint(); });
  source.addEventListener('error', () => {
    ready = false;
    source.pause();
    cancelFrame();
    pair.classList.remove('has-frames');
    status.textContent = 'Comparison posters are shown. This shot could not load.';
  });
  document.addEventListener('visibilitychange', syncPlayback);
  opacityControl?.addEventListener('input', updateOpacity);
  updateOpacity();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(pair);
  else window.addEventListener('resize', measure);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncPlayback(); }, { rootMargin: '180px' }).observe(pair);
  } else { visible = true; syncPlayback(); }
  measure();
});
