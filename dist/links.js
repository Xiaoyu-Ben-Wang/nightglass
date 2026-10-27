// Saved links in the links panel, synced across devices.
import { $, h } from './dom.js';
import { leave } from './motion.js';
import { load, save, uid, watch } from './store.js';
const KEY = 'links';
const list = $('links-list');
const form = $('links-form');
const canFavicon = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
let links = [];
function set(next) {
    const prev = links;
    links = next;
    render();
    save('sync', KEY, next).catch(() => {
        links = prev;
        render();
        const address = form.elements.namedItem('url');
        address.setCustomValidity('Too many links to sync. Remove some first.');
        address.reportValidity();
    });
}
function favicon(url) {
    if (!canFavicon)
        return '';
    const src = new URL(chrome.runtime.getURL('/_favicon/'));
    src.searchParams.set('pageUrl', url);
    src.searchParams.set('size', '32');
    return h('img', { src: src.href, alt: '' });
}
// The link just added; only it animates on the next render.
let added = '';
function render() {
    list.replaceChildren(...links.map((l) => {
        const del = h('button', { class: 'item__del', title: 'Remove', ariaLabel: `Remove ${l.title}` }, '×');
        const li = h('li', { class: l.id === added ? 'item is-entering' : 'item' }, h('a', { class: 'item__main', href: l.url }, favicon(l.url), l.title), del);
        del.addEventListener('click', () => leave(li, () => set(links.filter((x) => x.id !== l.id))));
        return li;
    }));
    added = '';
}
function normalize(raw) {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withScheme);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    }
    catch {
        return null;
    }
}
export async function initLinks() {
    links = await load('sync', KEY, []);
    render();
    watch(KEY, (v) => { links = v ?? []; render(); });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = form.elements.namedItem('title');
        const address = form.elements.namedItem('url');
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
    form.elements.namedItem('url').addEventListener('input', (e) => e.target.setCustomValidity(''));
}
