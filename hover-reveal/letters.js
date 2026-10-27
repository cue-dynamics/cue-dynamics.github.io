(() => {
  'use strict';
  const source = document.getElementById('source');
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('real-view');
  const renderer = window.createVideoRevealRenderer?.(source, canvas);
  if (!renderer) return;
  document.getElementById('sim-view').hidden = true;
  const guide = document.getElementById('letter-guide');
  const lensLabel = document.getElementById('lens-label-text');
  const outline = stage.querySelector('.lens-outline');
  const lensCaption = stage.querySelector('.lens-label');
  const play = document.getElementById('play');
  const scrubber = document.getElementById('scrubber');
  const speed = document.getElementById('speed');
  const pin = document.getElementById('pin');
  const label = document.getElementById('frame-label-text');
  const time = document.getElementById('time');
  const loading = document.getElementById('loading');
  const nativeFrames = 'requestVideoFrameCallback' in source;
  let camera = 'overhead', activeLetter = 'C', clip = null;
  let letterClips = [], letterGuides = null, playback = null;
  let mode = 'lens', hovering = false, pinned = false, holdingSpace = false;
  let ready = false, visible = true, wantsPlayback = true, layout = 'quad', sourceURL = '';
  let frameRequest = null, paintRequest = null, lastTime = -1, lastTransport = -Infinity;
  let pendingTime = null;
  let bounds = null, radius = 160, pointer = { x: .55, y: .5 };

  const format = (value) => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}`;
  function updateTransport(force = false) {
    const now = performance.now();
    if (!force && now - lastTransport < 125) return;
    lastTransport = now;
    if (clip) {
      const part = clip.timeline.find((shot) => source.currentTime < shot.start + shot.duration) || clip.timeline.at(-1);
      const final = source.currentTime >= clip.duration - clip.final_hold;
      const text = final ? `${activeLetter} · Final arrangement` : `${activeLetter} · Stroke ${part.index} / 6 · ${part.ball}`;
      const status = document.getElementById('letter-status');
      if (status.textContent !== text) status.textContent = text;
    }
    const duration = Number.isFinite(source.duration) ? source.duration : 0;
    scrubber.max = String(duration || 1);
    scrubber.value = String(source.currentTime);
    scrubber.setAttribute('aria-valuetext', `${format(source.currentTime)} of ${format(duration)}`);
    time.textContent = `${format(source.currentTime)} / ${format(duration)}`;
    play.setAttribute('aria-label', source.paused ? 'Play footage' : 'Pause footage');
    document.getElementById('pause-icon').toggleAttribute('hidden', source.paused);
    document.getElementById('play-icon').toggleAttribute('hidden', !source.paused);
  }
  function updateGuide() {
    if (!letterGuides) return;
    const view = letterGuides.letters[activeLetter][camera];
    guide.setAttribute('viewBox', view.view_box);
    guide.setAttribute('stroke', letterGuides.color);
    guide.setAttribute('stroke-width', view.stroke_width);
    guide.setAttribute('opacity', letterGuides.opacity);
    guide.querySelector('path').setAttribute('d', view.path);
  }
  function draw() {
    paintRequest = null;
    if (!ready || source.readyState < 2 || !visible || document.hidden || !bounds) return;
    const panelWidth = source.videoWidth / 2;
    const panelHeight = source.videoHeight / (layout === 'pair' ? 1 : 2);
    const y = layout === 'quad' && camera === 'overhead' ? panelHeight : 0;
    const x = pointer.x * bounds.width, pointerY = pointer.y * bounds.height;
    if (hovering) {
      outline.style.transform = `translate3d(${x - radius}px, ${pointerY - radius}px, 0)`;
      const labelX = Math.min(bounds.width - 62, Math.max(62, x));
      const labelY = Math.min(bounds.height - 18, Math.max(18, pointerY - radius * .68));
      lensCaption.style.transform = `translate3d(${labelX}px, ${labelY}px, 0) translate(-50%, -50%)`;
    }
    renderer.render([{
      viewport: [0, 0, bounds.width, bounds.height],
      real: [0, y, panelWidth, panelHeight], simulation: [panelWidth, y, panelWidth, panelHeight],
      simulationBase: pinned, revealing: hovering || holdingSpace,
      full: holdingSpace || mode === 'frame', pointer: [x, pointerY], radius,
    }]);
    updateTransport();
  }
  function requestPaint() {
    if (paintRequest === null && !document.hidden) paintRequest = requestAnimationFrame(draw);
  }
  function newFrame() { renderer.invalidate(); requestPaint(); }
  function updateReveal() {
    const fullReveal = (hovering || holdingSpace) && (mode === 'frame' || holdingSpace);
    const simulation = pinned !== fullReveal;
    stage.classList.toggle('is-revealing', hovering || holdingSpace);
    stage.classList.toggle('is-pinned', holdingSpace);
    stage.classList.toggle('is-simulation', simulation);
    stage.classList.toggle('is-simulation-base', pinned);
    label.textContent = simulation ? 'Calibrated simulation' : 'Real footage';
    lensLabel.textContent = pinned ? 'Real footage' : 'Simulation';
    canvas.setAttribute('aria-label', `Letter ${activeLetter}: ${simulation ? 'simulation' : 'real footage'} with the opposite view on hover`);
    pin.setAttribute('aria-pressed', String(pinned));
    pin.textContent = pinned ? 'Show real footage' : 'Show simulation';
    requestPaint();
  }
  function measure() {
    bounds = stage.getBoundingClientRect();
    renderer.resize(bounds.width, bounds.height);
    radius = Math.max(76, Math.min(175, bounds.width * .22));
    outline.style.width = outline.style.height = `${2 * radius}px`;
    requestPaint();
  }
  function cancelFrame() {
    if (frameRequest !== null) {
      if (nativeFrames) source.cancelVideoFrameCallback(frameRequest);
      else cancelAnimationFrame(frameRequest);
      frameRequest = null;
    }
  }
  function scheduleFrame() {
    if (frameRequest !== null || source.paused || !visible || document.hidden) return;
    const tick = () => {
      frameRequest = null;
      if (nativeFrames || source.currentTime !== lastTime) {
        lastTime = source.currentTime;
        newFrame();
      }
      scheduleFrame();
    };
    frameRequest = nativeFrames ? source.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  function syncPlayback() {
    if (!visible || document.hidden || !wantsPlayback) {
      source.pause();
      cancelFrame();
      if (paintRequest !== null) { cancelAnimationFrame(paintRequest); paintRequest = null; }
    } else if (ready) source.play().catch(() => updateTransport(true));
  }
  function selectSource(preserveTime = false) {
    if (!clip) return;
    const optimized = playback?.letters[activeLetter];
    const paired = optimized?.original_source === clip.pair ? optimized[camera] : null;
    const url = paired?.pair || clip.pair;
    layout = paired ? 'pair' : 'quad';
    updateGuide();
    updateReveal();
    document.getElementById('download-sim').href = clip.views[camera].simulation;
    if (url === sourceURL) { newFrame(); return; }
    pendingTime = preserveTime ? source.currentTime : null;
    source.pause();
    cancelFrame();
    sourceURL = url;
    ready = false;
    lastTime = -1;
    loading.hidden = false;
    loading.textContent = 'Loading footage…';
    source.preload = 'auto';
    source.src = url;
    source.load();
  }
  source.muted = true;
  source.defaultMuted = true;
  source.playbackRate = 1;
  source.addEventListener('loadeddata', () => {
    ready = true;
    loading.hidden = true;
    newFrame();
    updateTransport(true);
    syncPlayback();
  });
  source.addEventListener('play', () => { updateTransport(true); scheduleFrame(); });
  source.addEventListener('pause', () => { cancelFrame(); updateTransport(true); });
  source.addEventListener('seeked', () => { newFrame(); updateTransport(true); });
  source.addEventListener('loadedmetadata', () => {
    if (pendingTime !== null) {
      source.currentTime = Math.min(pendingTime, source.duration || pendingTime);
      pendingTime = null;
    }
    updateTransport(true);
  });
  source.addEventListener('error', () => { loading.hidden = false; loading.textContent = 'The clip could not load. Reload to try again.'; });

  function movePointer(event) {
    if (event.pointerType === 'touch') return;
    if (!hovering) measure();
    pointer = {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
    if (!hovering) { hovering = true; updateReveal(); }
    requestPaint();
  }
  stage.addEventListener('pointerenter', movePointer);
  stage.addEventListener('pointermove', movePointer, { passive: true });
  stage.addEventListener('pointerleave', () => { hovering = false; updateReveal(); });
  stage.addEventListener('pointercancel', () => { hovering = false; updateReveal(); });
  stage.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault(); holdingSpace = true; updateReveal();
  });
  stage.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault(); holdingSpace = false; updateReveal();
  });
  stage.addEventListener('blur', () => { holdingSpace = false; updateReveal(); });
  window.addEventListener('blur', () => { holdingSpace = false; hovering = false; updateReveal(); });
  window.addEventListener('scroll', () => { if (hovering) measure(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hovering = false; holdingSpace = false; updateReveal(); }
    syncPlayback();
  });
  document.querySelectorAll('[data-camera]').forEach((button) => button.addEventListener('click', () => {
    camera = button.dataset.camera;
    document.querySelectorAll('[data-camera]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    selectSource(true);
  }));
  document.querySelectorAll('button[data-mode]').forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    stage.dataset.mode = mode;
    document.querySelectorAll('button[data-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    updateReveal();
  }));
  pin.addEventListener('click', () => { pinned = !pinned; updateReveal(); });
  play.addEventListener('click', () => { wantsPlayback = source.paused; syncPlayback(); });
  scrubber.addEventListener('input', () => { source.currentTime = Number(scrubber.value); updateTransport(true); });
  speed.addEventListener('click', () => {
    const rates = [1, .5, .25];
    source.playbackRate = rates[(rates.indexOf(source.playbackRate) + 1) % rates.length];
    speed.textContent = `${source.playbackRate}×`;
    speed.setAttribute('aria-label', `Playback speed: ${source.playbackRate} times`);
  });
  document.querySelectorAll('[data-letter]').forEach((button) => button.addEventListener('click', () => {
    const next = letterClips.find((item) => item.letter === button.dataset.letter);
    if (!next || next === clip) return;
    clip = next;
    activeLetter = next.letter;
    document.querySelectorAll('[data-letter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    selectSource();
  }));
  Promise.all([
    fetch('/media/real-table/letters.json').then((response) => { if (!response.ok) throw new Error('Media unavailable'); return response.json(); }),
    fetch('/media/real-table/playback.json').then((response) => response.ok ? response.json() : null).catch(() => null),
  ]).then(([manifest, optimized]) => {
    letterClips = manifest.letters;
    playback = optimized;
    clip = letterClips.find((item) => item.letter === activeLetter);
    selectSource();
  }).catch(() => { loading.textContent = 'The demonstration could not load. Reload to try again.'; });
  fetch('/media/real-table/letter-guides.json').then((response) => {
    if (!response.ok) throw new Error('Letter guides unavailable');
    return response.json();
  }).then((manifest) => { letterGuides = manifest; updateGuide(); }).catch(() => guide.setAttribute('hidden', ''));
  new ResizeObserver(measure).observe(stage);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncPlayback(); if (visible) requestPaint(); }).observe(stage);
  measure();
  updateReveal();
})();
