// Which release to show, from a GitHub releases list.
//
// ONE COPY OF THE RULES.  The build bakes a snapshot into the page and the
// page then asks GitHub for itself, so the same list has to be read the same
// way twice.  Plain JavaScript with no imports: the build runs it under node
// and the browser loads it as a module.

// "v0.2.2" -> {nums:[0,2,2], pre:null};  "2.1.0-rc3" -> pre:"rc3"
export function parse(tag) {
  const m = /^v?(\d+(?:\.\d+)*)(?:-(.+))?$/.exec(tag);
  if (!m) return null;
  return { nums: m[1].split('.').map(Number), pre: m[2] ?? null };
}

export function cmpNums(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

// newest first; a release outranks its own pre-releases
export function cmpTags(a, b) {
  const pa = parse(a), pb = parse(b);
  const n = cmpNums(pb.nums, pa.nums);
  if (n) return n;
  if (!pa.pre && pb.pre) return -1;
  if (pa.pre && !pb.pre) return 1;
  return (pb.pre ?? '').localeCompare(pa.pre ?? '', undefined, { numeric: true });
}

export function shape(r) {
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

// The latest stable release, and the newest pre-release that is newer than it.
// Drafts and the rolling `dev` build are never offered.
export function pick(releases) {
  const all = (releases ?? []).filter(
    (r) => !r.draft && r.tag_name !== 'dev' && parse(r.tag_name),
  );
  const stable = all
    .filter((r) => !r.prerelease && !parse(r.tag_name).pre)
    .sort((a, b) => cmpTags(a.tag_name, b.tag_name))[0] ?? null;
  const preview = all
    .filter((r) => r.prerelease || parse(r.tag_name).pre)
    .filter((r) => !stable || cmpNums(parse(r.tag_name).nums, parse(stable.tag_name).nums) > 0)
    .sort((a, b) => cmpTags(a.tag_name, b.tag_name))[0] ?? null;
  return { stable: stable && shape(stable), preview: preview && shape(preview) };
}
