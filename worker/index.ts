import { handleContact, type ContactConfig, type TurnstileVerifier } from './contact';
import { ResendSender } from './mail/resend';
import type { MailSender } from './mail/sender';

/**
 * Entry point. Only /api/* reaches this Worker — everything else is served
 * directly from static assets (see `run_worker_first` in wrangler.jsonc).
 */

interface WorkerEnv extends Env {
  /** Provider API key, set via `wrangler secret put MAIL_API_KEY`. */
  MAIL_API_KEY?: string;
  /** Turnstile secret, set via `wrangler secret put TURNSTILE_SECRET_KEY`. */
  TURNSTILE_SECRET_KEY?: string;
  /** Which adapter to use. Defaults to resend. */
  MAIL_PROVIDER?: string;
}

const CONTACT_TO = 'info@claysconsulting.org';
const CONTACT_FROM = 'Clays Consulting <noreply@send.claysconsulting.org>';

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // This endpoint is same-origin only; no CORS headers by design.
      'cache-control': 'no-store',
    },
  });

/** Resolves the configured adapter, or null if no provider is set up yet. */
function resolveSender(env: WorkerEnv): MailSender | null {
  if (!env.MAIL_API_KEY) return null;
  switch (env.MAIL_PROVIDER ?? 'resend') {
    case 'resend':
      return new ResendSender(env.MAIL_API_KEY);
    default:
      return null;
  }
}

const makeTurnstileVerifier =
  (secret: string): TurnstileVerifier =>
  async (token, remoteIp) => {
    const body = new FormData();
    body.append('secret', secret);
    body.append('response', token);
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
    );
    if (!res.ok) return false;
    const outcome = (await res.json()) as { success?: boolean };
    return outcome.success === true;
  };

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      const sender = resolveSender(env);

      // M1 ships without a mail provider chosen. Fail loudly and honestly
      // rather than accepting a submission we cannot deliver.
      if (!sender) {
        return json(503, {
          ok: false,
          error: 'not_configured',
          detail: `Contact endpoint has no mail provider configured. Email ${CONTACT_TO} directly.`,
        });
      }

      const config: ContactConfig = {
        from: CONTACT_FROM,
        to: CONTACT_TO,
        turnstileSecret: env.TURNSTILE_SECRET_KEY,
        minSubmitMs: 3000,
      };

      const verifier = env.TURNSTILE_SECRET_KEY
        ? makeTurnstileVerifier(env.TURNSTILE_SECRET_KEY)
        : async () => true;

      const result = await handleContact(request, config, sender, verifier);
      return json(result.status, result.body);
    }

    return json(404, { ok: false, error: 'not_found' });
  },
} satisfies ExportedHandler<WorkerEnv>;
