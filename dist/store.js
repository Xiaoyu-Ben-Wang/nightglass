const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage;
const listeners = new Map();
// Values this tab wrote whose onChanged echo hasn't arrived yet. A late echo of an older
// write would otherwise overwrite newer local state.
const pending = new Map();
export async function load(area, key, fallback) {
    if (hasChrome) {
        const got = await chrome.storage[area].get(key);
        return got[key] ?? fallback;
    }
    const raw = localStorage.getItem(`${area}:${key}`);
    return raw === null ? fallback : JSON.parse(raw);
}
export async function save(area, key, value) {
    if (hasChrome) {
        const json = JSON.stringify(value);
        pending.set(key, [...(pending.get(key) ?? []), json]);
        try {
            await chrome.storage[area].set({ [key]: value });
        }
        catch (err) {
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
export function watch(key, fn) {
    if (!listeners.has(key))
        listeners.set(key, new Set());
    listeners.get(key).add(fn);
}
function emit(key, value) {
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
}
else {
    window.addEventListener('storage', (e) => {
        if (!e.key || e.newValue === null)
            return;
        emit(e.key.slice(e.key.indexOf(':') + 1), JSON.parse(e.newValue));
    });
}
export const uid = () => crypto.randomUUID();
