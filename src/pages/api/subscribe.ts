import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { getSite } from '../../lib/site';
import { SITE_URL } from '../../lib/seo';
import { TOKEN_FIELD, verifyTurnstile } from '../../lib/server/turnstile';
import { SUBSCRIBE_PATHS, subscribe, subscribeSchema } from '../../lib/server/subscribe';
import { respond } from '../../lib/server/respond';

// POST /api/subscribe (brief section 8). Rendered on demand on Cloudflare.
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return respond(request, 400, { result: 'failed', error: 'invalid' }, SUBSCRIBE_PATHS.failed);
  const fields = Object.fromEntries([...form].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

  // Honeypot (brief 12.4): look successful to the bot, subscribe nobody.
  if (fields.nickname) return respond(request, 200, { result: 'subscribed' }, SUBSCRIBE_PATHS.subscribed);

  const secret = getSecret('TURNSTILE_SECRET_KEY');
  const apiKey = getSecret('BEEHIIV_API_KEY');
  const publicationId = getSecret('BEEHIIV_PUBLICATION_ID') || (await getSite()).beehiivPublicationId;
  if (!secret || !apiKey || !publicationId) {
    console.error('subscribe: not configured');
    return respond(request, 503, { result: 'failed', error: 'unavailable' }, SUBSCRIBE_PATHS.failed);
  }

  // BR-12: nothing is processed before the token is verified.
  const turnstile = await verifyTurnstile(fields[TOKEN_FIELD], secret, request.headers.get('CF-Connecting-IP') ?? undefined);
  if (!turnstile.ok) {
    console.warn(`subscribe: turnstile failed (${turnstile.codes.join(', ')})`);
    return respond(request, 403, { result: 'failed', error: 'turnstile' }, SUBSCRIBE_PATHS.failed);
  }

  const parsed = subscribeSchema.safeParse(fields);
  if (!parsed.success) return respond(request, 400, { result: 'failed', error: 'invalid' }, SUBSCRIBE_PATHS.failed);

  const { result, status } = await subscribe(parsed.data, { apiKey, publicationId, siteUrl: SITE_URL });
  if (result === 'failed') {
    // Status only, never the address (brief 12.4, 12.5).
    console.error(`subscribe: Beehiiv failed (status ${status})`);
    return respond(request, 502, { result, error: 'send' }, SUBSCRIBE_PATHS.failed);
  }
  return respond(request, 200, { result }, SUBSCRIBE_PATHS[result]);
};
