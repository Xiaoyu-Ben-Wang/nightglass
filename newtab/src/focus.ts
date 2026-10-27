// Today's main focus: one line, cleared at midnight, kept on this device.
import { $ } from './dom.js';
import { load, save, watch } from './store.js';
import { today } from './time.js';

interface Focus { text: string; done: boolean; day: string }

const KEY = 'focus';
const form = $<HTMLFormElement>('focus-form');
const input = $<HTMLInputElement>('focus-input');
const box = $('today');
const text = $('focus-text');
const done = $<HTMLInputElement>('focus-done');

let focus: Focus | null = null;

function render(): void {
  // Yesterday's focus doesn't carry over.
  const current = focus && focus.day === today() ? focus : null;
  form.hidden = !!current;
  box.hidden = !current;
  if (!current) return;
  text.textContent = current.text;
  done.checked = current.done;
  box.classList.toggle('is-done', current.done);
}

function set(next: Focus | null): void {
  focus = next;
  render();
  void save('local', KEY, next);
}

export async function initFocus(): Promise<void> {
  focus = await load<Focus | null>('local', KEY, null);
  render();
  watch(KEY, (v) => { focus = v as Focus | null; render(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    set({ text: value, done: false, day: today() });
  });
  done.addEventListener('change', () => focus && set({ ...focus, done: done.checked }));
  $('focus-clear').addEventListener('click', () => {
    set(null);
    input.focus();
  });
  // A new day can start while the tab stays open.
  setInterval(render, 60_000);
}
