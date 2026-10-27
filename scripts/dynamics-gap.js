/* Recorded shots compared with the model available before each shot. */
document.addEventListener('DOMContentLoaded', () => {
  const group = document.querySelector('[data-gap-comparison]');
  if (!group) return;
  const buttons = [...document.querySelectorAll('[data-gap-example]')];
  const real = group.querySelector('[data-gap-real] video');
  const model = group.querySelector('[data-gap-sim] video');
  const caption = document.querySelector('[data-gap-caption]');
  const status = document.querySelector('[data-gap-status]');
  let selection = 0;
  let current = buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.gapExample;
  const examples = fetch('/media/dynamics-gap/examples.json').then((response) => {
    if (!response.ok) throw new Error('Examples unavailable');
    return response.json();
  }).catch(() => null);

  buttons.forEach((button) => button.addEventListener('click', async () => {
    const version = ++selection;
    const data = await examples;
    if (version !== selection) return;
    const name = button.dataset.gapExample;
    const example = data?.[name];
    if (!example) {
      status.textContent = 'Could not load this example. Please try reloading the page.';
      return;
    }
    if (current === name) return;
    current = name;
    buttons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    group.dispatchEvent(new CustomEvent('media:reset'));
    [[real, example.real, 'Real'], [model, example.model, 'Simulation without CUE']].forEach(([video, source, label]) => {
      video.poster = source.poster;
      video.src = source.video;
      video.setAttribute('aria-label', `${label}: ${name.toLowerCase()} example`);
      video.load();
    });
    caption.textContent = example.caption;
    status.textContent = `${name} comparison selected.`;
  }));
});
