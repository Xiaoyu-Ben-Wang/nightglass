// The settings panel's form: mirrors the settings into its fields and saves each change.
import { $ } from './dom.js';
import { geocode, useMyLocation } from './location.js';
import { onSettings, settings, updateSettings, type Settings, type Spin } from './settings.js';

export function initSettingsForm(): void {
  const form = $<HTMLFormElement>('settings-form');
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const status = $('place-status');

  onSettings((s) => {
    // Don't overwrite a field while it's being typed in.
    if (document.activeElement !== field('name')) field('name').value = s.name;
    if (document.activeElement !== field('place')) field('place').value = s.place?.name ?? '';
    if (document.activeElement !== field('quoteApi')) field('quoteApi').value = s.quoteApi;
    field('hour24').checked = s.hour24;
    field('fahrenheit').checked = s.fahrenheit;
    field('spin').value = s.spin;
    field('daylight').checked = s.daylight;
    field('weatherFx').checked = s.weatherFx;
    for (const k of Object.keys(s.show) as (keyof Settings['show'])[]) field(`show.${k}`).checked = s.show[k];
    for (const k of Object.keys(s.sky) as (keyof Settings['sky'])[]) field(`sky.${k}`).checked = s.sky[k];
  });

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const s = settings();
    if (input.name === 'quoteApi') {
      void updateSettings({ quoteApi: input.value.trim() });
    } else if (input.name === 'name') {
      const name = input.value.trim();
      if (name) void updateSettings({ name });
    } else if (input.name === 'hour24' || input.name === 'fahrenheit' || input.name === 'daylight' || input.name === 'weatherFx') {
      void updateSettings({ [input.name]: input.checked });
    } else if (input.name === 'spin') {
      void updateSettings({ spin: input.value as Spin });
    } else if (input.name.startsWith('show.')) {
      void updateSettings({ show: { ...s.show, [input.name.slice(5)]: input.checked } });
    } else if (input.name.startsWith('sky.')) {
      void updateSettings({ sky: { ...s.sky, [input.name.slice(4)]: input.checked } });
    }
  });

  const locate = $('place-locate');
  const setPlace = async () => {
    const query = field('place').value.trim();
    if (query && query === settings().place?.name) return;
    if (!query) {
      locate.click();
      return;
    }
    status.textContent = 'Looking up…';
    try {
      const place = await geocode(query);
      if (!place) {
        status.textContent = `No place called “${query}”`;
        return;
      }
      await updateSettings({ place });
      field('place').value = place.name;
      status.textContent = '';
    } catch {
      status.textContent = 'Lookup failed. Check your connection.';
    }
  };
  locate.addEventListener('click', async () => {
    status.textContent = 'Locating…';
    locate.classList.add('is-busy');
    try {
      const place = await useMyLocation();
      field('place').value = place.name;
      status.textContent = '';
    } catch {
      status.textContent = 'Location is off. Allow it for your browser in system settings, or type a city.';
    } finally {
      locate.classList.remove('is-busy');
    }
  });
  field('place').addEventListener('change', () => void setPlace());
  field('place').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); void setPlace(); }
  });
}
