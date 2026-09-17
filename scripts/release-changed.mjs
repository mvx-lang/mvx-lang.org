// Print changed=true when GitHub's latest releases differ from what the live
// site says it was built with (its /releases.json), else changed=false.
// A site that cannot be read counts as changed: a rebuild is the cheap answer.

import { build } from './fetch-releases.mjs';

const key = (data) =>
  JSON.stringify(
    (data?.packages ?? []).map((p) => [p.id, p.stable?.tag ?? null, p.preview?.tag ?? null]),
  );

const now = await build();
let live = null;
try {
  const res = await fetch(process.env.SITE ?? 'https://mvx-lang.org/releases.json', {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (res.ok) live = await res.json();
} catch {
  // fall through: unreadable counts as changed
}

const changed = key(now) !== key(live);
console.error(`github ${key(now)}  site ${key(live)}`);
console.log(`changed=${changed}`);
