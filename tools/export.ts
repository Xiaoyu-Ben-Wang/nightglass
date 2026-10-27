// Builds the new tab and copies both unpacked extensions to ~/DevApps/Nightglass (or EXPORT_DIR).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = process.env.EXPORT_DIR ?? join(homedir(), 'DevApps', 'Nightglass');

const targets: [string, string, string[]][] = [
  ['Nightglass Theme', 'theme', ['manifest.json', 'images']],
  ['Nightglass New Tab', 'newtab', ['manifest.json', 'newtab.html', 'newtab.css', 'onedark.css', 'dist', 'data', 'vendor']],
];

// A clean build, so modules that were renamed or removed don't ship.
rmSync(join(root, 'newtab', 'dist'), { recursive: true, force: true });
execSync('pnpm run build', { cwd: root, stdio: 'inherit' });

for (const [name, src, files] of targets) {
  const dest = join(out, name);
  // Replacing the folder also drops the browser's stale "Cached Theme.pak".
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const f of files) cpSync(join(root, src, f), join(dest, f), { recursive: true });
  console.log(`${name} -> ${dest}`);
}
