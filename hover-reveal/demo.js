(() => {
  'use strict';
  const source = document.getElementById('source');
  const stage = document.getElementById('stage');
  const real = document.getElementById('real-view');
  const sim = document.getElementById('sim-view');
  const realContext = real.getContext('2d', { alpha: false });
  const simContext = sim.getContext('2d', { alpha: false });
  const play = document.getElementById('play');
  const scrubber = document.getElementById('scrubber');
  const speed = document.getElementById('speed');
  const pin = document.getElementById('pin');
  const label = document.getElementById('frame-label-text');
  const time = document.getElementById('time');
  const loading = document.getElementById('loading');

  let camera = 'angled';
  let mode = 'lens';
  let hovering = false;
  let pinned = false;
  let holdingSpace = false;
  let ready = false;
  let framePending = false;
  let sourceFrameRequest = null;
  let pointer = { x: 0.55, y: 0.5 };

  const format = (value) => `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, '0')}`;

  function updateReveal() {
    real.toggleAttribute('data-overhead-color', camera === 'overhead');
    const reveal = hovering || pinned || holdingSpace;
    const fullSimulation = reveal && (mode === 'frame' || pinned || holdingSpace);
    stage.classList.toggle('is-revealing', reveal);
    stage.classList.toggle('is-pinned', pinned || holdingSpace);
    stage.classList.toggle('is-simulation', fullSimulation);
    label.textContent = fullSimulation ? 'Calibrated simulation' : 'Real footage';
    pin.setAttribute('aria-pressed', String(pinned));
    pin.textContent = pinned ? 'Show real footage' : 'Show simulation';
  }

  function positionLens() {
    const bounds = stage.getBoundingClientRect();
    const x = pointer.x * bounds.width;
    const y = pointer.y * bounds.height;
    const radius = Math.max(76, Math.min(175, bounds.width * 0.22));
    stage.style.setProperty('--mx', `${x}px`);
    stage.style.setProperty('--my', `${y}px`);
    stage.style.setProperty('--radius', `${radius}px`);
    stage.style.setProperty('--label-x', `${Math.min(bounds.width - 62, Math.max(62, x))}px`);
    stage.style.setProperty('--label-y', `${Math.min(bounds.height - 18, Math.max(18, y - radius * 0.68))}px`);
  }

  function updateTransport() {
    const duration = Number.isFinite(source.duration) ? source.duration : 0;
    scrubber.max = String(duration || 1);
    scrubber.value = String(source.currentTime);
    scrubber.setAttribute('aria-valuetext', `${format(source.currentTime)} of ${format(duration)}`);
    time.textContent = `${format(source.currentTime)} / ${format(duration)}`;
    play.setAttribute('aria-label', source.paused ? 'Play footage' : 'Pause footage');
    document.getElementById('pause-icon').toggleAttribute('hidden', source.paused);
    document.getElementById('play-icon').toggleAttribute('hidden', !source.paused);
  }

  function draw() {
    framePending = false;
    if (!ready || source.readyState < 2) return;
    const panelWidth = source.videoWidth / 2;
    const panelHeight = source.videoHeight / 2;
    const y = camera === 'overhead' ? panelHeight : 0;
    // Both canvases sample the very same decoded frame. Switching never seeks or restarts playback.
    realContext.drawImage(source, 0, y, panelWidth, panelHeight, 0, 0, real.width, real.height);
    simContext.drawImage(source, panelWidth, y, panelWidth, panelHeight, 0, 0, sim.width, sim.height);
    updateTransport();
  }

  function requestDraw() {
    if (!framePending) {
      framePending = true;
      requestAnimationFrame(draw);
    }
  }

  function scheduleVideoFrame() {
    if (sourceFrameRequest !== null || source.paused) return;
    if ('requestVideoFrameCallback' in source) {
      sourceFrameRequest = source.requestVideoFrameCallback(() => {
        sourceFrameRequest = null;
        draw();
        scheduleVideoFrame();
      });
    } else {
      sourceFrameRequest = requestAnimationFrame(() => {
        sourceFrameRequest = null;
        draw();
        scheduleVideoFrame();
      });
    }
  }

  async function start() {
    try { await source.play(); }
    catch { updateTransport(); }
  }

  source.muted = true;
  source.playbackRate = 0.5;
  source.addEventListener('loadeddata', () => {
    ready = true;
    loading.hidden = true;
    draw();
    start();
  });
  source.addEventListener('play', () => { updateTransport(); scheduleVideoFrame(); });
  source.addEventListener('pause', updateTransport);
  source.addEventListener('seeked', requestDraw);
  source.addEventListener('loadedmetadata', updateTransport);
  source.addEventListener('error', () => {
    loading.hidden = false;
    loading.textContent = 'The clip could not load. Reload to try again.';
  });

  stage.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hovering = true;
    updateReveal();
  });
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    pointer = {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
    positionLens();
  });
  stage.addEventListener('pointerleave', () => { hovering = false; updateReveal(); });
  stage.addEventListener('pointercancel', () => { hovering = false; updateReveal(); });
  stage.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    holdingSpace = true;
    updateReveal();
  });
  stage.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    holdingSpace = false;
    updateReveal();
  });
  stage.addEventListener('blur', () => { holdingSpace = false; updateReveal(); });
  window.addEventListener('blur', () => { holdingSpace = false; hovering = false; updateReveal(); });
  let resumeAfterHidden = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeAfterHidden = !source.paused;
      source.pause();
      if (sourceFrameRequest !== null) {
        if ('cancelVideoFrameCallback' in source) source.cancelVideoFrameCallback(sourceFrameRequest);
        else cancelAnimationFrame(sourceFrameRequest);
        sourceFrameRequest = null;
      }
      holdingSpace = false; hovering = false; updateReveal();
    } else if (resumeAfterHidden) { resumeAfterHidden = false; start(); }
  });

  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.addEventListener('click', () => {
      camera = button.dataset.camera;
      updateReveal();
      document.querySelectorAll('[data-camera]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      requestDraw();
    });
  });
  document.querySelectorAll('[data-mode]').forEach((button) => {
    if (button === stage) return;
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      stage.dataset.mode = mode;
      document.querySelectorAll('button[data-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      updateReveal();
    });
  });
  pin.addEventListener('click', () => { pinned = !pinned; updateReveal(); });
  play.addEventListener('click', () => { if (source.paused) start(); else source.pause(); });
  scrubber.addEventListener('input', () => { source.currentTime = Number(scrubber.value); updateTransport(); });
  speed.addEventListener('click', () => {
    const rates = [0.5, 1, 0.25];
    const next = rates[(rates.indexOf(source.playbackRate) + 1) % rates.length];
    source.playbackRate = next;
    speed.textContent = `${next}×`;
    speed.setAttribute('aria-label', `Playback speed: ${next} times`);
  });
  new ResizeObserver(positionLens).observe(stage);
  positionLens();
  updateReveal();
  if (source.readyState >= 2) {
    ready = true;
    loading.hidden = true;
    draw();
    start();
  }
})();
