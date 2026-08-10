import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

/**
 * Tests run inside workerd via Miniflare, so Request/Response/FormData behave
 * exactly as they do in production.
 *
 * Note: @cloudflare/vitest-pool-workers 0.20+ (the vitest 4 line) replaced the
 * old `defineWorkersConfig` / `poolOptions.workers` form with this Vite plugin.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
