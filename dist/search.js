// The search field behind the magnifier icon: opens on focus or "/", searches with the browser's default engine.
import { $ } from './dom.js';
import { settings } from './settings.js';
/** Used when the page runs outside the extension, where chrome.search isn't available. */
export const webSearch = (text) => `https://www.google.com/search?q=${encodeURIComponent(text)}`;
export function initSearch() {
    const form = $('search');
    const input = $('search-input');
    // A typed query keeps the field open after it loses focus.
    input.addEventListener('input', () => form.classList.toggle('has-text', !!input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape')
            return;
        input.value = '';
        form.classList.remove('has-text');
        input.blur();
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text)
            return;
        if (typeof chrome !== 'undefined' && chrome.search)
            void chrome.search.query({ text, disposition: 'CURRENT_TAB' });
        else
            location.href = webSearch(text);
    });
    document.addEventListener('keydown', (e) => {
        const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
        if (e.key !== '/' || typing || !settings().show.search)
            return;
        e.preventDefault();
        // A keyboard shortcut opens the field at once: apply the open state with transitions off, then restore them.
        form.classList.add('is-instant');
        input.focus();
        void getComputedStyle(form).clipPath;
        form.classList.remove('is-instant');
    });
}
