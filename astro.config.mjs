// @ts-check
import { defineConfig } from 'astro/config';

// Static output only. The Cloudflare Worker in worker/index.ts serves dist/ via the
// ASSETS binding and owns /api/* — so no Astro adapter is needed or wanted here.
// https://astro.build/config
export default defineConfig({
  site: 'https://claysconsulting.org',
  output: 'static',
  build: {
    // Fingerprinted assets under /_assets so the Worker can cache them immutably.
    assets: '_assets',
  },
});
