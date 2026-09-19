# mvx-lang.org

The public website for [mvx](https://github.com/mvx-lang/mvx), built with
[Astro](https://astro.build) and served by Caddy.

## Working on it

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
```

**The page reads the release from GitHub when it loads**, so a new release
appears without a rebuild or a deploy. The rules for choosing which release to
show live in `src/lib/releases.js`, which both the browser and the build use,
so the two cannot drift apart. The answer is cached in the reader's browser for
fifteen minutes, since GitHub allows sixty anonymous calls an hour.

What is built into the page is the **fallback**: what a reader with no
JavaScript sees, and what shows if GitHub cannot be reached (the page says so
when that happens). `npm run build` refreshes it by running
`scripts/fetch-releases.mjs`, which writes `src/data/releases.json` (rendered
into the page) and `public/releases.json` (served at `/releases.json`). If
GitHub cannot be reached at build time, the committed snapshot is kept. Set
`GITHUB_TOKEN` to avoid the anonymous rate limit.

## Deployment

- A push to `main` runs `.github/workflows/deploy.yml`: it builds the image
  `ghcr.io/mvx-lang/mvx-lang.org`, then a self-hosted runner (label
  `mvx-lang-deploy`) on the hosting VM installs `deploy/compose.yml` to
  `/home/gordon/docker/mvx-lang-web/` and restarts the container on port 8087.
- `.github/workflows/release-check.yml` runs daily. It compares the live
  `/releases.json` with GitHub and starts a deploy when they differ, which
  keeps the built-in fallback close to the truth. The page itself does not
  depend on it.
- Traefik on 192.168.15.2 routes `mvx-lang.org` and `www.mvx-lang.org` to
  `192.168.15.35:8087`, with a Let's Encrypt certificate by HTTP challenge.
  Caddy redirects `www` to the bare domain.

## Licence

GPL-2.0, as mvx.
