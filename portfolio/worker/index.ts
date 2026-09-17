/**
 * v1 has no API routes — every request is served directly from static assets
 * (see wrangler.jsonc `assets`). This handler only exists because Wrangler
 * requires a `main` entry point; it should never actually be invoked.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler;
