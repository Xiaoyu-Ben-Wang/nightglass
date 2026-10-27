// The clock, date and greeting, and the first-run name prompt.
import { $, h } from './dom.js';
import { onSettings, settings, updateSettings } from './settings.js';
import { roll } from './motion.js';
import { longDate, parts } from './time.js';

const clock = $('clock');
const date = $('date');
const greeting = $('greeting');
const nameForm = $<HTMLFormElement>('name-form');
const nameInput = $<HTMLInputElement>('name-input');

function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

let shown = '';

/** Draws the time one character per slot; characters that changed since the last minute roll in. */
function drawTime(time: string, ampm: string): void {
  const prev = shown;
  shown = time;
  const slots = [...time].map((ch) => h('span', { class: 'digit' }, h('span', { class: 'digit__now' }, ch)));
  clock.replaceChildren(...slots, ...(ampm ? [h('span', { class: 'clock__ampm' }, ampm)] : []));
  if (!prev) return;
  // Align from the right so 9:59 -> 10:00 compares minutes with minutes.
  slots.forEach((slot, i) => {
    const old = prev[prev.length - (time.length - i)];
    if (old !== undefined && old !== time[i]) roll(slot, old);
  });
}

function tick(): void {
  const now = new Date();
  const { hour24, name } = settings();
  const { hour, minute } = parts(now);
  const hours = hour24 ? hour : hour % 12 || 12;
  const time = `${hour24 ? String(hours).padStart(2, '0') : hours}:${String(minute).padStart(2, '0')}`;
  const ampm = hour24 ? '' : hour < 12 ? 'AM' : 'PM';
  if (clock.dataset.time !== time + ampm) {
    clock.dataset.time = time + ampm;
    drawTime(time, ampm);
    date.textContent = longDate(now);
    document.title = `${time}${ampm ? ` ${ampm}` : ''}`;
  }
  const text = `Good ${partOfDay(hour)}`;
  if (greeting.dataset.text !== text + name && !greeting.querySelector('[contenteditable="true"]')) {
    greeting.dataset.text = text + name;
    const who = h('span', { class: 'greeting__name', title: 'Double-click to rename' }, name);
    who.addEventListener('dblclick', () => rename(who));
    who.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); who.blur(); }
      if (e.key === 'Escape') { who.textContent = settings().name; who.blur(); }
    });
    greeting.replaceChildren(name ? `${text}, ` : text, ...(name ? [who, '.'] : ['.']));
  }
}

function rename(el: HTMLElement): void {
  el.contentEditable = 'true';
  el.focus();
  getSelection()?.selectAllChildren(el);
  const done = (keep: boolean) => {
    el.contentEditable = 'false';
    const next = (el.textContent ?? '').trim().slice(0, 40);
    if (keep && next && next !== settings().name) void updateSettings({ name: next });
    else el.textContent = settings().name;
  };
  el.addEventListener('blur', () => done(true), { once: true });
}

export function initClock(): void {
  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name) void updateSettings({ name });
  });
  onSettings((s) => {
    nameForm.hidden = !!s.name;
    greeting.hidden = !s.name;
    document.body.classList.toggle('is-onboarding', !s.name);
    if (!s.name) nameInput.focus();
    clock.dataset.time = '';
    tick();
  });
  setInterval(tick, 1000);
}
