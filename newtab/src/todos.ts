import { $, h } from './dom.js';
import { load, save, uid, watch } from './store.js';

interface Todo { id: string; text: string; done: boolean }

const KEY = 'todos';
const list = $('todo-list');
const form = $<HTMLFormElement>('todo-form');
const count = $('todo-count');

let todos: Todo[] = [];

function set(next: Todo[]): void {
  todos = next;
  render();
  void save('local', KEY, next);
}

function render(): void {
  const open = todos.filter((t) => !t.done).length;
  count.textContent = open ? String(open) : '';
  list.replaceChildren(...todos.map((t) => {
    const box = h('input', { type: 'checkbox', checked: t.done });
    box.addEventListener('change', () => set(todos.map((x) => (x.id === t.id ? { ...x, done: box.checked } : x))));
    const del = h('button', { class: 'item__del', title: 'Delete', ariaLabel: `Delete ${t.text}` }, '×');
    del.addEventListener('click', () => set(todos.filter((x) => x.id !== t.id)));
    return h('li', { class: `item${t.done ? ' is-done' : ''}` },
      h('label', { class: 'item__main ds-check' }, box, h('span', { class: 'item__text' }, t.text)),
      del);
  }));
}

export async function initTodos(): Promise<void> {
  todos = await load<Todo[]>('local', KEY, []);
  render();
  watch(KEY, (v) => { todos = (v as Todo[] | undefined) ?? []; render(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const field = form.elements.namedItem('text') as HTMLInputElement;
    const text = field.value.trim();
    if (!text) return;
    field.value = '';
    set([...todos, { id: uid(), text, done: false }]);
  });
  $('todo-clear').addEventListener('click', () => set(todos.filter((t) => !t.done)));
}
