/* Lessons use recorded observations, recording timestamps, and an unchanged fitted-model replay. */
document.addEventListener('DOMContentLoaded', async () => {
  const section = document.getElementById('limitations');
  if (!section?.querySelector('[data-lesson-tab]')) return;
  const tabs = [...section.querySelectorAll('[data-lesson-tab]')];
  const panels = [...section.querySelectorAll('[data-lesson-panel]')];
  const videos = [...section.querySelectorAll('[data-lesson-video]')];
  const tracking = section.querySelector('[data-tracking-video]');
  const overlay = section.querySelector('[data-tracking-overlay]');
  const preview = section.querySelector('[data-shot-video]');
  const timeline = section.querySelector('[data-shot-timeline]');
  const status = section.querySelector('[data-lessons-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.lessonTab || tabs[0].dataset.lessonTab;
  let visible = !('IntersectionObserver' in window);
  let frame = 0;
  let manifest;

  const syncPanels = () => panels.forEach((panel) => {
    const inactive = panel.dataset.lessonPanel !== selected;
    panel.hidden = inactive;
    panel.inert = inactive;
    panel.setAttribute('aria-hidden', String(inactive));
  });
  syncPanels();

  const activeVideos = () => videos.filter((video) => video.closest('[data-lesson-panel]').dataset.lessonPanel === selected);
  const shouldPlay = () => visible && !document.hidden && !reducedMotion.matches;
  const play = (video) => { video.play()?.catch(() => {}); };
  const position = (element, point) => {
    element.setAttribute('cx', point.x);
    element.setAttribute('cy', point.y);
  };
  const drawTracking = () => {
    if (!manifest) return;
    const data = manifest.tracking;
    const time = Math.min(tracking.currentTime, data.source_end_s - data.source_start_s);
    const samples = data.samples.filter((point) => point.t <= time);
    const last = samples.at(-1) || { x: data.initial[0], y: data.initial[1] };
    position(overlay.querySelector('[data-track-reference]'), { x: data.initial[0], y: data.initial[1] });
    position(overlay.querySelector('[data-track-estimate]'), last);
    const line = overlay.querySelector('[data-track-error]');
    ['x1', 'y1', 'x2', 'y2'].forEach((key, i) => line.setAttribute(key, [...data.initial, last.x, last.y][i]));
    const recent = samples.filter((point) => point.t >= time - .65);
    let path = '';
    recent.forEach((point, i) => {
      const connected = i && point.t - recent[i - 1].t <= .06;
      path += `${connected ? 'L' : 'M'}${point.x},${point.y} `;
    });
    overlay.querySelector('[data-track-trail]').setAttribute('d', path.trim());
  };
  const tick = () => {
    frame = 0;
    if (!shouldPlay()) return;
    const active = activeVideos();
    if (selected === 'effort') drawTracking();
    const leader = active[0];
    if (leader && !leader.paused) {
      active.slice(1).forEach((video) => {
        if (video.readyState >= 2 && Math.abs(video.currentTime - leader.currentTime) > .055) {
          video.currentTime = leader.currentTime;
        }
      });
      frame = requestAnimationFrame(tick);
    }
  };
  const updatePlayback = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    const active = activeVideos();
    if (shouldPlay() && active.length > 1) {
      active.slice(1).forEach((video) => {
        if (video.readyState >= 2 && Math.abs(video.currentTime - active[0].currentTime) > .055) {
          video.currentTime = active[0].currentTime;
        }
      });
    }
    videos.forEach((video) => {
      if (!active.includes(video) || !shouldPlay()) video.pause();
      else play(video);
    });
    drawTracking();
    if (shouldPlay() && !frame) frame = requestAnimationFrame(tick);
  };
  const selectLesson = (name, focus = false) => {
    selected = name;
    tabs.forEach((tab) => {
      const current = tab.dataset.lessonTab === name;
      tab.setAttribute('aria-selected', String(current));
      tab.tabIndex = current ? 0 : -1;
      if (current && focus) tab.focus();
    });
    syncPanels();
    updatePlayback();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectLesson(tab.dataset.lessonTab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectLesson(tabs[next].dataset.lessonTab, true);
      }
    });
  });
  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.controls = false;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.addEventListener('play', () => {
      if (!shouldPlay() || !activeVideos().includes(video)) { video.pause(); return; }
      if (!frame) frame = requestAnimationFrame(tick);
    });
    video.addEventListener('loadeddata', drawTracking);
    video.addEventListener('seeked', drawTracking);
    video.addEventListener('canplay', () => {
      if (shouldPlay() && activeVideos().includes(video)) updatePlayback();
    });
    video.addEventListener('waiting', () => {
      if (!activeVideos().includes(video)) return;
      activeVideos().forEach((other) => { if (other !== video) other.pause(); });
    });
    video.addEventListener('error', () => { status.textContent = 'An example could not load. Refresh to try again.'; });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      updatePlayback();
    }, { threshold: 0 }).observe(section);
  }
  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', updatePlayback);

  try {
    const response = await fetch('/media/lessons/manifest.json');
    if (!response.ok) throw new Error('Lessons data unavailable');
    manifest = await response.json();
    const shotButtons = [];
    const selectShot = (index, focus = false) => {
      const shot = manifest.shots[index];
      shotButtons.forEach((button, i) => {
        button.setAttribute('aria-pressed', String(i === index));
        button.tabIndex = i === index ? 0 : -1;
      });
      if (focus) shotButtons[index].focus();
      section.querySelector('[data-shot-title]').textContent = shot.title;
      const time = section.querySelector('[data-shot-time]');
      time.textContent = shot.time;
      time.setAttribute('datetime', `2026-10-24T${shot.time}:00`);
      section.querySelector('[data-shot-description]').textContent = shot.description;
      preview.pause();
      preview.poster = shot.poster;
      preview.src = shot.video;
      preview.load();
      updatePlayback();
    };
    manifest.shots.forEach((shot, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lesson-shot';
      button.style.left = `${shot.elapsed_s / manifest.elapsed_s * 100}%`;
      button.setAttribute('aria-label', `Shot ${shot.number}, ${shot.time}: ${shot.title}`);
      button.setAttribute('aria-controls', 'lesson-shot-detail');
      button.setAttribute('aria-pressed', String(i === 0));
      button.tabIndex = i === 0 ? 0 : -1;
      const number = document.createElement('span');
      number.className = 'lesson-shot-number';
      number.textContent = shot.number;
      button.append(number);
      button.addEventListener('click', () => selectShot(i));
      button.addEventListener('keydown', (event) => {
        let next;
        if (event.key === 'ArrowRight') next = (i + 1) % manifest.shots.length;
        if (event.key === 'ArrowLeft') next = (i + manifest.shots.length - 1) % manifest.shots.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = manifest.shots.length - 1;
        if (next !== undefined) { event.preventDefault(); selectShot(next, true); }
      });
      shotButtons.push(button);
      timeline.append(button);
    });
    drawTracking();
    overlay.removeAttribute('hidden');
    updatePlayback();
  } catch (error) {
    status.textContent = 'The experiment timeline could not load. Refresh to try again.';
    console.error(error);
  }
});
