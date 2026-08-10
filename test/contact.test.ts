import { describe, expect, it, vi } from 'vitest';
import { handleContact, MAX_BODY_BYTES, type ContactConfig } from '../worker/contact';
import { MailSendError, type MailMessage, type MailSender } from '../worker/mail/sender';

/**
 * Runs with no network: the mail sender and Turnstile verifier are both fakes.
 * Covers the cases named in the design doc §13.
 */

const config: ContactConfig = {
  from: 'Clays Consulting <noreply@send.claysconsulting.org>',
  to: 'info@claysconsulting.org',
  turnstileSecret: 'test-secret',
  minSubmitMs: 3000,
};

/** Records what would have been sent. */
function fakeSender() {
  const sent: MailMessage[] = [];
  const sender: MailSender = {
    name: 'fake',
    async send(message) {
      sent.push(message);
    },
  };
  return { sender, sent };
}

const failingSender: MailSender = {
  name: 'fake',
  async send() {
    throw new MailSendError('fake', 422, 'domain not verified');
  },
};

const accept = vi.fn(async () => true);
const reject = vi.fn(async () => false);

/** A submission old enough to clear the minimum time-to-submit check. */
const validFields = () => ({
  name: 'Dana Reeve',
  email: 'dana@example.gov',
  organization: 'Example Agency',
  message: 'Internal network pentest, 40 hosts, Q4.',
  'cf-turnstile-response': 'token',
  rendered_at: String(Date.now() - 10_000),
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://claysconsulting.org/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('handleContact', () => {
  it('accepts a valid submission and sends one mail', async () => {
    const { sender, sent } = fakeSender();
    const res = await handleContact(post(validFields()), config, sender, accept);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('sets reply-to to the submitter so the inbox can reply directly', async () => {
    const { sender, sent } = fakeSender();
    await handleContact(post(validFields()), config, sender, accept);

    expect(sent[0]!.replyTo).toBe('dana@example.gov');
    expect(sent[0]!.to).toBe('info@claysconsulting.org');
    // Envelope sender must stay on the sending subdomain, never the apex,
    // so the existing MX path is unaffected.
    expect(sent[0]!.from).toContain('@send.claysconsulting.org');
  });

  it('includes every submitted field in the body', async () => {
    const { sender, sent } = fakeSender();
    await handleContact(post(validFields()), config, sender, accept);

    const text = sent[0]!.text;
    expect(text).toContain('Dana Reeve');
    expect(text).toContain('dana@example.gov');
    expect(text).toContain('Example Agency');
    expect(text).toContain('Internal network pentest');
  });

  it('rejects a non-POST request', async () => {
    const { sender, sent } = fakeSender();
    const req = new Request('https://claysconsulting.org/api/contact', { method: 'GET' });
    const res = await handleContact(req, config, sender, accept);

    expect(res.status).toBe(405);
    expect(sent).toHaveLength(0);
  });

  it('rejects a missing Turnstile token', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), 'cf-turnstile-response': '' };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_captcha');
    expect(sent).toHaveLength(0);
  });

  it('rejects a failed Turnstile verification', async () => {
    const { sender, sent } = fakeSender();
    const res = await handleContact(post(validFields()), config, sender, reject);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('captcha_failed');
    expect(sent).toHaveLength(0);
  });

  it('silently discards a honeypot trip without sending', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), website: 'http://spam.example' };
    const res = await handleContact(post(fields), config, sender, accept);

    // 200 so a bot cannot tell rejection from success.
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it('rejects a submission that arrives implausibly fast', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), rendered_at: String(Date.now()) };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('too_fast');
    expect(sent).toHaveLength(0);
  });

  it('honors rendered_at sent as a JSON number, not only a string', async () => {
    const { sender, sent } = fakeSender();
    // A number would previously be dropped, silently skipping the timing check.
    const fields = { ...validFields(), rendered_at: Date.now() };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('too_fast');
    expect(sent).toHaveLength(0);
  });

  it('ignores object and array field values', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), name: { evil: true } };
    const res = await handleContact(post(fields), config, sender, accept);

    // name becomes absent rather than "[object Object]".
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('missing_fields');
    expect(sent).toHaveLength(0);
  });

  it('rejects an oversized payload before reading it', async () => {
    const { sender, sent } = fakeSender();
    const res = await handleContact(
      post(validFields(), { 'content-length': String(MAX_BODY_BYTES + 1) }),
      config,
      sender,
      accept,
    );

    expect(res.status).toBe(413);
    expect(sent).toHaveLength(0);
  });

  it('rejects malformed JSON', async () => {
    const { sender, sent } = fakeSender();
    const res = await handleContact(post('{not json'), config, sender, accept);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('malformed_body');
    expect(sent).toHaveLength(0);
  });

  it('rejects missing required fields', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), organization: '  ' };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('missing_fields');
    expect(sent).toHaveLength(0);
  });

  it('rejects an invalid email address', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), email: 'not-an-email' };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('invalid_email');
    expect(sent).toHaveLength(0);
  });

  it('rejects header injection via the email field', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), email: 'a@b.co\r\nBcc: victim@example.com' };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(422);
    expect(sent).toHaveLength(0);
  });

  it('rejects an over-long message', async () => {
    const { sender, sent } = fakeSender();
    const fields = { ...validFields(), message: 'x'.repeat(4001) };
    const res = await handleContact(post(fields), config, sender, accept);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('field_too_long');
    expect(sent).toHaveLength(0);
  });

  it('accepts a form-encoded submission so the form works without JS', async () => {
    const { sender, sent } = fakeSender();
    const body = new URLSearchParams(validFields()).toString();
    const req = new Request('https://claysconsulting.org/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    const res = await handleContact(req, config, sender, accept);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it('reports a provider failure as 502 without leaking the reason', async () => {
    const res = await handleContact(post(validFields()), config, failingSender, accept);

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('send_failed');
    expect(JSON.stringify(res.body)).not.toContain('domain not verified');
  });

  it('skips Turnstile when no secret is configured (local dev only)', async () => {
    const { sender, sent } = fakeSender();
    const noCaptcha: ContactConfig = { ...config, turnstileSecret: undefined };
    const fields = { ...validFields(), 'cf-turnstile-response': '' };

    const res = await handleContact(post(fields), noCaptcha, sender, reject);
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
  });
});
