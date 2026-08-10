/**
 * Provider-agnostic mail interface.
 *
 * The contact endpoint depends only on this. Swapping providers is a change to
 * which adapter `resolveSender()` returns, not a change to the handler or its
 * tests. Workers cannot speak SMTP, so every adapter is an HTTPS API client.
 *
 * Candidate adapters:
 *   - Resend                 (self-serve, free tier covers expected volume)
 *   - Postal                 (existing vendor: postal.businessidentity.llc,
 *                             POST /api/v1/send/message, X-Server-API-Key)
 *   - Cloudflare Email       (first-party binding; no third-party key)
 */

export interface MailMessage {
  /** Envelope sender. Always on the sending subdomain, never the apex. */
  from: string;
  to: string;
  /** Set to the submitter so replying from the inbox reaches the lead. */
  replyTo: string;
  subject: string;
  text: string;
}

export interface MailSender {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

/** Thrown when a provider rejects a send. Never carries the API key. */
export class MailSendError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    detail: string,
  ) {
    super(`${provider} send failed (${status}): ${detail}`);
    this.name = 'MailSendError';
  }
}
