// Finds where the user is for weather and the clock's time zone, at most every 6 hours.
// A city typed into Settings turns this off until "Use my location" is pressed.
import { settings, updateSettings, type Place } from './settings.js';
import { load, save } from './store.js';

const EVERY = 6 * 3_600_000;

function position(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is unavailable'));
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, { timeout: 15_000, maximumAge: 3_600_000 });
  });
}

async function placeName(lat: number, lon: number): Promise<string> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'en' }).toString();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();
    // Admin level 8 is the municipality; `city` is sometimes a wider region instead.
    const admin: { adminLevel?: number; name?: string }[] = d.localityInfo?.administrative ?? [];
    const town = admin.find((a) => a.adminLevel === 8)?.name || d.city || d.locality;
    return [town, d.principalSubdivision, d.countryCode].filter(Boolean).join(', ') || 'Current location';
  } catch {
    return 'Current location';
  }
}

/** Detects the location now and saves it as the weather place. */
export async function useMyLocation(): Promise<Place> {
  const { latitude, longitude } = await position();
  const lat = +latitude.toFixed(3), lon = +longitude.toFixed(3);
  const old = settings().place;
  // Same spot as before: keep its coordinates and zone so the weather cache stays valid.
  const same = old?.auto && Math.abs(old.lat - lat) < 0.05 && Math.abs(old.lon - lon) < 0.05;
  const name = await placeName(lat, lon);
  const place: Place = same ? { ...old, name } : { name, lat, lon, auto: true };
  await save('local', 'locatedAt', Date.now());
  if (!same || name !== old.name) await updateSettings({ place });
  return place;
}

export async function initLocation(): Promise<void> {
  const place = settings().place;
  if (place && !place.auto) return;
  if (Date.now() - (await load('local', 'locatedAt', 0)) < EVERY && place) return;
  try {
    await useMyLocation();
  } catch {
    // Permission denied or no fix: the weather stays off until a city is set.
  }
}
