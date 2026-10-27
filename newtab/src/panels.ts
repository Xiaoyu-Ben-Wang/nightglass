// The corner panels (links, to-dos, settings) and which widgets show.
import { $ } from './dom.js';
import { onSettings, type Settings } from './settings.js';

const PANELS = [['links-toggle', 'links-panel'], ['todo-toggle', 'todo-panel'], ['settings-toggle', 'settings-panel']] as const;

function closePanels(except?: string): void {
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
    if (!(e.target as Element).closest('.panel, .chip, .weather')) closePanels();
  });

  onSettings((s) => {
    document.querySelectorAll<HTMLElement>('[data-widget]').forEach((el) => {
      const on = s.show[el.dataset.widget as keyof Settings['show']];
      el.classList.toggle('is-off', !on);
      if (!on) el.querySelectorAll('input').forEach((i) => i.blur());
    });
    // A hidden widget's panel closes with it.
    for (const [widget, btn, panel] of [['links', 'links-toggle', 'links-panel'], ['todo', 'todo-toggle', 'todo-panel']] as const) {
      if (s.show[widget]) continue;
      $(panel).hidden = true;
      $(btn).setAttribute('aria-expanded', 'false');
    }
  });
}
