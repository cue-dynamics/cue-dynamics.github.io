/* The yellow-ball probe, shown as a calibration cycle and a recorded decision. */
document.addEventListener('DOMContentLoaded', () => {
  const loop = document.getElementById('calibration-loop');
  const selection = document.getElementById('shot-selection');
  const press = (buttons, active) => buttons.forEach((button) => {
    const selected = button === active;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const play = (video) => {
    if (!video || video.error) return;
    video.muted = true;
    video.play().catch(() => {});
  };
  const visible = new Map();
  const syncVideos = (section) => {
    section.querySelectorAll('[data-method-video]').forEach((video) => {
      const shown = visible.get(section) && !document.hidden && !video.closest('[hidden]');
      if (shown) play(video);
      else video.pause();
    });
  };

  if (loop) {
    const buttons = [...loop.querySelectorAll('[data-loop-step]')];
    const panels = [...loop.querySelectorAll('[data-loop-panel]')];
    const caption = loop.querySelector('.lab-method-caption');
    const summary = loop.querySelector('[data-loop-summary]');
    const error = loop.querySelector('[data-loop-error]');
    const value = loop.querySelector('[data-loop-error-value]');
    const label = loop.querySelector('[data-loop-error-label]');
    const status = loop.querySelector('[data-loop-status]');
    const stages = [
      { summary: "Recreate the real table and measured ball positions in simulation." },
      { summary: "Take the selected shot and record the ball’s motion." },
      { summary: "Measure where the prediction departs from the observed path.", error: '99.3 mm', label: 'Earlier-model endpoint error' },
      { summary: '' },
    ];
    let current = 0;
    let pinned = false;
    let timer;
    let hovering = false;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const schedule = () => {
      clearTimeout(timer);
      if (pinned || hovering || reducedMotion.matches || !visible.get(loop) || document.hidden) return;
      timer = setTimeout(() => show((current + 1) % stages.length), current === 0 ? 4000 : 7200);
    };
    const show = (index, userAction = false) => {
      current = index;
      if (userAction) pinned = true;
      press(buttons, buttons[index]);
      panels.forEach((panel, position) => { panel.hidden = position !== index; });
      summary.textContent = stages[index].summary;
      caption.hidden = !stages[index].summary && !stages[index].error;
      error.hidden = !stages[index].error;
      value.textContent = stages[index].error || '';
      label.textContent = stages[index].label || '';
      syncVideos(loop);
      schedule();
      if (userAction) status.textContent = buttons[index].textContent.trim().replace(/\s+/g, ' ') + ' selected.';
    };
    buttons.forEach((button, index) => button.addEventListener('click', () => show(index, true)));

    const reconstruction = loop.querySelector('[data-reconstruction]');
    const handle = reconstruction?.querySelector('[data-reconstruction-handle]');
    if (handle) {
      let reveal = 50;
      let pointer = null;
      const setReveal = (position) => {
        reveal = Math.max(0, Math.min(100, position));
        reconstruction.style.setProperty('--reveal-position', `${reveal}%`);
        const real = Math.round(reveal);
        handle.setAttribute('aria-valuenow', String(real));
        handle.setAttribute('aria-valuetext', `${real}% real scene, ${100 - real}% digital twin`);
      };
      const moveReveal = (event) => {
        const bounds = reconstruction.getBoundingClientRect();
        if (bounds.width > 0) setReveal((event.clientX - bounds.left) / bounds.width * 100);
      };
      reconstruction.addEventListener('pointerdown', (event) => {
        if (event.isPrimary === false || event.button !== 0 || pointer !== null) return;
        show(0, true);
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
        reconstruction.classList.remove('is-dragging');
        if (reconstruction.hasPointerCapture(captured)) reconstruction.releasePointerCapture(captured);
      };
      reconstruction.addEventListener('pointerup', (event) => {
        if (event.pointerId === pointer) moveReveal(event);
        finishDrag(event);
      });
      reconstruction.addEventListener('pointercancel', finishDrag);
      reconstruction.addEventListener('lostpointercapture', finishDrag);
      handle.addEventListener('focus', () => show(0, true));
      handle.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 10 : 1;
        const positions = { ArrowLeft: reveal - step, ArrowDown: reveal - step, ArrowRight: reveal + step, ArrowUp: reveal + step, PageDown: reveal - 10, PageUp: reveal + 10, Home: 0, End: 100 };
        if (!(event.key in positions)) return;
        event.preventDefault();
        show(0, true);
        setReveal(positions[event.key]);
      });
      setReveal(50);
    }

    const controls = loop.querySelector('.lab-step-list');
    controls.addEventListener('pointerenter', () => { hovering = true; schedule(); });
    controls.addEventListener('pointerleave', () => { hovering = false; schedule(); });
    controls.addEventListener('focusin', () => { hovering = true; schedule(); });
    controls.addEventListener('focusout', (event) => {
      if (!controls.contains(event.relatedTarget)) { hovering = false; schedule(); }
    });
    loop.addEventListener('study:visibility', () => { syncVideos(loop); schedule(); });
    reducedMotion.addEventListener('change', schedule);
  }

  if (selection) {
    const records = JSON.parse(document.getElementById('decision-details').textContent);
    const buttons = [...selection.querySelectorAll('[data-candidate]')];
    const drawings = [...selection.querySelectorAll('[data-candidate-visual]')];
    const modes = [...selection.querySelectorAll('[data-decision-mode]')];
    const map = selection.querySelector('[data-decision-map]');
    const executed = selection.querySelector('[data-decision-executed]');
    const legend = selection.querySelector('[data-decision-legend]');
    const chosen = records.findIndex((record) => record.id === 'chosen');
    let selected = chosen;
    let mode = 'predicted';
    const setMode = (next) => {
      mode = next;
      map.hidden = mode !== 'predicted';
      executed.hidden = mode !== 'executed';
      legend.style.visibility = mode === 'predicted' ? '' : 'hidden';
      press(modes, modes.find((button) => button.dataset.decisionMode === mode));
      syncVideos(selection);
    };
    const show = (index) => {
      const record = records[index];
      drawings.forEach((drawing) => drawing.toggleAttribute('hidden', Number(drawing.dataset.candidateVisual) !== index));
      buttons.forEach((button) => button.classList.toggle('is-preview', Number(button.dataset.candidate) === index));
      selection.querySelector('#decision-map-title').textContent = 'Simulated outcomes: ' + record.title;
      if (index !== chosen && mode === 'executed') setMode('predicted');
    };
    buttons.forEach((button) => {
      const index = Number(button.dataset.candidate);
      button.addEventListener('pointerenter', () => show(index));
      button.addEventListener('focus', () => show(index));
      button.addEventListener('click', () => {
        selected = index;
        press(buttons, button);
        show(index);
        selection.querySelector('[data-decision-status]').textContent = records[index].title + ' selected.';
      });
    });
    const list = selection.querySelector('.lab-candidate-list');
    list.addEventListener('pointerleave', () => show(selected));
    list.addEventListener('focusout', (event) => {
      if (!list.contains(event.relatedTarget)) show(selected);
    });
    modes.forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.decisionMode === 'executed') {
        selected = chosen;
        press(buttons, buttons.find((button) => Number(button.dataset.candidate) === chosen));
        show(chosen);
      }
      setMode(button.dataset.decisionMode);
    }));
    selection.addEventListener('study:visibility', () => syncVideos(selection));
    show(chosen);
  }

  [loop, selection].filter(Boolean).forEach((section) => {
    section.querySelectorAll('[data-method-video]').forEach((video) => {
      video.addEventListener('loadeddata', () => syncVideos(section));
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      visible.set(entry.target, entry.isIntersecting);
      entry.target.dispatchEvent(new Event('study:visibility'));
    }), { threshold: .12 });
    [loop, selection].filter(Boolean).forEach((section) => observer.observe(section));
  } else {
    [loop, selection].filter(Boolean).forEach((section) => {
      visible.set(section, true);
      section.dispatchEvent(new Event('study:visibility'));
    });
  }
  document.addEventListener('visibilitychange', () => {
    [loop, selection].filter(Boolean).forEach((section) => section.dispatchEvent(new Event('study:visibility')));
  });
});
