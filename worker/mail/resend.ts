import { MailSendError, type MailMessage, type MailSender } from './sender';

/**
 * Resend adapter — https://resend.com/docs/api-reference/emails/send-email
 *
 * Chosen as the first shipped adapter because it is self-serve: it does not
 * block on a third party issuing credentials. The API key is a Worker secret
 * (`wrangler secret put MAIL_API_KEY`) and never enters the repo or CI.
 */
export class ResendSender implements MailSender {
  readonly name = 'resend';

  constructor(private readonly apiKey: string) {}

  async send(message: MailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        reply_to: message.replyTo,
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!res.ok) {
      // Read the body for diagnostics, but never log the key.
      const detail = await res.text().catch(() => '<unreadable>');
      throw new MailSendError(this.name, res.status, detail.slice(0, 500));
    }
  }
}
