// Builds the new tab and copies both unpacked extensions to ~/DevApps/Nightglass (or EXPORT_DIR).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { build, EXTENSIONS, root } from './extensions.ts';

const out = process.env.EXPORT_DIR ?? join(homedir(), 'DevApps', 'Nightglass');

build();
for (const { name, src, files } of EXTENSIONS) {
  const dest = join(out, name);
  // Replacing the folder also drops the browser's stale "Cached Theme.pak".
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const f of files) cpSync(join(root, src, f), join(dest, f), { recursive: true });
  console.log(`${name} -> ${dest}`);
}
