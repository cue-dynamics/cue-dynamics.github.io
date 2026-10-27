/* Recorded shots compared with the model available before each shot. */
document.addEventListener('DOMContentLoaded', () => {
  const group = document.querySelector('[data-gap-comparison]');
  if (!group) return;
  const buttons = [...document.querySelectorAll('[data-gap-example]')];
  const real = group.querySelector('[data-gap-real] video');
  const model = group.querySelector('[data-gap-sim] video');
  const status = document.querySelector('[data-gap-status]');
  const compact = window.matchMedia('(max-width: 767px)').matches;
  let cachedExamples;
  let selection = 0;
  let current = buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.gapExample;
  const examples = fetch('/media/dynamics-gap/examples.json').then((response) => {
    if (!response.ok) throw new Error('Examples unavailable');
    return response.json();
  }).then((data) => {
    cachedExamples = data;
    return data;
  }).catch(() => null);

  buttons.forEach((button) => button.addEventListener('click', () => {
    const version = ++selection;
    const name = button.dataset.gapExample;
    if (current === name) {
      // An explicit tap can resume Safari playback without changing the shot.
      group.dispatchEvent(new Event('media:play'));
      return;
    }
    const select = (data) => {
      if (version !== selection) return;
      const example = data?.[name];
      if (!example) {
        status.textContent = 'Could not load this example. Please try reloading the page.';
        return;
      }
      current = name;
      buttons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      group.dispatchEvent(new CustomEvent('media:reset'));
      [[real, example.real, 'Real'], [model, example.model, 'Simulation without CUE']].forEach(([video, source, label]) => {
        video.poster = source.poster;
        video.src = compact && source.mobileVideo ? source.mobileVideo : source.video;
        video.setAttribute('aria-label', `${label}: ${name.toLowerCase()} example`);
        video.load();
      });
      group.dispatchEvent(new Event('media:play'));
      status.textContent = `${name} comparison selected.`;
    };
    if (cachedExamples) select(cachedExamples);
    else {
      group.dispatchEvent(new Event('media:play'));
      examples.then(select);
    }
  }));
});
