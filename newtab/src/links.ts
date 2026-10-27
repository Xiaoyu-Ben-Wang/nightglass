import { $, h } from './dom.js';
import { leave } from './motion.js';
import { load, save, uid, watch } from './store.js';

interface Link { id: string; title: string; url: string }

const KEY = 'links';
const list = $('links-list');
const form = $<HTMLFormElement>('links-form');
const canFavicon = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

let links: Link[] = [];

function set(next: Link[]): void {
  const prev = links;
  links = next;
  render();
  save('sync', KEY, next).catch(() => {
    links = prev;
    render();
    const address = form.elements.namedItem('url') as HTMLInputElement;
    address.setCustomValidity('Too many links to sync. Remove some first.');
    address.reportValidity();
  });
}

function favicon(url: string): HTMLImageElement | string {
  if (!canFavicon) return '';
  const src = new URL(chrome.runtime.getURL('/_favicon/'));
  src.searchParams.set('pageUrl', url);
  src.searchParams.set('size', '32');
  return h('img', { src: src.href, alt: '' });
}

// The link just added; only it animates on the next render.
let added = '';

function render(): void {
  list.replaceChildren(...links.map((l) => {
    const del = h('button', { class: 'item__del', title: 'Remove', ariaLabel: `Remove ${l.title}` }, '×');
    const li = h('li', { class: l.id === added ? 'item is-entering' : 'item' }, h('a', { class: 'item__main', href: l.url }, favicon(l.url), l.title), del);
    del.addEventListener('click', () => leave(li, () => set(links.filter((x) => x.id !== l.id))));
    return li;
  }));
  added = '';
}

function normalize(raw: string): string | null {
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export async function initLinks(): Promise<void> {
  links = await load<Link[]>('sync', KEY, []);
  render();
  watch(KEY, (v) => { links = (v as Link[] | undefined) ?? []; render(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.elements.namedItem('title') as HTMLInputElement;
    const address = form.elements.namedItem('url') as HTMLInputElement;
    const url = normalize(address.value.trim());
    if (!url) {
      address.setCustomValidity('Enter a web address');
      address.reportValidity();
      return;
    }
    added = uid();
    set([...links, { id: added, title: title.value.trim() || new URL(url).hostname, url }]);
    form.reset();
    title.focus();
  });
  (form.elements.namedItem('url') as HTMLInputElement).addEventListener('input', (e) => (e.target as HTMLInputElement).setCustomValidity(''));
}
