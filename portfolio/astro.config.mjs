// @ts-check
import { defineConfig } from 'astro/config';

// Static output only. worker/index.ts serves dist/ via the ASSETS binding, and
// there are no API routes in v1, so no Astro adapter is needed or wanted here.
// https://astro.build/config
export default defineConfig({
  site: 'https://portfolio.claysconsulting.org',
  output: 'static',
  build: {
    assets: '_assets',
  },
});
