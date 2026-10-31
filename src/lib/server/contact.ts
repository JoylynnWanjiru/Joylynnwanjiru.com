// Contact form processing for /api/contact (brief section 8, BR-1, BR-2, 12.4, 12.5).
// Pure functions plus a Resend sender that takes `fetch` as an argument, so all of it is
// tested without network access.

import { z } from 'astro/zod';
import { BUDGETS, LIMITS, TIMELINES, type Outcome } from '../contact';

export { CONTACT_ERROR_PATH, THANKS_PATHS, type Outcome } from '../contact';

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

/** Validates the posted form. Topic values are checked against the live list in the route. */
export function contactSchema(topics: string[]) {
  return z.object({
    name: z.string().trim().min(1).max(LIMITS.name),
    email: z.string().trim().max(LIMITS.email).pipe(z.email()),
    organisation: optional(LIMITS.organisation),
    topic: z.string().refine((value) => topics.includes(value)),
    budget: z.enum(BUDGETS.map((option) => option.value) as [string, ...string[]]),
    timeline: z.enum(TIMELINES.map((option) => option.value) as [string, ...string[]]),
    decisionMaker: z.enum(['yes', 'no']),
    website: optional(LIMITS.website).pipe(z.url({ protocol: /^https?$/ }).optional()),
    message: z.string().trim().min(1).max(LIMITS.message),
    newsletter: z.literal('yes').optional(),
  });
}

export type ContactMessage = z.infer<ReturnType<typeof contactSchema>>;


/**
 * BR-2: a Kadi rental enquiry gets an email reply, never a call link.
 * BR-1: the free-call link needs a budget of $500 or more (any band but the first),
 * a timeline other than "Just exploring", and the decision-maker.
 */
export function outcomeFor(message: Pick<ContactMessage, 'topic' | 'budget' | 'timeline' | 'decisionMaker'>): Outcome {
  if (message.topic === 'kadi') return 'kadi';
  const qualified =
    message.budget !== BUDGETS[0].value && message.timeline !== 'exploring' && message.decisionMaker === 'yes';
  return qualified ? 'call' : 'thanks';
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const labelOf = (options: { value: string; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/** The email Joylynn receives. Every visitor value is escaped (brief 12.5). */
export function contactEmail(message: ContactMessage, topicLabel: string) {
  const rows: [string, string][] = [
    ['Name', message.name],
    ['Email', message.email],
    ['Organisation', message.organisation ?? '—'],
    ['Topic', topicLabel],
    ['Budget', labelOf(BUDGETS, message.budget)],
    ['Timeline', labelOf(TIMELINES, message.timeline)],
    ['Decision-maker', message.decisionMaker === 'yes' ? 'Yes' : 'No'],
    ['Website', message.website ?? '—'],
    ['Newsletter', message.newsletter ? 'Yes, opted in' : 'No'],
    ['Confirmation shown', { call: 'Free call link', thanks: 'Start here and newsletter', kadi: 'Reply by email' }[outcomeFor(message)]],
  ];
  const subject = `Contact: ${topicLabel} from ${message.name}`.replace(/[\r\n]+/g, ' ').slice(0, 200);
  const html = [
    '<table cellpadding="4">',
    ...rows.map(([label, value]) => `<tr><th align="left">${label}</th><td>${escapeHtml(value)}</td></tr>`),
    '</table>',
    `<p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>`,
  ].join('\n');
  const text = `${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${message.message}`;
  return { subject, html, text };
}

/**
 * Same submission, same key, so a double submit is delivered once (brief 12.4).
 * Resend keeps keys for 24 hours; keys may be up to 256 characters.
 */
export async function idempotencyKey(message: ContactMessage): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(message));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return `contact-${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export interface SendOptions {
  apiKey: string;
  from: string;
  to: string;
  replyTo: string;
  idempotencyKey: string;
  email: { subject: string; html: string; text: string };
}

export const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Sends through Resend, retrying once (brief 12.4). A 409 `concurrent_idempotent_requests`
 * means the same submission is already being sent, so it counts as delivered.
 * Returns the last HTTP status for logging; never logs or returns the message itself.
 */
export async function sendWithResend(options: SendOptions, fetcher: typeof fetch = fetch) {
  const body = JSON.stringify({
    from: options.from,
    to: [options.to],
    reply_to: options.replyTo,
    subject: options.email.subject,
    html: options.email.html,
    text: options.email.text,
  });
  let status = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': options.idempotencyKey,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      status = response.status;
      if (response.ok) return { ok: true as const, status };
      if (status === 409) {
        const error = (await response.json().catch(() => ({}))) as { name?: string };
        if (error.name === 'concurrent_idempotent_requests') return { ok: true as const, status };
      }
      // Client errors (bad key, bad sender) will not succeed on a retry.
      if (status >= 400 && status < 500 && status !== 429) break;
    } catch {
      status = 0;
    }
  }
  return { ok: false as const, status };
}
