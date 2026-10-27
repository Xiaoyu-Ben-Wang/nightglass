// Current conditions from Open-Meteo (free, no API key), cached for 30 minutes.
import { $, h } from './dom.js';
import { onSettings, settings, updateSettings, type Place, type Settings } from './settings.js';
import { load, save } from './store.js';
import { setConditions } from './weatherfx.js';

interface Reading { key: string; at: number; temp: number; code: number; day: boolean; hi: number; lo: number; tz: string; wind?: number; windDir?: number }

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
  // Open-Meteo matches a place name only, so "Springfield, Illinois, US" searches "Springfield"
  // and the rest picks among the matches.
  const [name, ...rest] = query.split(',').map((s) => s.trim()).filter(Boolean);
  if (!name) return null;
  url.search = new URLSearchParams({ name, count: '10', format: 'json' }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  type Hit = { name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number; timezone?: string };
  const hits: Hit[] = (await res.json()).results ?? [];
  const hint = rest.join(' ').toLowerCase();
  const hit = hits.find((h) => [h.admin1, h.country, h.country_code].some((x) => x && hint.includes(x.toLowerCase()))) ?? hits[0];
  if (!hit) return null;
  return { name: [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude, tz: hit.timezone };
}

async function read(place: Place, fahrenheit: boolean): Promise<Reading> {
  const key = `${place.lat.toFixed(3)},${place.lon.toFixed(3)},${fahrenheit ? 'f' : 'c'}`;
  const cached = await load<Reading | null>('local', 'weather', null);
  if (cached && cached.key === key && Date.now() - cached.at < TTL) return cached;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    current: 'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m',
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
    tz: d.timezone,
    wind: d.current.wind_speed_10m,
    windDir: d.current.wind_direction_10m,
  };
  await save('local', 'weather', reading);
  return reading;
}

// Temperature colour by °C: icy blue when cold, gold when mild to warm, red when extremely hot.
const TEMP_STOPS: [number, [number, number, number]][] = [
  [-20, [190, 214, 255]],
  [-5, [125, 185, 245]],
  [5, [97, 175, 239]],
  [10, [86, 182, 194]],
  [15, [200, 190, 150]],
  [19, [209, 154, 102]],
  [29, [209, 154, 102]],
  [35, [226, 120, 84]],
  [40, [232, 84, 84]],
];

export function tempColour(celsius: number): string {
  const i = TEMP_STOPS.findIndex(([at]) => at > celsius);
  const [a, b] = i === 0 ? [TEMP_STOPS[0]!, TEMP_STOPS[0]!] : i < 0 ? [TEMP_STOPS.at(-1)!, TEMP_STOPS.at(-1)!] : [TEMP_STOPS[i - 1]!, TEMP_STOPS[i]!];
  const t = a === b ? 0 : (celsius - a[0]) / (b[0] - a[0]);
  return `rgb(${a[1].map((v, j) => Math.round(v + (b[1][j]! - v) * t)).join(', ')})`;
}

let latest = 0;

async function render(s: Settings): Promise<void> {
  const ticket = ++latest;
  if (!s.place) {
    setConditions(null);
    el.replaceChildren();
    return;
  }
  try {
    const r = await read(s.place, s.fahrenheit);
    if (ticket !== latest) return;
    // Open-Meteo names the place's zone; the clock uses it.
    const place = settings().place;
    if (place && r.tz && place.tz !== r.tz) void updateSettings({ place: { ...place, tz: r.tz } });
    setConditions({ code: r.code, day: r.day, wind: r.wind, windDir: r.windDir });
    const celsius = s.fahrenheit ? (r.temp - 32) * 5 / 9 : r.temp;
    el.title = `High ${Math.round(r.hi)}°, low ${Math.round(r.lo)}°`;
    const temp = h('span', { class: 'weather__temp' }, `${Math.round(r.temp)}°`);
    temp.style.color = tempColour(celsius);
    el.replaceChildren(
      temp,
      h('span', { class: 'weather__sky' }, describe(r.code, r.day)),
      h('span', { class: 'weather__place' }, s.place.name.split(',')[0]!),
    );
  } catch {
    if (ticket !== latest) return;
    setConditions(null);
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
