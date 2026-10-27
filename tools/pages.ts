// Commits release/site/ to the gh-pages branch and pushes it. Run `pnpm run release` first.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from './extensions.ts';

const site = join(root, 'release', 'site');
if (!existsSync(join(site, 'index.html'))) throw new Error('release/site is missing; run `pnpm run release` first.');

// A separate index stages the site without touching the working tree or the current branch.
const tmp = mkdtempSync(join(tmpdir(), 'pages-'));
const env = { ...process.env, GIT_INDEX_FILE: join(tmp, 'index') };
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();

try {
  git(`--work-tree=${site}`, 'add', '--all', '--force', '.');
  const tree = git('write-tree');
  const source = git('rev-parse', '--short', 'HEAD');
  let parent: string[] = [];
  try {
    git('fetch', 'origin', 'gh-pages');
    parent = ['-p', git('rev-parse', 'FETCH_HEAD')];
  } catch {
    // First deploy: the branch doesn't exist yet.
  }
  if (parent.length && git('rev-parse', `${parent[1]}^{tree}`) === tree) {
    console.log('gh-pages is already up to date.');
  } else {
    const commit = git('commit-tree', tree, ...parent, '-m', `Deploy demo from ${source}`);
    git('push', 'origin', `${commit}:refs/heads/gh-pages`);
    console.log(`Pushed ${commit.slice(0, 7)} to gh-pages.`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
