import { $ } from './dom.js';
import { onSettings, settings, updateSettings, type Settings } from './settings.js';
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
    field('hour24').checked = s.hour24;
    field('fahrenheit').checked = s.fahrenheit;
    for (const k of Object.keys(s.show) as (keyof Settings['show'])[]) field(`show.${k}`).checked = s.show[k];
    for (const k of Object.keys(s.sky) as (keyof Settings['sky'])[]) field(`sky.${k}`).checked = s.sky[k];
  };
  onSettings(fill);

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const s = settings();
    if (input.name === 'name') {
      const name = input.value.trim();
      if (name) void updateSettings({ name });
    } else if (input.name === 'hour24' || input.name === 'fahrenheit') {
      void updateSettings({ [input.name]: input.checked });
    } else if (input.name.startsWith('show.')) {
      void updateSettings({ show: { ...s.show, [input.name.slice(5)]: input.checked } });
    } else if (input.name.startsWith('sky.')) {
      void updateSettings({ sky: { ...s.sky, [input.name.slice(4)]: input.checked } });
    }
  });

  const setPlace = async () => {
    const query = field('place').value.trim();
    if (!query) {
      await updateSettings({ place: null });
      status.textContent = 'Weather off';
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
  $('place-set').addEventListener('click', () => void setPlace());
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
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    // chrome.search uses the browser's default search engine.
    if (typeof chrome !== 'undefined' && chrome.search) void chrome.search.query({ text, disposition: 'CURRENT_TAB' });
    else location.href = `https://search.brave.com/search?q=${encodeURIComponent(text)}`;
  });
  document.addEventListener('keydown', (e) => {
    const typing = (e.target as Element).closest('input, textarea, [contenteditable="true"]');
    if (e.key === '/' && !typing && settings().show.search) {
      e.preventDefault();
      input.focus();
    }
  });
}

export function initControls(): void {
  initPanels();
  bindSettings();
  bindVisibility();
  bindSearch();
}
