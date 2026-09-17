// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mvx-lang.org',
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [sitemap()],
});
