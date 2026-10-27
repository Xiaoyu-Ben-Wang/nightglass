import { $ } from './dom.js';
import { onSettings, settings, updateSettings, type Settings, type Spin } from './settings.js';
import { useMyLocation } from './location.js';
import { geocode } from './weather.js';

const PANELS = [['links-toggle', 'links-panel'], ['todo-toggle', 'todo-panel'], ['settings-toggle', 'settings-panel']] as const;

export function closePanels(except?: string): void {
  for (const [btn, panel] of PANELS) {
    if (panel === except) continue;
    $(panel).hidden = true;
    $(btn).setAttribute('aria-expanded', 'false');
  }
}

export function openPanel(panel: string): void {
  const pair = PANELS.find(([, p]) => p === panel)!;
  closePanels(panel);
  $(panel).hidden = false;
  $(pair[0]).setAttribute('aria-expanded', 'true');
  $(panel).querySelector<HTMLInputElement>('input:not([type="checkbox"])')?.focus();
}

export function initPanels(): void {
  for (const [btn, panel] of PANELS) {
    $(btn).addEventListener('click', () => ($(panel).hidden ? openPanel(panel) : closePanels()));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanels();
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Element;
    if (!t.closest('.panel, .chip, .weather')) closePanels();
  });
}

function bindSettings(): void {
  const form = $<HTMLFormElement>('settings-form');
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const status = $('place-status');

  const fill = (s: Settings) => {
    if (document.activeElement !== field('name')) field('name').value = s.name;
    if (document.activeElement !== field('place')) field('place').value = s.place?.name ?? '';
    if (document.activeElement !== field('quoteApi')) field('quoteApi').value = s.quoteApi;
    field('hour24').checked = s.hour24;
    field('fahrenheit').checked = s.fahrenheit;
    field('spin').value = s.spin;
    field('daylight').checked = s.daylight;
    field('weatherFx').checked = s.weatherFx;
    for (const k of Object.keys(s.show) as (keyof Settings['show'])[]) field(`show.${k}`).checked = s.show[k];
    // Older saved settings can still hold layers that no longer have a switch.
    for (const k of Object.keys(s.sky) as (keyof Settings['sky'])[]) {
      const box = form.elements.namedItem(`sky.${k}`) as HTMLInputElement | null;
      if (box) box.checked = s.sky[k];
    }
  };
  onSettings(fill);

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

  const setPlace = async () => {
    const query = field('place').value.trim();
    if (query && query === settings().place?.name) return;
    if (!query) {
      $('place-locate').click();
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
  const locate = $('place-locate');
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

function bindVisibility(): void {
  onSettings((s) => {
    document.querySelectorAll<HTMLElement>('[data-widget]').forEach((el) => {
      const on = s.show[el.dataset.widget as keyof Settings['show']];
      el.classList.toggle('off', !on);
      if (!on) el.querySelectorAll('input').forEach((i) => i.blur());
    });
    for (const [widget, btn, panel] of [['links', 'links-toggle', 'links-panel'], ['todo', 'todo-toggle', 'todo-panel']] as const) {
      if (s.show[widget]) continue;
      $(panel).hidden = true;
      $(btn).setAttribute('aria-expanded', 'false');
    }
  });
}

function bindSearch(): void {
  const form = $<HTMLFormElement>('search');
  const input = $<HTMLInputElement>('search-input');
  // A typed query keeps the field open after it loses focus.
  input.addEventListener('input', () => form.classList.toggle('has-text', !!input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    input.value = '';
    form.classList.remove('has-text');
    input.blur();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    // chrome.search uses the browser's default search engine.
    if (typeof chrome !== 'undefined' && chrome.search) void chrome.search.query({ text, disposition: 'CURRENT_TAB' });
    else location.href = `https://search.brave.com/search?q=${encodeURIComponent(text)}`;
  });
  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (e.key === '/' && !typing && settings().show.search) {
      e.preventDefault();
      // A keyboard shortcut opens the field at once, without the reveal.
      const form = $('search');
      form.classList.add('instant');
      input.focus();
      // Apply the open state with transitions off before turning them back on.
      void getComputedStyle(form).clipPath;
      form.classList.remove('instant');
    }
  });
}

export function initControls(): void {
  initPanels();
  bindSettings();
  bindVisibility();
  bindSearch();
}
