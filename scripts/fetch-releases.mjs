// Fetch the latest releases of the MVX projects from GitHub, at build time.
//
// Writes src/data/releases.json (read by the page) and public/releases.json
// (served at /releases.json, which the deploy workflow compares against GitHub
// to decide whether a rebuild is due).
//
// For each project: the latest STABLE release, and the newest pre-release that
// is newer than it, if any.  The rolling `dev` build is never listed.
//
// If GitHub cannot be reached -- no network, or the API rate limit -- the last
// snapshot is kept and the build goes on.  A stale version on the page is
// better than no page; the next rebuild catches up.  GITHUB_TOKEN, when set,
// lifts the rate limit.

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// The same rules the page itself applies when it asks GitHub (src/lib/releases.js).
import { pick } from '../src/lib/releases.js';

export const PROJECTS = [
  {
    id: 'mvx',
    name: 'mvx',
    repo: 'mvx-lang/mvx',
    summary: 'The compiler, runtime and shell, for Linux on x86-64 and ARM64.',
  },
];

const OUT_SRC = new URL('../src/data/releases.json', import.meta.url);
const OUT_PUBLIC = new URL('../public/releases.json', import.meta.url);

async function releasesOf(repo) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'mvx-lang.org-build' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
  if (!res.ok) throw new Error(`${repo}: GitHub answered ${res.status}`);
  return res.json();
}

async function build() {
  const packages = [];
  for (const p of PROJECTS) {
    const { stable, preview } = pick(await releasesOf(p.repo));
    packages.push({ ...p, url: `https://github.com/${p.repo}/releases`, stable, preview });
  }
  return { generated: new Date().toISOString(), packages };
}

async function main() {
  let data;
  try {
    data = await build();
  } catch (err) {
    if (existsSync(OUT_SRC)) {
      console.warn(`releases: ${err.message} -- keeping the last snapshot`);
      return;
    }
    throw err;
  }
  const json = JSON.stringify(data, null, 2) + '\n';
  await mkdir(new URL('.', OUT_SRC), { recursive: true });
  await writeFile(OUT_SRC, json);
  await writeFile(OUT_PUBLIC, json);
  for (const p of data.packages) {
    const s = p.stable ? p.stable.version : 'none';
    const n = p.preview ? `, preview ${p.preview.version}` : '';
    console.log(`releases: ${p.name} ${s}${n}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { build };
