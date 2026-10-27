// Current conditions from Open-Meteo (free, no API key), cached for 30 minutes.
import { $, h } from './dom.js';
import { onSettings, type Place, type Settings } from './settings.js';
import { load, save } from './store.js';

interface Reading { key: string; at: number; temp: number; code: number; day: boolean; hi: number; lo: number }

const TTL = 30 * 60_000;
const el = $<HTMLButtonElement>('weather');

// WMO weather interpretation codes
function describe(code: number, day: boolean): string {
  if (code === 0) return day ? 'Clear' : 'Clear night';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

export async function geocode(query: string): Promise<Place | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query, count: '1', format: 'json' }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const hit = (await res.json()).results?.[0];
  if (!hit) return null;
  return { name: [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude };
}

async function read(place: Place, fahrenheit: boolean): Promise<Reading> {
  const key = `${place.lat.toFixed(3)},${place.lon.toFixed(3)},${fahrenheit ? 'f' : 'c'}`;
  const cached = await load<Reading | null>('local', 'weather', null);
  if (cached && cached.key === key && Date.now() - cached.at < TTL) return cached;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    forecast_days: '1',
    timezone: 'auto',
    temperature_unit: fahrenheit ? 'fahrenheit' : 'celsius',
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather failed (${res.status})`);
  const d = await res.json();
  const reading: Reading = {
    key,
    at: Date.now(),
    temp: d.current.temperature_2m,
    code: d.current.weather_code,
    day: d.current.is_day === 1,
    hi: d.daily.temperature_2m_max[0],
    lo: d.daily.temperature_2m_min[0],
  };
  await save('local', 'weather', reading);
  return reading;
}

let latest = 0;

async function render(s: Settings): Promise<void> {
  const ticket = ++latest;
  if (!s.place) {
    el.replaceChildren();
    return;
  }
  try {
    const r = await read(s.place, s.fahrenheit);
    if (ticket !== latest) return;
    el.title = `High ${Math.round(r.hi)}°, low ${Math.round(r.lo)}°`;
    el.replaceChildren(
      h('span', { class: 'weather__temp' }, `${Math.round(r.temp)}°`),
      h('span', { class: 'weather__sky' }, describe(r.code, r.day)),
      h('span', { class: 'weather__place' }, s.place.name.split(',')[0]!),
    );
  } catch {
    if (ticket !== latest) return;
    el.replaceChildren(h('span', { class: 'weather__place' }, 'Weather unavailable'));
  }
}

export function initWeather(openSettings: () => void): void {
  el.addEventListener('click', openSettings);
  let last = '';
  onSettings((s) => {
    const key = JSON.stringify([s.place, s.fahrenheit]);
    if (key === last) return;
    last = key;
    void render(s);
  });
}
