// Renders theme/images/theme_frame.png (1x) and theme_frame@2x.png from tools/frame.html with headless Chrome.
// Usage: node tools/render-frame.ts [query]   e.g. "px=1400&shade=0.45"
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const W = 3840, H = 160;
const root = resolve(import.meta.dirname, '..');

const candidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const chrome = candidates.find((p) => p && existsSync(p));
if (!chrome) throw new Error('No Chrome found; set CHROME to its path.');

const url = pathToFileURL(join(root, 'tools', 'frame.html'));
url.search = `w=${W}&h=${H}&${process.argv[2] ?? ''}`;

for (const [scale, name] of [[1, 'theme_frame.png'], [2, 'theme_frame@2x.png']] as const) {
  const out = join(root, 'theme', 'images', name);
  const profile = mkdtempSync(join(tmpdir(), 'frame-'));
  try {
    execFileSync(chrome, [
      '--headless=new',
      '--allow-file-access-from-files', // ES modules from file:// URLs
      '--enable-unsafe-swiftshader', // WebGL without a GPU
      '--hide-scrollbars',
      `--force-device-scale-factor=${scale}`,
      `--user-data-dir=${profile}`,
      `--window-size=${W},${H}`,
      '--force-prefers-reduced-motion', // the backdrop then draws one still frame at once
      '--virtual-time-budget=4000',
      `--screenshot=${out}`,
      url.href,
    ], { stdio: 'ignore' });
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(`wrote ${out}`);
}
