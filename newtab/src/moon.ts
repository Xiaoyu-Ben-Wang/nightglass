// The moon at its real phase, drawn as a lit disc inside a ticked ring.
import { $ } from './dom.js';
import { onSettings } from './settings.js';

const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
const NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const R = 20;

/** Phase as a fraction of the cycle: 0 new, 0.5 full. */
export function moonPhase(date = new Date()): number {
  const days = (date.getTime() - NEW_MOON) / 86_400_000;
  return (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
}

/** The lit part: a half-disc on the lit side closed by the terminator, an ellipse of half-width R·|cos 2πp|. */
function litPath(p: number): string {
  const rx = R * Math.abs(Math.cos(p * 2 * Math.PI));
  const waxing = p < 0.5;
  const litSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (p < 0.25 ? 0 : 1) : (p > 0.75 ? 1 : 0);
  return `M0 ${-R} A${R} ${R} 0 0 ${litSweep} 0 ${R} A${rx.toFixed(2)} ${R} 0 0 ${termSweep} 0 ${-R}Z`;
}

function ticks(): string {
  return Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * 2 * Math.PI;
    const [r1, r2] = i % 9 === 0 ? [R + 6, R + 11] : [R + 6, R + 8];
    const f = (n: number) => n.toFixed(2);
    return `M${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}L${f(Math.cos(a) * r2)} ${f(Math.sin(a) * r2)}`;
  }).join('');
}

function render(): void {
  const p = moonPhase();
  const lit = Math.round(((1 - Math.cos(p * 2 * Math.PI)) / 2) * 100);
  const name = NAMES[Math.round(p * 8) % 8]!;
  $('moon-disc').setAttribute('d', litPath(p));
  $('moon-label').textContent = `${name} · ${lit}%`;
  $('moon').title = `${name}, ${lit}% lit`;
}

export function initMoon(): void {
  $('moon-ticks').setAttribute('d', ticks());
  render();
  setInterval(render, 10 * 60_000);
  onSettings((s) => $('moon').classList.toggle('off', !s.sky.moon));
}
