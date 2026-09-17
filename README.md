# mvx-lang.org

The public website for [mvx](https://github.com/mvx-lang/mvx), built with
[Astro](https://astro.build) and served by Caddy.

## Working on it

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
```

`npm run build` first runs `scripts/fetch-releases.mjs`, which asks GitHub for
the latest mvx release and writes `src/data/releases.json` (read by the page)
and `public/releases.json` (served at `/releases.json`). If GitHub cannot be
reached, the committed snapshot is used. Set `GITHUB_TOKEN` to avoid the
anonymous rate limit.

## Deployment

- A push to `main` runs `.github/workflows/deploy.yml`: it builds the image
  `ghcr.io/mvx-lang/mvx-lang.org`, then a self-hosted runner (label
  `mvx-lang-deploy`) on the hosting VM installs `deploy/compose.yml` to
  `/home/gordon/docker/mvx-lang-web/` and restarts the container on port 8087.
- `.github/workflows/release-check.yml` runs hourly. It compares the live
  `/releases.json` with GitHub and starts a deploy when a new mvx release has
  been published.
- Traefik on 192.168.15.2 routes `mvx-lang.org` and `www.mvx-lang.org` to
  `192.168.15.35:8087`, with a Let's Encrypt certificate by HTTP challenge.
  Caddy redirects `www` to the bare domain.

## Licence

GPL-2.0, as mvx.
