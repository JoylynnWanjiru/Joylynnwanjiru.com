import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { getServices } from '../../lib/entries';
import { getSite } from '../../lib/site';
import { contactTopics } from '../../lib/contact';
import { MARKER } from '../../../build/launch.mjs';
import { TOKEN_FIELD, verifyTurnstile } from '../../lib/server/turnstile';
import {
  CONTACT_ERROR_PATH,
  THANKS_PATHS,
  contactEmail,
  contactSchema,
  idempotencyKey,
  outcomeFor,
  sendWithResend,
} from '../../lib/server/contact';
import { respond } from '../../lib/server/respond';

// POST /api/contact (brief section 8). Rendered on demand on Cloudflare.
export const prerender = false;

// Until a domain is verified in Resend, its shared test sender is the only option.
const DEFAULT_FROM = 'Website contact form <onboarding@resend.dev>';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return respond(request, 400, { error: 'invalid' }, CONTACT_ERROR_PATH);
  const fields = Object.fromEntries([...form].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

  // Honeypot (brief 12.4): look successful to the bot, send nothing.
  if (fields.nickname) return respond(request, 200, { outcome: 'thanks' }, THANKS_PATHS.thanks);

  const secret = getSecret('TURNSTILE_SECRET_KEY');
  const apiKey = getSecret('RESEND_API_KEY');
  const [site, services] = await Promise.all([getSite(), getServices()]);
  if (!secret || !apiKey || site.email.includes(MARKER)) {
    console.error('contact: not configured');
    return respond(request, 503, { error: 'unavailable' }, CONTACT_ERROR_PATH);
  }

  // BR-12: nothing is processed before the token is verified.
  const turnstile = await verifyTurnstile(fields[TOKEN_FIELD], secret, request.headers.get('CF-Connecting-IP') ?? undefined);
  if (!turnstile.ok) {
    console.warn(`contact: turnstile failed (${turnstile.codes.join(', ')})`);
    return respond(request, 403, { error: 'turnstile' }, CONTACT_ERROR_PATH);
  }

  const topics = contactTopics(services);
  const parsed = contactSchema(topics.map((topic) => topic.value)).safeParse(fields);
  if (!parsed.success) {
    // Field names only: never the values (brief 12.5).
    const invalid = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    return respond(request, 400, { error: 'invalid', fields: invalid }, CONTACT_ERROR_PATH);
  }

  const message = parsed.data;
  const topicLabel = topics.find((topic) => topic.value === message.topic)?.label ?? message.topic;
  const sent = await sendWithResend({
    apiKey,
    from: getSecret('CONTACT_FROM_EMAIL') || DEFAULT_FROM,
    to: site.email,
    replyTo: message.email,
    idempotencyKey: await idempotencyKey(message),
    email: contactEmail(message, topicLabel),
  });
  if (!sent.ok) {
    console.error(`contact: Resend failed (status ${sent.status})`);
    return respond(request, 502, { error: 'send' }, CONTACT_ERROR_PATH);
  }

  const outcome = outcomeFor(message);
  return respond(request, 200, { outcome }, THANKS_PATHS[outcome]);
};
