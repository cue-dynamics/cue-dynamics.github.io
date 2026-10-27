/* Each calibration stage splits one decoded real/simulation/alpha video frame. */
document.addEventListener('DOMContentLoaded', () => {
  const loop = document.getElementById('calibration-loop');
  const data = document.getElementById('calibration-reveal-data');
  if (!loop || !data) return;
  let manifest;
  try { manifest = JSON.parse(data.textContent); } catch (_) { return; }
  if (!Array.isArray(manifest.stages)) return;
  const status = loop.querySelector('[data-loop-status]');
  let visible = !('IntersectionObserver' in window);
  let active = Number(loop.querySelector('[data-loop-panel]:not([hidden])')?.dataset.loopPanel || 0);
  const players = [];

  manifest.stages.forEach((record) => {
    const panel = loop.querySelector('[data-loop-panel="' + record.panel + '"]');
    const source = panel?.querySelector('[data-calibration-source]');
    if (!panel || !source) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'lab-calibration-composite';
    canvas.setAttribute('aria-hidden', 'true');
    const renderer = window.createVideoRevealRenderer?.(source, canvas);
    if (!renderer || canvas.dataset.videoRenderer === 'canvas2d') return;
    panel.prepend(canvas);
    let ready = false, loaded = false, available = true;
    let frameRequest = null, paintRequest = null, lastTime = -1;
    let viewport = [0, 0, 1, 1];
    const expectedURL = new URL(record.video, window.location.href).href;
    const nativeFrames = 'requestVideoFrameCallback' in source;
    const shown = () => available && visible && active === record.panel && !document.hidden;
    source.muted = source.defaultMuted = true;
    source.loop = source.playsInline = true;
    source.controls = false;
    source.disablePictureInPicture = true;

    const draw = () => {
      paintRequest = null;
      if (!shown() || !ready || source.readyState < 2) return;
      const scale = source.videoWidth / record.width;
      const value = parseFloat(panel.style.getPropertyValue('--reveal-position'));
      const split = Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : .5;
      const scene = {
        viewport,
        real: record.real_region.map((v) => v * scale),
        simulation: record.model_region.map((v) => v * scale),
        mask: record.alpha_region.map((v) => v * scale),
        splitPosition: split,
        simulationBase: false, revealing: false, full: false, pointer: [0, 0], radius: 0,
      };
      panel.classList.toggle('has-calibration-frames', renderer.render([scene]));
    };
    const requestPaint = () => {
      if (paintRequest === null && shown()) paintRequest = requestAnimationFrame(draw);
    };
    const measure = () => {
      const bounds = panel.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      renderer.resize(bounds.width, bounds.height);
      viewport = [0, 0, bounds.width, bounds.height];
      requestPaint();
    };
    const cancelFrames = () => {
      if (frameRequest !== null) {
        if (nativeFrames) source.cancelVideoFrameCallback(frameRequest);
        else cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
      if (paintRequest !== null) { cancelAnimationFrame(paintRequest); paintRequest = null; }
    };
    const schedule = () => {
      if (frameRequest !== null || !shown() || !ready || source.paused) return;
      const tick = () => {
        frameRequest = null;
        if (!shown() || source.paused) return;
        if (nativeFrames || source.currentTime !== lastTime) {
          lastTime = source.currentTime;
          renderer.invalidate();
          requestPaint();
        }
        schedule();
      };
      frameRequest = nativeFrames ? source.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    };
    const pause = () => { source.pause(); cancelFrames(); };
    const sync = () => {
      if (!shown()) { pause(); return; }
      if (!loaded) {
        loaded = true;
        source.preload = 'auto';
        source.src = expectedURL;
        source.load();
      }
      measure();
      if (!ready) return;
      if (source.paused) {
        source.play().then(() => {
          if (shown()) schedule();
          else pause();
        }).catch(() => {
          panel.classList.remove('has-calibration-frames');
          if (status) status.textContent = 'Comparison stills are shown. Automatic playback is unavailable.';
        });
      } else schedule();
      requestPaint();
    };
    source.addEventListener('loadeddata', () => {
      if (source.currentSrc !== expectedURL || source.readyState < 2) return;
      ready = true;
      renderer.invalidate();
      sync();
    });
    source.addEventListener('play', schedule);
    source.addEventListener('pause', cancelFrames);
    source.addEventListener('seeked', () => { renderer.invalidate(); requestPaint(); });
    source.addEventListener('error', () => {
      ready = false;
      pause();
      panel.classList.remove('has-calibration-frames');
      if (status) status.textContent = 'Comparison stills are shown. The video could not load.';
    });
    canvas.addEventListener('webglcontextlost', () => {
      available = false;
      ready = false;
      pause();
      panel.classList.remove('has-calibration-frames');
    });
    panel.addEventListener('study:reveal', requestPaint);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(panel);
    else window.addEventListener('resize', measure);
    players.push({ sync });
  });

  const sync = () => players.forEach((player) => player.sync());
  loop.addEventListener('study:stage', (event) => {
    active = Number(event.detail.index);
    sync();
  });
  loop.addEventListener('study:visibility', (event) => {
    if (typeof event.detail?.visible === 'boolean') visible = event.detail.visible;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  sync();
});
