// One quote per day: from a Quotable-compatible API when it answers, else from the bundled list.
// Whichever source answers, the quote is cached for the rest of the day.
import { $ } from './dom.js';
import { onSettings, settings } from './settings.js';
import { load, save } from './store.js';
import { today } from './time.js';

interface Quote { text: string; author: string; source: 'api' | 'list'; day: string }

const KEY = 'quote';
const text = $('quote-text');
const by = $('quote-by');

let list: [string, string][] | null = null;
// After one failure, skip the API for the rest of this tab's life.
let apiFailed = false;

const dayIndex = (day: string) => Math.floor(Date.parse(day) / 86_400_000);

async function fromApi(url: string): Promise<Pick<Quote, 'text' | 'author'>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Quote API returned ${res.status}`);
  const data: unknown = await res.json();
  // /quotes/random returns an array, the older /random a single object.
  const q = (Array.isArray(data) ? data[0] : data) as { content?: unknown; author?: unknown } | undefined;
  if (typeof q?.content !== 'string' || typeof q.author !== 'string') throw new Error('Unexpected quote format');
  return { text: q.content, author: q.author };
}

async function fromList(index: number): Promise<Pick<Quote, 'text' | 'author'>> {
  list ??= (await (await fetch(new URL('../data/quotes.json', import.meta.url))).json()) as [string, string][];
  const [quote, author] = list[((index % list.length) + list.length) % list.length]!;
  return { text: quote, author };
}

async function pick(day: string, index: number): Promise<Quote> {
  const url = settings().quoteApi.trim();
  if (url && !apiFailed) {
    try {
      return { ...(await fromApi(url)), source: 'api', day };
    } catch {
      apiFailed = true;
    }
  }
  return { ...(await fromList(index)), source: 'list', day };
}

function show(q: Quote): void {
  text.textContent = q.text;
  by.textContent = q.author;
}

export async function initQuote(): Promise<void> {
  const day = today();
  let offset = 0;
  const next = async () => {
    const q = await pick(day, dayIndex(day) + offset++);
    show(q);
    await save('local', KEY, q);
  };

  const cached = await load<Quote | null>('local', KEY, null);
  if (cached && cached.day === day) show(cached);
  else await next();

  // Click for another; it becomes today's quote.
  $('quote').addEventListener('click', () => void next());

  let api = settings().quoteApi;
  onSettings((s) => {
    if (s.quoteApi === api) return;
    api = s.quoteApi;
    apiFailed = false;
    void next();
  });
}
