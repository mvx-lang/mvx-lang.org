# syntax=docker/dockerfile:1.7

# Build: the Astro static site.  The release list is fetched from GitHub here;
# the committed src/data/releases.json is the fallback when GitHub cannot be
# reached, so a build never fails for want of it.
FROM node:lts-alpine AS build

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY astro.config.mjs tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public

# The token only lifts GitHub's anonymous rate limit; it is a BuildKit secret,
# so it is never written into a layer.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" npm run build

# Runtime: Caddy serving dist/ on :80, behind Traefik.
FROM caddy:2-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
