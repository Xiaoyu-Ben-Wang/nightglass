// One quote per day, from a Quotable-compatible API when it answers or else the bundled list; cached for the day.
import { $ } from './dom.js';
import { DAY_MS } from './math.js';
import { swap } from './motion.js';
import { webSearch } from './search.js';
import { onSettings, settings } from './settings.js';
import { load, save } from './store.js';
import { today } from './time.js';
const KEY = 'quote';
const text = $('quote-text');
const by = $('quote-by');
let list = null;
// After one failure, skip the API for the rest of this tab's life.
let apiFailed = false;
const dayIndex = (day) => Math.floor(Date.parse(day) / DAY_MS);
async function fromApi(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok)
        throw new Error(`Quote API returned ${res.status}`);
    const data = await res.json();
    // /quotes/random returns an array, the older /random a single object.
    const q = (Array.isArray(data) ? data[0] : data);
    if (typeof q?.content !== 'string' || typeof q.author !== 'string')
        throw new Error('Unexpected quote format');
    return { text: q.content, author: q.author };
}
async function fromList(index) {
    list ??= (await (await fetch(new URL('../data/quotes.json', import.meta.url))).json());
    const [quote, author] = list[((index % list.length) + list.length) % list.length];
    return { text: quote, author };
}
async function pick(day, index) {
    const url = settings().quoteApi.trim();
    if (url && !apiFailed) {
        try {
            return { ...(await fromApi(url)), source: 'api', day };
        }
        catch {
            apiFailed = true;
        }
    }
    return { ...(await fromList(index)), source: 'list', day };
}
function show(q) {
    swap([text, by], () => {
        text.textContent = q.text;
        by.textContent = q.author;
    });
}
export async function initQuote() {
    const day = today();
    let offset = 0;
    const next = async () => {
        const q = await pick(day, dayIndex(day) + offset++);
        show(q);
        await save('local', KEY, q);
    };
    const cached = await load('local', KEY, null);
    if (cached && cached.day === day)
        show(cached);
    else
        await next();
    $('quote').addEventListener('click', () => {
        const q = `"${text.textContent ?? ''}" ${by.textContent ?? ''}`.trim();
        if (q.length > 3)
            window.open(webSearch(q), '_blank', 'noopener');
    });
    let api = settings().quoteApi;
    onSettings((s) => {
        if (s.quoteApi === api)
            return;
        api = s.quoteApi;
        apiFailed = false;
        void next();
    });
}
