// User settings, synced through chrome.storage.sync, with change subscriptions.
import { load, save, watch } from './store.js';

/** tz is the place's IANA zone; auto marks a detected location rather than a typed city. */
export interface Place { name: string; lat: number; lon: number; tz?: string; auto?: boolean }

export type Spin = 'off' | 'slow' | 'medium' | 'fast';

/** Seconds per full turn of the sky. */
export const SPIN_SECONDS: Record<Spin, number> = { off: Infinity, slow: 900, medium: 240, fast: 60 };

export interface Settings {
  name: string;
  hour24: boolean;
  fahrenheit: boolean;
  place: Place | null;
  spin: Spin;
  daylight: boolean;
  /** Draw the current weather over the sky. */
  weatherFx: boolean;
  /** Quotable-compatible endpoint; empty uses only the bundled list. */
  quoteApi: string;
  show: Record<'links' | 'search' | 'weather' | 'focus' | 'quote' | 'todo', boolean>;
  sky: Record<'moon' | 'chart' | 'meteors' | 'koi' | 'jellyfish', boolean>;
}

const DEFAULTS: Settings = {
  name: '',
  hour24: false,
  fahrenheit: false,
  place: null,
  spin: 'medium',
  daylight: true,
  weatherFx: true,
  quoteApi: 'https://api.quotable.io/quotes/random?maxLength=140',
  show: { links: true, search: true, weather: true, focus: true, quote: true, todo: true },
  sky: { moon: true, chart: true, meteors: false, koi: true, jellyfish: true },
};

const KEY = 'settings';
let current: Settings = DEFAULTS;
const subscribers: ((s: Settings) => void)[] = [];

/** The defaults overlaid with whichever of their keys were saved; keys no longer in the defaults drop out. */
function known<T extends object>(defaults: T, saved: Partial<T> | undefined): T {
  const out = { ...defaults };
  for (const k of Object.keys(defaults) as (keyof T)[]) if (saved?.[k] !== undefined) out[k] = saved[k] as T[keyof T];
  return out;
}

function merge(saved: Partial<Settings> | undefined): Settings {
  return { ...known(DEFAULTS, saved), show: known(DEFAULTS.show, saved?.show), sky: known(DEFAULTS.sky, saved?.sky) };
}

let markLoaded: () => void;
/** Resolves once the stored settings have been read, which can be after the page starts on the defaults. */
export const settingsLoaded = new Promise<void>((resolve) => { markLoaded = resolve; });

export async function initSettings(): Promise<Settings> {
  watch(KEY, (v) => {
    current = merge(v as Partial<Settings>);
    subscribers.forEach((fn) => fn(current));
    markLoaded();
  });
  const timedOut = {};
  const saved = await load<Partial<Settings>>('sync', KEY, {}, timedOut);
  current = merge(saved);
  // A late read arrives through watch instead.
  if (saved !== timedOut) markLoaded();
  return current;
}

export const settings = (): Settings => current;

export function onSettings(fn: (s: Settings) => void): void {
  subscribers.push(fn);
  fn(current);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  current = merge({ ...current, ...patch });
  subscribers.forEach((fn) => fn(current));
  // Saving before the stored settings arrive would overwrite them with the defaults.
  await settingsLoaded;
  current = merge({ ...current, ...patch });
  subscribers.forEach((fn) => fn(current));
  await save('sync', KEY, current);
}
