// Finds a Chromium browser for the headless render tools.
import { existsSync } from 'node:fs';

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export function findChrome(): string {
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome or Brave found; set CHROME to its path.');
  return found;
}
