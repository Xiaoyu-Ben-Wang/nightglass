// Recolors the sky by the sun's elevation: night, twilight, dusk or dawn, and a muted day blue.
import { onSettings, settings } from './settings.js';

type RGB = [number, number, number];
interface Stop { at: number; glow: RGB; mid: RGB; deep: RGB; ink: RGB }

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
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

/** Sun elevation in degrees (USNO low-precision formulas, good to about a degree). */
export function sunElevation(date: Date, lat: number, lon: number): number {
  const d = date.getTime() / 86_400_000 - 10_957.5; // days since J2000
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15 * RAD;
  const ha = gmst + lon * RAD - ra;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

function mix(a: RGB, b: RGB, t: number): string {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(', ')})`;
}

function horizon(elev: number): { low: string; mid: string; a: number } {
  const first = WARM[0]!, last = WARM[WARM.length - 1]!;
  const i = WARM.findIndex((w) => w.at > elev);
  const [a, b] = elev <= first.at ? [first, first] : i < 0 ? [last, last] : [WARM[i - 1]!, WARM[i]!];
  const t = a === b ? 0 : (elev - a.at) / (b.at - a.at);
  return { low: mix(a.low, b.low, t), mid: mix(a.mid, b.mid, t), a: +(a.a + (b.a - a.a) * t).toFixed(3) };
}

function palette(elev: number): Record<'glow' | 'mid' | 'deep' | 'ink', string> {
  const first = STOPS[0]!, last = STOPS[STOPS.length - 1]!;
  const i = STOPS.findIndex((s) => s.at > elev);
  const [a, b] = elev <= first.at ? [first, first] : i < 0 ? [last, last] : [STOPS[i - 1]!, STOPS[i]!];
  const t = a === b ? 0 : (elev - a.at) / (b.at - a.at);
  return { glow: mix(a.glow, b.glow, t), mid: mix(a.mid, b.mid, t), deep: mix(a.deep, b.deep, t), ink: mix(a.ink, b.ink, t) };
}

function elevationNow(): number {
  const pinned = new URLSearchParams(location.search).get('sun');
  if (pinned !== null) return +pinned;
  const now = new Date();
  // Without a weather location, guess longitude from the time zone and assume a mid latitude.
  const place = settings().place ?? { lat: 40, lon: -now.getTimezoneOffset() / 4 };
  return sunElevation(now, place.lat, place.lon);
}

const root = document.documentElement;
const PROPS = ['--sky-glow', '--sky-mid', '--sky-deep', '--sky-ink'] as const;
let applied = '';

function apply(on: boolean): void {
  const elev = on ? elevationNow() : -90;
  // 0 by day, 1 once the sun is 8° down; the moon fades with it.
  root.style.setProperty('--nightness', String(Math.min(1, Math.max(0, -elev / 8))));
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
