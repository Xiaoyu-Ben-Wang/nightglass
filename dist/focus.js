// Today's main focus: one line, cleared at midnight, kept on this device.
import { $ } from './dom.js';
import { load, save, watch } from './store.js';
import { today } from './time.js';
const KEY = 'focus';
const form = $('focus-form');
const input = $('focus-input');
const box = $('today');
const text = $('focus-text');
const done = $('focus-done');
let focus = null;
function render() {
    // Yesterday's focus doesn't carry over.
    const current = focus && focus.day === today() ? focus : null;
    form.hidden = !!current;
    box.hidden = !current;
    if (!current)
        return;
    text.textContent = current.text;
    done.checked = current.done;
    box.classList.toggle('is-done', current.done);
}
function set(next) {
    focus = next;
    render();
    void save('local', KEY, next);
}
export async function initFocus() {
    focus = await load('local', KEY, null);
    render();
    watch(KEY, (v) => { focus = v; render(); });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = input.value.trim();
        if (!value)
            return;
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
