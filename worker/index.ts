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

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });

/**
 * Minimal confirmation page for submissions that arrive without JavaScript.
 * Those clients would otherwise be shown raw JSON.
 */
const htmlResult = (status: number, ok: boolean, message: string): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? 'Request sent' : 'Something went wrong'} — Clay's Consulting</title>
<style>
:root{color-scheme:dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0f;
color:#828997;font:16px/1.6 ui-sans-serif,system-ui,sans-serif;padding:2rem}
main{max-width:34rem}
h1{color:#f2f4f8;font-size:1.5rem;letter-spacing:-.02em;margin:0 0 1rem}
a{color:${ok ? '#ff6b73' : '#ff6b73'}}
.bar{width:2rem;height:2px;background:${ok ? '#ffb224' : '#ff3b47'};margin-bottom:1.5rem}
</style></head><body><main>
<div class="bar"></div>
<h1>${ok ? 'Request sent' : 'Something went wrong'}</h1>
<p>${escapeHtml(message)}</p>
<p><a href="/#contact">Back to claysconsulting.org</a></p>
</main></body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    },
  );

/** True when the caller is a browser form POST rather than our fetch() call. */
function wantsHtml(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  const type = request.headers.get('content-type') ?? '';
  return accept.includes('text/html') && !type.includes('application/json');
}

const HUMAN_MESSAGES: Record<string, string> = {
  missing_fields: 'Please go back and complete every field.',
  invalid_email: 'That email address does not look valid.',
  field_too_long: 'One of the fields was too long.',
  too_fast: 'That was submitted very quickly. Please go back and try again.',
  missing_captcha: 'Please complete the verification challenge.',
  captcha_failed: 'Verification failed. Please go back and try again.',
  payload_too_large: 'That message was too long.',
  malformed_body: 'That submission could not be read.',
  not_configured:
    'The form is unavailable right now. Please email info@claysconsulting.org directly.',
  send_failed:
    'We could not send that message. Please email info@claysconsulting.org directly.',
};

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

      // Fail loudly rather than accepting a submission we cannot deliver.
      if (!sender) {
        if (wantsHtml(request)) {
          return htmlResult(503, false, HUMAN_MESSAGES.not_configured!);
        }
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

      // `wantsHtml` must be evaluated before the body is consumed downstream.
      const asHtml = wantsHtml(request);
      const result = await handleContact(request, config, sender, verifier);

      if (asHtml) {
        return result.body.ok
          ? htmlResult(200, true, 'Thanks — we have your request and will reply shortly.')
          : htmlResult(
              result.status,
              false,
              HUMAN_MESSAGES[result.body.error ?? ''] ??
                'Something went wrong. Please email info@claysconsulting.org directly.',
            );
      }

      return json(result.status, result.body);
    }

    return json(404, { ok: false, error: 'not_found' });
  },
} satisfies ExportedHandler<WorkerEnv>;
