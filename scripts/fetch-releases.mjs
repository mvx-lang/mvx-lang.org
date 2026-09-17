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

// "v0.2.2" -> [0,2,2], "2.1.0-rc3" -> [2,1,0] with pre "rc3"
function parse(tag) {
  const m = /^v?(\d+(?:\.\d+)*)(?:-(.+))?$/.exec(tag);
  if (!m) return null;
  return { nums: m[1].split('.').map(Number), pre: m[2] ?? null };
}

function cmpNums(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

// newest first; a release outranks its own pre-releases
function cmpTags(a, b) {
  const pa = parse(a), pb = parse(b);
  const n = cmpNums(pb.nums, pa.nums);
  if (n) return n;
  if (!pa.pre && pb.pre) return -1;
  if (pa.pre && !pb.pre) return 1;
  return (pb.pre ?? '').localeCompare(pa.pre ?? '', undefined, { numeric: true });
}

function shape(r) {
  return {
    tag: r.tag_name,
    version: r.tag_name.replace(/^v/, ''),
    date: (r.published_at ?? r.created_at ?? '').slice(0, 10),
    url: r.html_url,
    // the downloadable builds, not their checksums
    assets: (r.assets ?? [])
      .filter((a) => a.name.endsWith('.tar.gz'))
      .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
  };
}

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
    const all = (await releasesOf(p.repo))
      .filter((r) => !r.draft && r.tag_name !== 'dev' && parse(r.tag_name));
    const stable = all.filter((r) => !r.prerelease && !parse(r.tag_name).pre)
      .sort((a, b) => cmpTags(a.tag_name, b.tag_name))[0] ?? null;
    const preview = all.filter((r) => r.prerelease || parse(r.tag_name).pre)
      .filter((r) => !stable || cmpNums(parse(r.tag_name).nums, parse(stable.tag_name).nums) > 0)
      .sort((a, b) => cmpTags(a.tag_name, b.tag_name))[0] ?? null;
    packages.push({
      ...p,
      url: `https://github.com/${p.repo}/releases`,
      stable: stable && shape(stable),
      preview: preview && shape(preview),
    });
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

export { build, cmpTags };
