// Recolors the sky by the sun's elevation: night, twilight, dusk or dawn, and a muted day blue.
import { between, clamp, DAY_MS, hex, lerp, mixRGB, rgb, type RGB } from './math.js';
import { onSettings, settings } from './settings.js';

interface Stop { at: number; glow: RGB; mid: RGB; deep: RGB; ink: RGB }
const stop = (at: number, glow: string, mid: string, deep: string, ink: string): Stop =>
  ({ at, glow: hex(glow), mid: hex(mid), deep: hex(deep), ink: hex(ink) });

// Keyed by sun elevation in degrees. Day stays dark enough for the light UI text.
const STOPS: Stop[] = [
  stop(-18, '#2c313a', '#282c34', '#21252b', '#abb2bf'),
  stop(-10, '#342f44', '#2a2c3b', '#21242c', '#abb2bf'),
  stop(-4, '#574763', '#31374c', '#252a36', '#9ea6b6'),
  stop(0, '#6a5f7e', '#435069', '#2b3343', '#8e97a8'),
  stop(8, '#6487a8', '#42597a', '#303f56', '#7f8da3'),
  stop(25, '#5f84a8', '#3f5878', '#2f3f57', '#75849a'),
];

// The warm wash that rises from the horizon around sunrise and sunset: violet and pink before the sun is
// up, orange-red as it crosses the horizon, gold for the first few degrees, then nothing by full day.
interface Warm { at: number; low: RGB; mid: RGB; a: number }
const warm = (at: number, low: string, mid: string, a: number): Warm => ({ at, low: hex(low), mid: hex(mid), a });
const WARM: Warm[] = [
  warm(-10, '#c678dd', '#7c5c9c', 0),
  warm(-5, '#e06c75', '#c678dd', 0.4),
  warm(-1, '#e8835e', '#e06c75', 0.62),
  warm(2, '#eba15f', '#d97a6c', 0.62),
  // Peach rather than yellow: yellow over the slate-blue day sky mixes to olive.
  warm(6, '#eda66c', '#cf8a82', 0.42),
  warm(12, '#eda66c', '#cf8a82', 0),
];

const RAD = Math.PI / 180;

/** Sun elevation, hour angle and declination (USNO low-precision formulas, good to about a degree). */
function sunPosition(date: Date, lat: number, lon: number): { elev: number; ha: number; dec: number } {
  const d = date.getTime() / DAY_MS - 10_957.5; // days since J2000
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15 * RAD;
  const raw = gmst + lon * RAD - ra;
  const ha = Math.atan2(Math.sin(raw), Math.cos(raw)); // -π..π, negative before solar noon
  const elev = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
  return { elev, ha, dec };
}

/** The weather location, or without one a mid latitude and the longitude implied by the time zone. */
function guessPlace(now: Date): { lat: number; lon: number } {
  return settings().place ?? { lat: 40, lon: -now.getTimezoneOffset() / 4 };
}

// Height on screen from the share of today's peak elevation; the square root keeps the sun high for most of the day.
const arc = (share: number) => 1.04 - 0.94 * Math.sign(share) * Math.sqrt(Math.abs(clamp(share, -0.2, 1)));

/**
 * Where to draw the sun, as fractions of the screen: it rises at the bottom on the east side, peaks near the
 * top at solar noon, and sets off the bottom on the west side. East is on the left facing the equator.
 */
export function sunPlace(): { x: number; y: number; elev: number } {
  const q = new URLSearchParams(location.search);
  const pinned = q.get('sun');
  if (pinned !== null) {
    const elev = +pinned;
    return { x: +(q.get('sunx') ?? 0.3), y: arc(elev / 45), elev };
  }
  const now = new Date();
  const place = guessPlace(now);
  const { elev, ha, dec } = sunPosition(now, place.lat, place.lon);
  const noon = 90 - Math.abs(place.lat - dec / RAD);
  // Hour angle of sunset; polar day and night fall back to a half turn.
  const cosH0 = -Math.tan(place.lat * RAD) * Math.tan(dec);
  const h0 = Math.abs(cosH0) < 1 ? Math.acos(cosH0) : Math.PI;
  const side = place.lat < 0 ? -1 : 1;
  return {
    x: 0.5 + side * 0.44 * clamp(ha / h0, -1.2, 1.2),
    y: arc(elev / Math.max(5, noon)),
    elev,
  };
}

function horizon(elev: number): { low: string; mid: string; a: number } {
  const [a, b, t] = between(WARM, elev);
  return { low: rgb(mixRGB(a.low, b.low, t)), mid: rgb(mixRGB(a.mid, b.mid, t)), a: +lerp(a.a, b.a, t).toFixed(3) };
}

function palette(elev: number): Record<'glow' | 'mid' | 'deep' | 'ink', string> {
  const [a, b, t] = between(STOPS, elev);
  return { glow: rgb(mixRGB(a.glow, b.glow, t)), mid: rgb(mixRGB(a.mid, b.mid, t)), deep: rgb(mixRGB(a.deep, b.deep, t)), ink: rgb(mixRGB(a.ink, b.ink, t)) };
}

const root = document.documentElement;
const PROPS = ['--sky-glow', '--sky-mid', '--sky-deep', '--sky-ink'] as const;
let applied = '';
let night = 1;

/** 0 by day, 1 once the sun is 8° down. */
export const nightness = (): number => night;

function apply(on: boolean): void {
  const elev = on ? sunPlace().elev : -90;
  night = clamp(-elev / 8);
  // The moon fades with it.
  root.style.setProperty('--nightness', String(night));
  const w = horizon(elev);
  root.style.setProperty('--horizon-low', w.low);
  root.style.setProperty('--horizon-mid', w.mid);
  root.style.setProperty('--horizon-a', String(on ? w.a : 0));
  const p = on ? palette(elev) : null;
  const key = JSON.stringify(p);
  if (key === applied) return;
  applied = key;
  if (p) {
    PROPS.forEach((prop, i) => root.style.setProperty(prop, [p.glow, p.mid, p.deep, p.ink][i]!));
    root.style.background = `radial-gradient(120% 80% at 70% 0%, ${p.glow} 0%, ${p.mid} 45%, ${p.deep} 100%) ${p.deep}`;
  } else {
    PROPS.forEach((prop) => root.style.removeProperty(prop));
    root.style.removeProperty('background');
  }
  // The backdrop re-reads its colors on this event, keeping its stars in place.
  document.dispatchEvent(new Event('ds:theme'));
}

export function initDaylight(): void {
  let timer = 0;
  onSettings((s) => {
    clearInterval(timer);
    apply(s.daylight);
    if (s.daylight) timer = setInterval(() => apply(true), 60_000);
  });
}
