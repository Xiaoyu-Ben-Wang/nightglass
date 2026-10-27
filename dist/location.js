// The weather place: detected at most every 6 hours, or a typed city, which stops detection until "Use my location".
import { settings, updateSettings } from './settings.js';
import { load, save } from './store.js';
const EVERY = 6 * 3_600_000;
function position() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation)
            return reject(new Error('Location is unavailable'));
        navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, { timeout: 15_000, maximumAge: 3_600_000 });
    });
}
async function placeName(lat, lon) {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'en' }).toString();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        const d = await res.json();
        // Admin level 8 is the municipality; `city` is sometimes a wider region instead.
        const admin = d.localityInfo?.administrative ?? [];
        const town = admin.find((a) => a.adminLevel === 8)?.name || d.city || d.locality;
        return [town, d.principalSubdivision, d.countryCode].filter(Boolean).join(', ') || 'Current location';
    }
    catch {
        return 'Current location';
    }
}
/** Detects the location now and saves it as the weather place. */
export async function useMyLocation() {
    const { latitude, longitude } = await position();
    const lat = +latitude.toFixed(3), lon = +longitude.toFixed(3);
    const old = settings().place;
    // Same spot as before: keep its coordinates and zone so the weather cache stays valid.
    const same = old?.auto && Math.abs(old.lat - lat) < 0.05 && Math.abs(old.lon - lon) < 0.05;
    const name = await placeName(lat, lon);
    const place = same ? { ...old, name } : { name, lat, lon, auto: true };
    await save('local', 'locatedAt', Date.now());
    if (!same || name !== old.name)
        await updateSettings({ place });
    return place;
}
export async function initLocation() {
    const place = settings().place;
    if (place && !place.auto)
        return;
    if (Date.now() - (await load('local', 'locatedAt', 0)) < EVERY && place)
        return;
    try {
        await useMyLocation();
    }
    catch {
        // Permission denied or no fix: the weather stays off until a city is set.
    }
}
/** Looks up a typed city with Open-Meteo's geocoder. */
export async function geocode(query) {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    // Open-Meteo matches a place name only, so "Springfield, Illinois, US" searches "Springfield"
    // and the rest picks among the matches.
    const [name, ...rest] = query.split(',').map((s) => s.trim()).filter(Boolean);
    if (!name)
        return null;
    url.search = new URLSearchParams({ name, count: '10', format: 'json' }).toString();
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`Geocoding failed (${res.status})`);
    const hits = (await res.json()).results ?? [];
    const hint = rest.join(' ').toLowerCase();
    const hit = hits.find((c) => [c.admin1, c.country, c.country_code].some((x) => x && hint.includes(x.toLowerCase()))) ?? hits[0];
    if (!hit)
        return null;
    return { name: [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude, tz: hit.timezone };
}
