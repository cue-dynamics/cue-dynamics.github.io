document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('[data-corl-grid]');
  const source = document.querySelector('[data-corl-source]');
  if (!grid || !source) return;
  const controls = [...document.querySelectorAll('[data-corl-view]')];
  const status = document.querySelector('[data-corl-status]');
  const hint = document.querySelector('#real-table .lab-hover-hint');
  const output = document.createElement('canvas');
  output.className = 'corl-composite';
  output.setAttribute('aria-hidden', 'true');
  const renderer = window.createVideoRevealRenderer?.(source, output);
  if (!renderer) return;
  grid.prepend(output);
  grid.classList.add('has-compositor');
  const playback = fetch('/media/real-table/playback.json').then((response) => response.ok ? response.json() : null).catch(() => null);
  const tiles = [...grid.querySelectorAll('[data-corl-tile]')].map((element) => ({
    element,
    stage: element.querySelector('.corl-stage'),
    lens: element.querySelector('.corl-lens'),
    poster: element.querySelector('.corl-poster'),
    realCrop: element.dataset.realCrop.split(',').map(Number),
    simCrop: element.dataset.simCrop.split(',').map(Number),
    viewport: [0, 0, 1, 1], pointer: [0, 0], radius: 115, bounds: null, hasFrames: false,
  }));
  let mode = 'real';
  let visible = false;
  let loaded = false;
  let ready = false;
  let frameRequest = null;
  let paintRequest = null;
  let lastTime = -1;
  const nativeFrames = 'requestVideoFrameCallback' in source;
  source.muted = true;
  source.defaultMuted = true;
  source.controls = false;
  source.playsInline = true;
  source.disablePictureInPicture = true;

  const updateLabel = (tile) => {
    const revealing = tile.element.classList.contains('is-hovering') || tile.element.classList.contains('is-key-revealing');
    const simulation = (mode === 'simulation') !== revealing;
    tile.stage.setAttribute('aria-label', `${simulation ? 'Simulation' : 'Real footage'} forming the letter ${tile.element.dataset.corlTile}; hover or hold Space for the opposite view`);
  };
  const draw = () => {
    paintRequest = null;
    if (!ready || source.readyState < 2 || !visible || document.hidden) return;
    const scale = source.videoWidth / Number(source.dataset.frameWidth);
    const scenes = tiles.map((tile, index) => {
      const hovering = tile.element.classList.contains('is-hovering');
      const full = tile.element.classList.contains('is-key-revealing');
      if (hovering) tile.lens.style.transform = `translate3d(${tile.pointer[0] - tile.radius}px, ${tile.pointer[1] - tile.radius}px, 0)`;
      return {
        viewport: tile.viewport,
        real: tile.realCrop.map((value) => value * scale),
        simulation: tile.simCrop.map((value) => value * scale),
        mask: source.dataset.alphaLayout === 'corl'
          ? [index * tile.realCrop[2], 2 * tile.realCrop[3], tile.realCrop[2], tile.realCrop[3]].map((value) => value * scale) : null,
        simulationBase: mode === 'simulation', revealing: hovering || full,
        full, pointer: tile.pointer, radius: tile.radius,
      };
    });
    if (renderer.render(scenes)) tiles.forEach((tile) => {
      if (!tile.hasFrames) { tile.hasFrames = true; tile.element.classList.add('has-frames'); }
    });
  };
  const requestPaint = () => {
    if (paintRequest === null && !document.hidden) paintRequest = requestAnimationFrame(draw);
  };
  const newFrame = () => { renderer.invalidate(); requestPaint(); };
  const measure = () => {
    const bounds = grid.getBoundingClientRect();
    renderer.resize(bounds.width, bounds.height);
    tiles.forEach((tile) => {
      tile.bounds = tile.stage.getBoundingClientRect();
      const { left, top, width, height } = tile.bounds;
      tile.viewport = [left - bounds.left, top - bounds.top, width, height];
      tile.radius = Math.max(65, Math.min(145, width * .23));
      tile.lens.style.width = tile.lens.style.height = `${2 * tile.radius}px`;
    });
    requestPaint();
  };
  const scheduleFrame = () => {
    if (frameRequest !== null || source.paused || document.hidden || !visible) return;
    const tick = () => {
      frameRequest = null;
      if (nativeFrames || source.currentTime !== lastTime) {
        lastTime = source.currentTime;
        newFrame();
      }
      scheduleFrame();
    };
    frameRequest = nativeFrames ? source.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  };
  const cancelFrame = () => {
    if (frameRequest === null) return;
    if (nativeFrames) source.cancelVideoFrameCallback(frameRequest);
    else cancelAnimationFrame(frameRequest);
    frameRequest = null;
  };
  const load = async () => {
    if (loaded) return;
    loaded = true;
    const manifest = await playback;
    const optimized = manifest?.grid.original_source === source.dataset.src ? manifest.grid : null;
    source.preload = 'auto';
    source.src = window.matchMedia('(max-width: 767px)').matches ? source.dataset.mobileSrc : optimized?.desktop || source.dataset.src;
    if (optimized?.alpha_layout) source.dataset.alphaLayout = optimized.alpha_layout;
    source.load();
  };
  const syncPlayback = () => {
    if (!visible || document.hidden) {
      source.pause();
      cancelFrame();
      if (paintRequest !== null) { cancelAnimationFrame(paintRequest); paintRequest = null; }
    } else {
      load();
      if (ready) source.play().catch(() => {
        status.textContent = 'Demonstration posters are shown. Video playback is unavailable.';
      });
    }
  };
  source.addEventListener('loadeddata', () => {
    ready = true;
    status.textContent = 'Four synchronized CORL demonstrations ready.';
    newFrame();
    syncPlayback();
  });
  source.addEventListener('play', scheduleFrame);
  source.addEventListener('pause', cancelFrame);
  source.addEventListener('seeked', newFrame);
  source.addEventListener('error', () => {
    status.textContent = 'Demonstration posters are shown. The footage could not load.';
  });
  document.addEventListener('visibilitychange', syncPlayback);

  controls.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.corlView;
    controls.forEach((control) => {
      const active = control === button;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
    });
    grid.classList.toggle('is-simulation', mode === 'simulation');
    if (hint) hint.textContent = mode === 'simulation' ? 'Hover to see the real footage' : 'Hover to see the simulation';
    tiles.forEach((tile) => {
      const simulation = mode === 'simulation';
      tile.poster.src = simulation ? tile.poster.dataset.simulationPoster : tile.poster.dataset.realPoster;
      tile.poster.alt = `${simulation ? 'The simulated' : 'The real'} table after forming the letter ${tile.element.dataset.corlTile}`;
      updateLabel(tile);
    });
    requestPaint();
  }));
  tiles.forEach((tile) => {
    const positionLens = (event) => {
      if (event.pointerType === 'touch') return;
      if (!tile.bounds || !tile.element.classList.contains('is-hovering')) measure();
      tile.pointer = [event.clientX - tile.bounds.left, event.clientY - tile.bounds.top];
      if (!tile.element.classList.contains('is-hovering')) {
        tile.element.classList.add('is-hovering');
        updateLabel(tile);
      }
      requestPaint();
    };
    tile.stage.addEventListener('pointerenter', positionLens);
    tile.stage.addEventListener('pointermove', positionLens, { passive: true });
    const leave = () => {
      tile.element.classList.remove('is-hovering');
      updateLabel(tile);
      requestPaint();
    };
    tile.stage.addEventListener('pointerleave', leave);
    tile.stage.addEventListener('pointercancel', leave);
    tile.stage.addEventListener('keydown', (event) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      tile.element.classList.add('is-key-revealing');
      updateLabel(tile);
      requestPaint();
    });
    const release = () => {
      tile.element.classList.remove('is-key-revealing');
      updateLabel(tile);
      requestPaint();
    };
    tile.stage.addEventListener('keyup', (event) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      release();
    });
    tile.stage.addEventListener('blur', release);
    window.addEventListener('blur', () => { leave(); release(); });
  });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    tiles.forEach((tile) => observer.observe(tile.stage));
  } else window.addEventListener('resize', measure);
  window.addEventListener('scroll', () => {
    if (tiles.some((tile) => tile.element.classList.contains('is-hovering'))) measure();
  }, { passive: true });
  measure();
  if ('IntersectionObserver' in window) {
    const preload = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        load();
        preload.disconnect();
      }
    }, { rootMargin: '400px' });
    preload.observe(grid);
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      syncPlayback();
    }).observe(grid);
  } else {
    visible = true;
    load();
  }
  if (source.readyState >= 2) {
    ready = true;
    newFrame();
    syncPlayback();
  }
});
