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
  /** Quotable-compatible endpoint; empty uses only the bundled list. */
  quoteApi: string;
  show: Record<'links' | 'search' | 'weather' | 'focus' | 'quote' | 'todo', boolean>;
  sky: Record<'moon' | 'aurora' | 'chart' | 'meteors' | 'clouds' | 'mountains' | 'koi', boolean>;
}

export const DEFAULTS: Settings = {
  name: '',
  hour24: false,
  fahrenheit: false,
  place: null,
  spin: 'medium',
  daylight: true,
  quoteApi: 'https://api.quotable.io/quotes/random?maxLength=140',
  show: { links: true, search: true, weather: true, focus: true, quote: true, todo: true },
  sky: { moon: true, aurora: false, chart: true, meteors: false, clouds: false, mountains: false, koi: false },
};

const KEY = 'settings';
let current: Settings = DEFAULTS;
const subscribers: ((s: Settings) => void)[] = [];

function merge(saved: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULTS,
    ...saved,
    show: { ...DEFAULTS.show, ...saved?.show },
    sky: { ...DEFAULTS.sky, ...saved?.sky },
  };
}

export async function initSettings(): Promise<Settings> {
  current = merge(await load<Partial<Settings>>('sync', KEY, {}));
  watch(KEY, (v) => {
    current = merge(v as Partial<Settings>);
    subscribers.forEach((fn) => fn(current));
  });
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
  await save('sync', KEY, current);
}
