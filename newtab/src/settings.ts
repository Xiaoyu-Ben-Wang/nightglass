import { load, save, watch } from './store.js';

export interface Place { name: string; lat: number; lon: number }

export interface Settings {
  name: string;
  hour24: boolean;
  fahrenheit: boolean;
  place: Place | null;
  show: Record<'links' | 'search' | 'weather' | 'focus' | 'quote' | 'todo', boolean>;
  sky: Record<'aurora' | 'chart' | 'meteors' | 'clouds' | 'mountains' | 'koi', boolean>;
}

export const DEFAULTS: Settings = {
  name: '',
  hour24: false,
  fahrenheit: false,
  place: null,
  show: { links: true, search: true, weather: true, focus: true, quote: true, todo: true },
  sky: { aurora: false, chart: true, meteors: false, clouds: false, mountains: false, koi: false },
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
