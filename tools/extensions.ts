// The two extensions' folders and the files each ships, shared by the export and release scripts.
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..');

export const EXTENSIONS = [
  { name: 'Nightglass Theme', slug: 'nightglass-theme', src: 'theme', files: ['manifest.json', 'images'] },
  {
    name: 'Nightglass New Tab',
    slug: 'nightglass-new-tab',
    src: 'newtab',
    files: ['manifest.json', 'newtab.html', 'newtab.css', 'onedark.css', 'dist', 'data', 'vendor'],
  },
] as const;

/** A clean build, so modules that were renamed or removed don't ship. */
export function build(): void {
  rmSync(join(root, 'newtab', 'dist'), { recursive: true, force: true });
  execSync('pnpm run build', { cwd: root, stdio: 'inherit' });
}
