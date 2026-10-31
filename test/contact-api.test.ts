import { describe, expect, it, vi } from 'vitest';
import { SITEVERIFY_URL, verifyTurnstile } from '../src/lib/server/turnstile';
import {
  RESEND_URL,
  contactEmail,
  contactSchema,
  escapeHtml,
  idempotencyKey,
  outcomeFor,
  sendWithResend,
  type ContactMessage,
} from '../src/lib/server/contact';
import { respond } from '../src/lib/server/respond';
import { errorText, mailtoFallback } from '../src/lib/contact-form';

const topics = ['automation-ai', 'audit', 'kadi', 'other'];
const valid = {
  name: 'Ada',
  email: 'ada@example.com',
  topic: 'automation-ai',
  budget: '500-1500',
  timeline: 'this-month',
  decisionMaker: 'yes',
  message: 'Hello',
};
const parse = (fields: Record<string, string>) => contactSchema(topics).safeParse(fields);
const message = parse(valid).data as ContactMessage;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('contact validation', () => {
  it('accepts a complete form and drops empty optional fields', () => {
    const result = parse({ ...valid, organisation: '  ', website: '' });
    expect(result.success).toBe(true);
    expect(result.data?.organisation).toBeUndefined();
    expect(result.data?.website).toBeUndefined();
  });

  it('rejects unknown topics, bad emails and over-long messages', () => {
    expect(parse({ ...valid, topic: 'free-money' }).success).toBe(false);
    expect(parse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(parse({ ...valid, message: 'x'.repeat(5001) }).success).toBe(false);
    expect(parse({ ...valid, message: 'x'.repeat(5000) }).success).toBe(true);
  });

  it('accepts only http(s) websites', () => {
    expect(parse({ ...valid, website: 'https://example.com' }).success).toBe(true);
    expect(parse({ ...valid, website: 'javascript:alert(1)' }).success).toBe(false);
  });
});

describe('BR-1 and BR-2 confirmation', () => {
  it('shows the call link only to qualified enquiries', () => {
    expect(outcomeFor(message)).toBe('call');
    expect(outcomeFor({ ...message, budget: 'under-500' })).toBe('thanks');
    expect(outcomeFor({ ...message, timeline: 'exploring' })).toBe('thanks');
    expect(outcomeFor({ ...message, decisionMaker: 'no' })).toBe('thanks');
  });

  it('sends Kadi rental enquiries to an email reply, never a call', () => {
    expect(outcomeFor({ ...message, topic: 'kadi' })).toBe('kadi');
  });
});

describe('contact email', () => {
  it('escapes every visitor value', () => {
    const email = contactEmail({ ...message, name: '<script>x</script>', message: '<b>"hi"</b>' }, 'Automation & AI');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;b&gt;&quot;hi&quot;&lt;/b&gt;');
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('keeps line breaks out of the subject', () => {
    expect(contactEmail({ ...message, name: 'A\r\nBcc: x@y.z' }, 'Other').subject).not.toMatch(/[\r\n]/);
  });

  it('gives the same submission the same idempotency key', async () => {
    expect(await idempotencyKey(message)).toBe(await idempotencyKey({ ...message }));
    expect(await idempotencyKey(message)).not.toBe(await idempotencyKey({ ...message, message: 'Other' }));
    expect((await idempotencyKey(message)).length).toBeLessThanOrEqual(256);
  });
});

describe('Turnstile (BR-12)', () => {
  it('posts the secret, token and IP to siteverify', async () => {
    const fetcher = vi.fn(async () => json({ success: true }));
    expect(await verifyTurnstile('token', 'secret', '1.2.3.4', fetcher)).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(String(init.body)).toBe('secret=secret&response=token&remoteip=1.2.3.4');
  });

  it('fails without a token, on a spent token and when siteverify is unreachable', async () => {
    const fetcher = vi.fn(async () => json({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    expect(await verifyTurnstile(undefined, 's', undefined, fetcher)).toEqual({
      ok: false,
      codes: ['missing-input-response'],
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await verifyTurnstile('t', 's', undefined, fetcher)).toEqual({ ok: false, codes: ['timeout-or-duplicate'] });
    const down = vi.fn(async () => {
      throw new Error('network');
    });
    expect((await verifyTurnstile('t', 's', undefined, down)).ok).toBe(false);
  });
});

describe('sending through Resend (brief 12.4)', () => {
  const options = {
    apiKey: 'key',
    from: 'Site <a@b.c>',
    to: 'me@example.com',
    replyTo: 'ada@example.com',
    idempotencyKey: 'contact-abc',
    email: { subject: 's', html: 'h', text: 't' },
  };

  it('sends once with the idempotency key and reply-to', async () => {
    const fetcher = vi.fn(async () => json({ id: '1' }));
    expect(await sendWithResend(options, fetcher)).toEqual({ ok: true, status: 200 });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_URL);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('contact-abc');
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ['me@example.com'], reply_to: 'ada@example.com' });
  });

  it('retries once when Resend is down, then reports failure', async () => {
    const fetcher = vi.fn(async () => json({}, 500));
    expect(await sendWithResend(options, fetcher)).toEqual({ ok: false, status: 500 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('succeeds on the retry with the same key', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(json({ id: '1' }));
    expect((await sendWithResend(options, fetcher)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry a client error', async () => {
    const fetcher = vi.fn(async () => json({ name: 'validation_error' }, 422));
    expect((await sendWithResend(options, fetcher)).ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats a concurrent duplicate as delivered', async () => {
    const fetcher = vi.fn(async () => json({ name: 'concurrent_idempotent_requests' }, 409));
    expect((await sendWithResend(options, fetcher)).ok).toBe(true);
  });
});

describe('responses', () => {
  const post = (accept?: string) =>
    new Request('https://example.com/api/contact', { method: 'POST', headers: accept ? { Accept: accept } : {} });

  it('redirects a plain form post to a static page (no JavaScript)', () => {
    const response = respond(post(), 200, { outcome: 'call' }, '/thanks/call/');
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/thanks/call/');
  });

  it('answers the enhanced form with JSON', async () => {
    const response = respond(post('application/json'), 502, { error: 'send' }, '/contact/error/');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: 'send' });
  });
});

describe('browser fallback', () => {
  it('builds a prefilled mailto link so the message is not lost', () => {
    const link = mailtoFallback('me@example.com', { name: 'Ada', message: 'Line 1\nLine 2' });
    expect(link.startsWith('mailto:me@example.com?')).toBe(true);
    expect(decodeURIComponent(link)).toContain('Name: Ada\n\nLine 1\nLine 2');
    expect(link).not.toContain('+');
  });

  it('explains Turnstile and validation errors', () => {
    expect(errorText('turnstile')).toMatch(/check/);
    expect(errorText('invalid')).toMatch(/fields/);
  });
});
