// chrome.storage with a localStorage fallback, so the page also runs from a plain web server during development.
type Area = 'sync' | 'local';
type Listener = (value: unknown) => void;

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage;
const listeners = new Map<string, Set<Listener>>();
// Values this tab wrote whose onChanged echo hasn't arrived yet. A late echo of an older
// write would otherwise overwrite newer local state.
const pending = new Map<string, string[]>();

// chrome.storage can stall for seconds while the browser is starting up.
const STARTUP_WAIT = 1500;

async function read<T>(area: Area, key: string, fallback: T): Promise<T> {
  try {
    if (hasChrome) {
      const got = await chrome.storage[area].get(key);
      return (got[key] as T | undefined) ?? fallback;
    }
    const raw = localStorage.getItem(`${area}:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch (err) {
    console.error(`Couldn't read ${key}`, err);
    return fallback;
  }
}

/** Resolves with onTimeout if storage takes longer than STARTUP_WAIT; the stored value then goes to the key's watchers. */
export function load<T>(area: Area, key: string, fallback: T, onTimeout: T = fallback): Promise<T> {
  const value = read(area, key, fallback);
  return new Promise((resolve) => {
    let late = false;
    const timer = setTimeout(() => { late = true; resolve(onTimeout); }, STARTUP_WAIT);
    void value.then((v) => {
      clearTimeout(timer);
      if (late) emit(key, v);
      else resolve(v);
    });
  });
}

export async function save<T>(area: Area, key: string, value: T): Promise<void> {
  if (hasChrome) {
    const json = JSON.stringify(value);
    pending.set(key, [...(pending.get(key) ?? []), json]);
    try {
      await chrome.storage[area].set({ [key]: value });
    } catch (err) {
      const list = pending.get(key) ?? [];
      list.splice(list.indexOf(json), 1);
      throw err;
    }
    return;
  }
  localStorage.setItem(`${area}:${key}`, JSON.stringify(value));
  emit(key, value);
}

/** Calls fn when key changes, including from another open new tab. */
export function watch(key: string, fn: Listener): void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
}

function emit(key: string, value: unknown): void {
  listeners.get(key)?.forEach((fn) => fn(value));
}

if (hasChrome) {
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, change] of Object.entries(changes)) {
      const own = pending.get(key) ?? [];
      const i = own.indexOf(JSON.stringify(change.newValue));
      if (i >= 0) {
        own.splice(i, 1);
        continue;
      }
      emit(key, change.newValue);
    }
  });
} else {
  window.addEventListener('storage', (e) => {
    if (!e.key || e.newValue === null) return;
    emit(e.key.slice(e.key.indexOf(':') + 1), JSON.parse(e.newValue));
  });
}

export const uid = (): string => crypto.randomUUID();
