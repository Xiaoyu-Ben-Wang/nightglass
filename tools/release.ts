// Builds release/: a zip of each extension for GitHub releases, and site/, the new tab as a static demo.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, EXTENSIONS, root } from './extensions.ts';

const out = join(root, 'release');
const stage = join(out, 'stage');

function zip(dir: string, folder: string, file: string): void {
  // Windows and macOS ship bsdtar, which writes zips; Linux has zip.
  if (process.platform === 'win32') {
    execFileSync(join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe'), ['-a', '-cf', file, folder], { cwd: dir });
  } else if (process.platform === 'darwin') {
    execFileSync('tar', ['-a', '-cf', file, folder], { cwd: dir });
  } else {
    execFileSync('zip', ['-qr', file, folder], { cwd: dir });
  }
}

build();
rmSync(out, { recursive: true, force: true });

for (const { slug, src, files } of EXTENSIONS) {
  const dest = join(stage, slug);
  for (const f of files) cpSync(join(root, src, f), join(dest, f), { recursive: true });
  zip(stage, slug, join(out, `${slug}.zip`));
  console.log(`release/${slug}.zip`);
}

const site = join(out, 'site');
for (const f of ['newtab.css', 'onedark.css', 'dist', 'data', 'vendor']) cpSync(join(root, 'newtab', f), join(site, f), { recursive: true });
cpSync(join(root, 'newtab', 'newtab.html'), join(site, 'index.html'));
// GitHub Pages runs Jekyll by default, which drops files starting with "_" such as vendor/backdrops/_core.js.
writeFileSync(join(site, '.nojekyll'), '');
rmSync(stage, { recursive: true, force: true });
console.log('release/site/');
