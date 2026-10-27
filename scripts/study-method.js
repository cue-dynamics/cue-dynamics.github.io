/* Follow one recorded experiment from scene reconstruction through model fitting. */
document.addEventListener('DOMContentLoaded', () => {
  const loop = document.getElementById('calibration-loop');
  if (!loop) return;
  const press = (buttons, active) => buttons.forEach((button) => {
    const selected = button === active;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const visible = new Map();

  const buttons = [...loop.querySelectorAll('[data-loop-step]')];
  const panels = [...loop.querySelectorAll('[data-loop-panel]')];
  const caption = loop.querySelector('.lab-method-caption');
  const summary = loop.querySelector('[data-loop-summary]');
  const error = loop.querySelector('[data-loop-error]');
  const value = loop.querySelector('[data-loop-error-value]');
  const label = loop.querySelector('[data-loop-error-label]');
  const status = loop.querySelector('[data-loop-status]');
  const records = JSON.parse(document.getElementById('decision-details').textContent);
  const choice = loop.querySelector('.lab-choice-candidates');
  const candidates = [...choice.querySelectorAll('[data-candidate]')];
  const drawings = [...loop.querySelectorAll('[data-candidate-visual]')];
  const chosen = records.findIndex((record) => record.id === 'chosen');
  let selectedCandidate = chosen;
  const showCandidate = (index) => {
    const record = records[index];
    loop.querySelector('[data-agent-decision]').textContent = record.title + ': ' + record.description;
    drawings.forEach((drawing) => { drawing.hidden = Number(drawing.dataset.candidateVisual) !== index; });
    candidates.forEach((button) => button.classList.toggle('is-preview', Number(button.dataset.candidate) === index));
    loop.querySelector('#decision-map-title').textContent = 'Simulated outcomes: ' + record.title;
  };
  const stages = [
    { summary: 'Recreate the real table and measured ball positions in simulation.', agent: 'Build the digital scene from the camera view and measured ball positions.' },
    { summary: '', agent: 'Compare predictions from candidate models.' },
    { summary: '', agent: 'Strike the yellow ball at 0.35 m/s and track its motion.' },
    { summary: '', agent: 'Compare the recorded motion with the initial model. Endpoint error: 99.3 mm.' },
    { summary: '', agent: 'Fit the physics to the recorded motion. Endpoint error: 2.3 mm on this shot.' },
  ];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const progress = buttons.map((button) => button.querySelector('[data-loop-progress]'));
  const holds = new Set();
  let current = -1;
  let clock = null;
  const syncClock = () => {
    const running = !reducedMotion.matches && !holds.size && visible.get(loop) && !document.hidden;
    if (clock) {
      if (running && clock.playState !== 'running') clock.play();
      else if (!running && clock.playState !== 'paused') clock.pause();
    }
  };
  const hold = (key, paused) => {
    if (paused) holds.add(key);
    else holds.delete(key);
    syncClock();
  };
  const restartClock = () => {
    clock?.cancel();
    progress.forEach((bar, index) => {
      bar.style.transform = index < current ? 'scaleX(1)' : 'scaleX(0)';
      buttons[index].classList.toggle('is-complete', index < current);
    });
    const animation = progress[current].animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: 8000, easing: 'linear', fill: 'forwards' },
    );
    clock = animation;
    animation.onfinish = () => {
      if (clock === animation && !reducedMotion.matches && !holds.size && visible.get(loop) && !document.hidden) show((current + 1) % stages.length);
    };
    syncClock();
  };
  const show = (index, userAction = false) => {
    const changed = current !== index;
    current = index;
    if (changed) {
      if (index !== 1) {
        holds.delete('candidate-focus');
        holds.delete('candidate-pointer');
      }
      loop.querySelectorAll('[data-reconstruction]').forEach((panel) => {
        if (Number(panel.dataset.loopPanel) !== index) {
          holds.delete(panel);
          holds.delete(panel.querySelector('[data-reconstruction-handle]'));
        }
      });
    }
    press(buttons, buttons[index]);
    drawFlow();
    panels.forEach((panel, position) => { panel.hidden = position !== index; });
    summary.textContent = stages[index].summary;
    loop.querySelector('[data-agent-stage]').textContent = buttons[index].getAttribute('aria-label');
    loop.querySelector('[data-agent-calibration]').textContent = stages[index].agent;
    loop.querySelector('[data-agent-candidate]').hidden = index !== 1;
    loop.querySelector('[data-agent-choice]').hidden = index !== 1;
    loop.querySelector('[data-agent-fit-note]').hidden = index < 3;
    if (index === 1 && changed) {
      selectedCandidate = chosen;
      press(candidates, candidates.find((button) => Number(button.dataset.candidate) === chosen));
      showCandidate(chosen);
    }
    caption.hidden = !stages[index].summary && !stages[index].error;
    error.hidden = !stages[index].error;
    value.textContent = stages[index].error || '';
    label.textContent = stages[index].label || '';
    loop.dispatchEvent(new CustomEvent('study:stage', { detail: { index } }));
    if (changed || !clock) restartClock();
    else syncClock();
    const viewport = loop.querySelector('.lab-loop-flow-viewport');
    if (viewport.scrollWidth > viewport.clientWidth) {
      const active = buttons[index];
      viewport.scrollTo({ left: active.offsetLeft + active.offsetWidth / 2 - viewport.clientWidth / 2, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
    if (userAction) status.textContent = buttons[index].getAttribute('aria-label') + ' selected.';
  };
  buttons.forEach((button, index) => button.addEventListener('click', () => show(index, true)));
  candidates.forEach((button) => {
    const index = Number(button.dataset.candidate);
    button.addEventListener('pointerenter', () => showCandidate(index));
    button.addEventListener('focus', () => {
      if (button.matches(':focus-visible')) hold('candidate-focus', true);
      showCandidate(index);
    });
    button.addEventListener('click', () => {
      selectedCandidate = index;
      press(candidates, button);
      showCandidate(index);
      restartClock();
      status.textContent = 'Inspecting ' + records[index].title.toLowerCase() + '. Recorded choice: yellow ball, 0.35 m/s.';
    });
  });
  choice.addEventListener('pointerleave', () => showCandidate(selectedCandidate));
  choice.addEventListener('focusout', (event) => {
    if (!choice.contains(event.relatedTarget)) {
      hold('candidate-focus', false);
      showCandidate(selectedCandidate);
    }
  });

  loop.querySelectorAll('[data-reconstruction]').forEach((reconstruction) => {
    const handle = reconstruction.querySelector('[data-reconstruction-handle]');
    if (!handle) return;
    const stageIndex = Number(reconstruction.dataset.loopPanel);
    const realLabel = reconstruction.dataset.realLabel || 'real scene';
    const simulationLabel = reconstruction.dataset.simulationLabel || 'digital twin';
    let reveal = 50;
    let pointer = null;
    const setReveal = (position) => {
      reveal = Math.max(0, Math.min(100, position));
      reconstruction.style.setProperty('--reveal-position', `${reveal}%`);
      const real = Math.round(reveal);
      handle.setAttribute('aria-valuenow', String(real));
      handle.setAttribute('aria-valuetext', `${real}% ${realLabel}, ${100 - real}% ${simulationLabel}`);
      reconstruction.dispatchEvent(new Event('study:reveal'));
    };
    const moveReveal = (event) => {
      const bounds = reconstruction.getBoundingClientRect();
      if (bounds.width > 0) setReveal((event.clientX - bounds.left) / bounds.width * 100);
    };
    reconstruction.addEventListener('pointerdown', (event) => {
      if (event.isPrimary === false || event.button !== 0 || pointer !== null) return;
      hold(reconstruction, true);
      show(stageIndex, true);
      pointer = event.pointerId;
      handle.focus({ preventScroll: true });
      reconstruction.setPointerCapture(pointer);
      reconstruction.classList.add('is-dragging');
      moveReveal(event);
      if (event.pointerType === 'mouse') event.preventDefault();
    });
    reconstruction.addEventListener('pointermove', (event) => {
      if (event.pointerId === pointer) moveReveal(event);
    }, { passive: true });
    const finishDrag = (event) => {
      if (event.pointerId !== pointer) return;
      const captured = pointer;
      pointer = null;
      hold(reconstruction, false);
      reconstruction.classList.remove('is-dragging');
      if (reconstruction.hasPointerCapture(captured)) reconstruction.releasePointerCapture(captured);
    };
    reconstruction.addEventListener('pointerup', (event) => {
      if (event.pointerId === pointer) moveReveal(event);
      finishDrag(event);
    });
    reconstruction.addEventListener('pointercancel', finishDrag);
    reconstruction.addEventListener('lostpointercapture', finishDrag);
    handle.addEventListener('focus', () => {
      if (handle.matches(':focus-visible')) hold(handle, true);
      show(stageIndex, true);
    });
    handle.addEventListener('blur', () => hold(handle, false));
    handle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 10 : 1;
      const positions = { ArrowLeft: reveal - step, ArrowDown: reveal - step, ArrowRight: reveal + step, ArrowUp: reveal + step, PageDown: reveal - 10, PageUp: reveal + 10, Home: 0, End: 100 };
      if (!(event.key in positions)) return;
      event.preventDefault();
      hold(handle, true);
      show(stageIndex, true);
      setReveal(positions[event.key]);
    });
    setReveal(50);
  });

  choice.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') hold('candidate-pointer', true);
  });
  choice.addEventListener('pointerleave', () => hold('candidate-pointer', false));
  const navigation = loop.querySelector('.lab-step-list');
  navigation.addEventListener('focusin', (event) => {
    if (event.target.matches(':focus-visible')) hold('navigation-focus', true);
  });
  navigation.addEventListener('focusout', (event) => {
    if (!navigation.contains(event.relatedTarget)) hold('navigation-focus', false);
  });
  navigation.addEventListener('pointerdown', () => hold('navigation-focus', false));
  loop.addEventListener('study:visibility', syncClock);
  reducedMotion.addEventListener('change', syncClock);
  const flow = loop.querySelector('.lab-loop-flow');
  const track = flow.querySelector('.lab-flow-track');
  const drawFlow = () => {
    const bounds = flow.getBoundingClientRect();
    if (!bounds.width) return;
    const nodes = buttons.map((button) => {
      const node = button.querySelector('.lab-flow-node').getBoundingClientRect();
      return { x: node.left + node.width / 2 - bounds.left, y: node.top + node.height / 2 - bounds.top, bottom: node.bottom - bounds.top, radius: node.width / 2 };
    });
    track.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    track.querySelectorAll('[data-loop-connection]').forEach((path, index) => {
      const from = nodes[index], to = nodes[index + 1];
      const gap = Math.min(6, Math.max(0, (to.x - to.radius - from.x - from.radius) / 4));
      path.setAttribute('d', `M${from.x + from.radius + gap} ${from.y}H${to.x - to.radius - gap}`);
    });
    const first = nodes[0], last = nodes[nodes.length - 1];
    const bottom = bounds.height - 12;
    const radius = 8;
    // Return beneath the row with a straight approach to the first node.
    track.querySelector('[data-loop-return-path]').setAttribute('d',
      `M${last.x} ${last.bottom + 6}V${bottom - radius}Q${last.x} ${bottom} ${last.x - radius} ${bottom}H${first.x + radius}Q${first.x} ${bottom} ${first.x} ${bottom - radius}V${first.bottom + 8}`);
  };
  if ('ResizeObserver' in window) new ResizeObserver(drawFlow).observe(flow);
  else window.addEventListener('resize', drawFlow);
  document.fonts?.ready.then(drawFlow);
  show(0);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      visible.set(entry.target, entry.isIntersecting);
      entry.target.dispatchEvent(new CustomEvent('study:visibility', { detail: { visible: entry.isIntersecting } }));
    }), { threshold: .12 });
    observer.observe(loop);
  } else {
    visible.set(loop, true);
    loop.dispatchEvent(new CustomEvent('study:visibility', { detail: { visible: true } }));
  }
  document.addEventListener('visibilitychange', () => {
    loop.dispatchEvent(new CustomEvent('study:visibility', { detail: { visible: visible.get(loop) } }));
  });
});
