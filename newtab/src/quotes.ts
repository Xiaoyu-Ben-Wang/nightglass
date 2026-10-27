import { $ } from './dom.js';
import { today } from './store.js';

// Public-domain lines, several of them about the night sky.
const QUOTES: [string, string][] = [
  ['I have loved the stars too fondly to be fearful of the night.', 'Sarah Williams'],
  ['Keep your eyes on the stars, and your feet on the ground.', 'Theodore Roosevelt'],
  ['We are all in the gutter, but some of us are looking at the stars.', 'Oscar Wilde'],
  ['Hitch your wagon to a star.', 'Ralph Waldo Emerson'],
  ['Adopt the pace of nature: her secret is patience.', 'Ralph Waldo Emerson'],
  ['Dwell on the beauty of life. Watch the stars, and see yourself running with them.', 'Marcus Aurelius'],
  ['Very little is needed to make a happy life.', 'Marcus Aurelius'],
  ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'],
  ['No man is free who is not master of himself.', 'Epictetus'],
  ['The journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau'],
  ['The best way out is always through.', 'Robert Frost'],
  ['Well done is better than well said.', 'Benjamin Franklin'],
  ['Lost time is never found again.', 'Benjamin Franklin'],
  ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
];

const text = $('quote-text');
const by = $('quote-by');

function show(i: number): void {
  const [line, author] = QUOTES[i % QUOTES.length]!;
  text.textContent = line;
  by.textContent = author;
}

export function initQuote(): void {
  // One quote per day; click for another.
  let i = Math.floor(Date.parse(today()) / 86_400_000);
  show(i);
  $('quote').addEventListener('click', () => show(++i));
}
