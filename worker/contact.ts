import { MailSendError, type MailSender } from './mail/sender';

/**
 * POST /api/contact — validation, anti-spam, and dispatch.
 *
 * Kept free of Worker globals so it can be unit-tested with a fake sender and
 * a fake Turnstile verifier, with no network (§13).
 */

export interface ContactConfig {
  /** Envelope sender on the sending subdomain. */
  from: string;
  /** Business inbox. Inbound mail path is untouched by this project. */
  to: string;
  /** Turnstile secret. When absent, verification is skipped (local dev only). */
  turnstileSecret?: string;
  /** Reject submissions faster than this after render, in milliseconds. */
  minSubmitMs: number;
}

export interface TurnstileVerifier {
  (token: string, remoteIp: string | null): Promise<boolean>;
}

/** Max accepted request body. Anything larger is rejected unread. */
export const MAX_BODY_BYTES = 16 * 1024;

const LIMITS = {
  name: 120,
  email: 200,
  organization: 160,
  message: 4000,
} as const;

export interface ContactResult {
  status: number;
  body: { ok: boolean; error?: string };
}

const fail = (status: number, error: string): ContactResult => ({
  status,
  body: { ok: false, error },
});

/**
 * Accepts JSON or form-encoded bodies so the form works with and without JS.
 */
async function readFields(request: Request): Promise<Record<string, string> | null> {
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) {
      const raw = (await request.json()) as unknown;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        // Coerce numbers and booleans: a client that sends rendered_at as a
        // JSON number would otherwise have it silently dropped, skipping the
        // minimum time-to-submit check. Objects and arrays are still ignored.
        if (typeof v === 'string') out[k] = v;
        else if (typeof v === 'number' && Number.isFinite(v)) out[k] = String(v);
        else if (typeof v === 'boolean') out[k] = String(v);
      }
      return out;
    }
    if (
      type.includes('application/x-www-form-urlencoded') ||
      type.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      const out: Record<string, string> = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    }
  } catch {
    return null;
  }
  return null;
}

// Deliberately permissive: the goal is to reject obvious junk, not to police
// valid addresses. Delivery is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export async function handleContact(
  request: Request,
  config: ContactConfig,
  sender: MailSender,
  verifyTurnstile: TurnstileVerifier,
): Promise<ContactResult> {
  if (request.method !== 'POST') return fail(405, 'method_not_allowed');

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return fail(413, 'payload_too_large');

  const fields = await readFields(request);
  if (!fields) return fail(400, 'malformed_body');

  // 1. Honeypot: hidden field, so any value means a bot filled it.
  //    Returns 200 so the bot cannot distinguish rejection from success.
  if ((fields.website ?? '').trim() !== '') {
    return { status: 200, body: { ok: true } };
  }

  // 2. Minimum time-to-submit.
  const renderedAt = Number(fields.rendered_at ?? '0');
  if (Number.isFinite(renderedAt) && renderedAt > 0) {
    if (Date.now() - renderedAt < config.minSubmitMs) {
      return fail(422, 'too_fast');
    }
  }

  // 3. Turnstile, verified server-side. A client-only check is theater.
  if (config.turnstileSecret) {
    const token = fields['cf-turnstile-response'] ?? '';
    if (!token) return fail(400, 'missing_captcha');
    const ip = request.headers.get('cf-connecting-ip');
    if (!(await verifyTurnstile(token, ip))) return fail(403, 'captcha_failed');
  }

  // 4. Field validation.
  const name = (fields.name ?? '').trim();
  const email = (fields.email ?? '').trim();
  const organization = (fields.organization ?? '').trim();
  const message = (fields.message ?? '').trim();

  if (!name || !email || !organization || !message) return fail(422, 'missing_fields');
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    organization.length > LIMITS.organization ||
    message.length > LIMITS.message
  ) {
    return fail(422, 'field_too_long');
  }
  if (!EMAIL_RE.test(email)) return fail(422, 'invalid_email');

  // Header injection guard: a newline in the reply-to would let a submitter
  // append their own headers.
  if (/[\r\n]/.test(email) || /[\r\n]/.test(name)) return fail(422, 'invalid_email');

  const text = [
    `Name:         ${name}`,
    `Email:        ${email}`,
    `Organization: ${organization}`,
    '',
    'Scope & timeline:',
    message,
  ].join('\n');

  try {
    await sender.send({
      from: config.from,
      to: config.to,
      replyTo: email,
      subject: `Engagement request — ${organization}`,
      text,
    });
  } catch (err) {
    if (err instanceof MailSendError) {
      console.error(err.message);
    } else {
      console.error('mail send failed', err);
    }
    return fail(502, 'send_failed');
  }

  return { status: 200, body: { ok: true } };
}
