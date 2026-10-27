// User settings, synced through chrome.storage.sync, with change subscriptions.
import { load, save, watch } from './store.js';
/** Seconds per full turn of the sky. */
export const SPIN_SECONDS = { off: Infinity, slow: 900, medium: 240, fast: 60 };
const DEFAULTS = {
    name: '',
    hour24: false,
    fahrenheit: false,
    place: null,
    spin: 'medium',
    daylight: true,
    weatherFx: true,
    quoteApi: 'https://api.quotable.io/quotes/random?maxLength=140',
    show: { links: true, search: true, weather: true, focus: true, quote: true, todo: true },
    sky: { moon: true, chart: true, meteors: false },
};
const KEY = 'settings';
let current = DEFAULTS;
const subscribers = [];
/** The defaults overlaid with whichever of their keys were saved; keys no longer in the defaults drop out. */
function known(defaults, saved) {
    const out = { ...defaults };
    for (const k of Object.keys(defaults))
        if (saved?.[k] !== undefined)
            out[k] = saved[k];
    return out;
}
function merge(saved) {
    return { ...known(DEFAULTS, saved), show: known(DEFAULTS.show, saved?.show), sky: known(DEFAULTS.sky, saved?.sky) };
}
export async function initSettings() {
    current = merge(await load('sync', KEY, {}));
    watch(KEY, (v) => {
        current = merge(v);
        subscribers.forEach((fn) => fn(current));
    });
    return current;
}
export const settings = () => current;
export function onSettings(fn) {
    subscribers.push(fn);
    fn(current);
}
export async function updateSettings(patch) {
    current = merge({ ...current, ...patch });
    subscribers.forEach((fn) => fn(current));
    await save('sync', KEY, current);
}
