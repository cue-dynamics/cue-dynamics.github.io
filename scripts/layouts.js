/* Layout-preview controls. They select placeholder states, never fabricated results. */
document.addEventListener('DOMContentLoaded', () => {
  const all = (selector) => [...document.querySelectorAll(selector)];
  const activate = (buttons, selected) => {
    buttons.forEach((button) => {
      const active = button === selected;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  const text = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  const demo = document.querySelector('[data-demo-window]');
  const demoViews = all('[data-demo-view]');
  if (demo) {
    demo.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const bounds = demo.getBoundingClientRect();
      demo.style.setProperty('--lens-x', `${event.clientX - bounds.left}px`);
      demo.style.setProperty('--lens-y', `${event.clientY - bounds.top}px`);
      demo.classList.add('is-revealing');
    }, { passive: true });
    demo.addEventListener('pointerleave', () => demo.classList.remove('is-revealing'));
    demoViews.forEach((button) => button.addEventListener('click', () => {
      activate(demoViews, button);
      const simulation = button.dataset.demoView === 'simulation';
      demo.classList.toggle('is-simulation', simulation);
      demo.querySelector('.lab-demo-real').setAttribute('aria-hidden', String(simulation));
      demo.querySelector('[data-demo-simulation]').setAttribute('aria-hidden', String(!simulation));
    }));
  }
  const shots = all('[data-session-shot]');
  shots.forEach((button) => button.addEventListener('click', () => {
    activate(shots, button);
    demo?.setAttribute('aria-label', `Shot ${button.dataset.sessionShot.padStart(2, '0')}: real and simulated views`);
  }));

  const copyCitation = document.querySelector('[data-copy-citation]');
  const citation = document.getElementById('paper-citation');
  const copyStatus = document.querySelector('[data-copy-status]');
  if (copyCitation && citation && copyStatus) {
    const originalLabel = copyCitation.innerHTML;
    let resetCopyLabel;
    copyCitation.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(citation.textContent.trim());
        copyCitation.textContent = 'Copied';
        copyStatus.textContent = 'BibTeX placeholder copied';
        clearTimeout(resetCopyLabel);
        resetCopyLabel = setTimeout(() => { copyCitation.innerHTML = originalLabel; }, 2000);
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(citation);
        selection?.removeAllRanges();
        selection?.addRange(range);
        copyStatus.textContent = 'Citation selected. Use your keyboard copy shortcut to copy it.';
      }
    });
  }

  // Native anchor scrolling honors the margin that clears the sticky navigation.
  all('a[href="#project-video"]').forEach((link) => {
    link.addEventListener('click', (event) => event.stopPropagation());
  });

  const links = all('[data-section-link]');
  const sections = all('.lab-section');
  const index = document.querySelector('.lab-index');
  if (links.length && sections.length) {
    let activeId = null;
    const updateActiveSection = () => {
      const scroller = document.scrollingElement || document.documentElement;
      const viewportHeight = scroller.clientHeight || window.innerHeight;
      const atBottom = scroller.scrollHeight > viewportHeight
        && scroller.scrollTop + viewportHeight >= scroller.scrollHeight - 2;
      const readingLine = (index?.offsetHeight || 64) + 24;
      // At the bottom, the last section wins even when earlier sections still fit onscreen.
      const active = atBottom ? sections.at(-1)
        : sections.findLast((section) => section.getBoundingClientRect().top <= readingLine);
      if (active?.id === activeId) return;
      activeId = active?.id;
      links.forEach((link) => {
        const current = Boolean(active && link.dataset.sectionLink === active.id);
        link.classList.toggle('is-active', current);
        if (current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    let framePending = false;
    const scheduleUpdate = () => {
      if (framePending) return;
      framePending = true;
      requestAnimationFrame(() => {
        framePending = false;
        updateActiveSection();
      });
    };
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    if ('ResizeObserver' in window) new ResizeObserver(scheduleUpdate).observe(document.body);
    updateActiveSection();
  }
});
