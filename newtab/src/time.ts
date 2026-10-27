// Wall-clock time in the weather location's zone, which wins over the browser's: some OS zones map to a fixed offset.
import { settings } from './settings.js';

const browserZone: string | undefined = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;

export function zone(): string | undefined {
  return settings().place?.tz || browserZone;
}

const formats = new Map<string, Intl.DateTimeFormat>();
function format(tz: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(opts)}`;
  let f = formats.get(key);
  if (!f) formats.set(key, (f = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: tz })));
  return f;
}

export interface Parts { year: number; month: number; day: number; hour: number; minute: number }

export function parts(d = new Date()): Parts {
  const p = Object.fromEntries(
    format(zone(), { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, +x.value]),
  );
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute! };
}

/** The date in the user's zone, as YYYY-MM-DD. Keys daily things like the focus and the quote. */
export function today(d = new Date()): string {
  const p = parts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function longDate(d = new Date()): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: zone() }).format(d);
}
