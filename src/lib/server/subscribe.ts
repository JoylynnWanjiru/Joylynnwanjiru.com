// Newsletter sign-up for /api/subscribe (brief section 8, 12.4). Verified against Beehiiv's
// API docs on 31 October 2026: create is POST /v2/publications/{id}/subscriptions and returns
// 200 for new and existing emails alike, so an existing subscriber is found first with
// GET .../subscriptions/by_email/{url-encoded email}. The Free plan includes the API.

import { z } from 'astro/zod';
import { LIMITS } from '../contact';
import type { SubscribeResult } from '../newsletter';

export { SUBSCRIBE_PATHS, type SubscribeResult } from '../newsletter';

export const BEEHIIV_API = 'https://api.beehiiv.com/v2';
/** Brief 12.4: give up after 8 seconds and never claim success. */
export const TIMEOUT_MS = 8000;

/** Where each form sits on the site, for tracking (brief section 8). */
export const LOCATIONS = ['footer', 'writing', 'post', 'start', 'home', 'contact'] as const;
export type Location = (typeof LOCATIONS)[number];

export const subscribeSchema = z.object({
  email: z.string().trim().max(LIMITS.email).pipe(z.email()),
  location: z.enum(LOCATIONS).catch('footer'),
  // The page the form was on; only a site path is kept.
  path: z
    .string()
    .catch('/')
    .transform((value) => (/^\/[\w\-/.]{0,200}$/.test(value) ? value : '/')),
});
export type SubscribeRequest = z.infer<typeof subscribeSchema>;

/** Statuses that mean the email is already on the list (or about to be). */
const ON_LIST = new Set(['active', 'pending', 'validating']);

export interface BeehiivOptions {
  apiKey: string;
  publicationId: string;
  siteUrl: string;
}

/**
 * Never throws. Returns `failed` on any error or timeout; the caller shows the
 * "couldn't subscribe" message. The email is never logged (brief 12.5).
 */
export async function subscribe(
  request: SubscribeRequest,
  options: BeehiivOptions,
  fetcher: typeof fetch = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<{ result: SubscribeResult; status: number }> {
  // One deadline for the lookup and the create together.
  const signal = AbortSignal.timeout(timeoutMs);
  const headers = { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' };
  const base = `${BEEHIIV_API}/publications/${encodeURIComponent(options.publicationId)}/subscriptions`;
  let status = 0;
  try {
    // A failed lookup is not fatal: creating is still safe, it just can't say "already".
    const lookup = await fetcher(`${base}/by_email/${encodeURIComponent(request.email)}`, { headers, signal });
    if (lookup.ok) {
      const existing = (await lookup.json()) as { data?: { status?: string } };
      if (ON_LIST.has(existing.data?.status ?? '')) return { result: 'already', status: lookup.status };
    }

    const response = await fetcher(base, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        email: request.email,
        // Someone who unsubscribed and fills in the form again is knowingly resubscribing.
        reactivate_existing: true,
        utm_source: 'website',
        utm_medium: request.location,
        utm_campaign: request.path,
        referring_site: new URL(request.path, options.siteUrl).toString(),
      }),
    });
    status = response.status;
    if (!response.ok) return { result: 'failed', status };
    const created = (await response.json()) as { data?: { id?: string } };
    return { result: created.data?.id ? 'subscribed' : 'failed', status };
  } catch {
    return { result: 'failed', status };
  }
}
