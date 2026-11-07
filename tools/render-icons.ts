// Renders newtab/icons/icon.svg to the PNG sizes the manifest lists, with headless Chrome.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { findChrome } from './browser.ts';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'newtab', 'icons');
const chrome = findChrome();

// The real viewport is wider than the 128px window (Windows has a minimum window width) and a bare
// SVG centers in it, outside the captured area, so the SVG sits at a fixed size in the top-left corner.
const page = 'data:text/html,' + encodeURIComponent(
  '<style>html,body{margin:0;background:transparent}img{position:fixed;left:0;top:0;width:128px;height:128px}</style>'
  + `<img src="data:image/svg+xml;base64,${readFileSync(join(dir, 'icon.svg')).toString('base64')}">`,
);

// Headless windows can't go as small as 16px, so every size renders a 128px window at a lower scale.
for (const size of [16, 32, 48, 128]) {
  const out = join(dir, `icon-${size}.png`);
  const profile = mkdtempSync(join(tmpdir(), 'icon-'));
  try {
    execFileSync(chrome, [
      '--headless=new',
      '--virtual-time-budget=1000',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--force-device-scale-factor=${size / 128}`,
      `--user-data-dir=${profile}`,
      '--window-size=128,128',
      `--screenshot=${out}`,
      page,
    ], { stdio: 'ignore', timeout: 60_000 });
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  console.log(`wrote ${out}`);
}
