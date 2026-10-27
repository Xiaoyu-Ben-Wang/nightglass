// The to-do list, kept on this device.
import { $, h } from './dom.js';
import { leave } from './motion.js';
import { load, save, uid, watch } from './store.js';
const KEY = 'todos';
const list = $('todo-list');
const form = $('todo-form');
const count = $('todo-count');
let todos = [];
// The item just added or checked off; only it animates on the next render.
let added = '';
let checked = '';
function set(next) {
    todos = next;
    render();
    void save('local', KEY, next);
}
function render() {
    const open = todos.filter((t) => !t.done).length;
    count.textContent = open ? String(open) : '';
    list.replaceChildren(...todos.map((t) => {
        const box = h('input', { type: 'checkbox', checked: t.done });
        box.addEventListener('change', () => {
            checked = box.checked ? t.id : '';
            set(todos.map((x) => (x.id === t.id ? { ...x, done: box.checked } : x)));
        });
        const del = h('button', { class: 'item__del', title: 'Delete', ariaLabel: `Delete ${t.text}` }, '×');
        const li = h('li', { class: ['item', t.done && 'is-done', t.id === added && 'is-entering', t.id === checked && 'is-just-done'].filter(Boolean).join(' ') }, h('label', { class: 'item__main ds-check' }, box, h('span', { class: 'item__text' }, t.text)), del);
        del.addEventListener('click', () => leave(li, () => set(todos.filter((x) => x.id !== t.id))));
        return li;
    }));
    added = checked = '';
}
export async function initTodos() {
    todos = await load('local', KEY, []);
    render();
    watch(KEY, (v) => { todos = v ?? []; render(); });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const field = form.elements.namedItem('text');
        const text = field.value.trim();
        if (!text)
            return;
        field.value = '';
        added = uid();
        set([...todos, { id: added, text, done: false }]);
    });
    $('todo-clear').addEventListener('click', () => {
        const done = [...list.querySelectorAll('.item.is-done')];
        if (!done.length)
            return;
        let left = done.length;
        for (const li of done)
            leave(li, () => { if (--left === 0)
                set(todos.filter((t) => !t.done)); });
    });
}
