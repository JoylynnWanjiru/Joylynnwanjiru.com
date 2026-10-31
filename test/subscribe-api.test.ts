import { describe, expect, it, vi } from 'vitest';
import { BEEHIIV_API, TIMEOUT_MS, subscribe, subscribeSchema } from '../src/lib/server/subscribe';
import { SUBSCRIBE_MESSAGES } from '../src/lib/newsletter';
import { resultMessage } from '../src/lib/newsletter-form';

const options = { apiKey: 'key', publicationId: 'pub_123', siteUrl: 'https://joylynnwanjiru.com' };
const request = { email: 'ada+news@example.com', location: 'post' as const, path: '/writing/hello/' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const notFound = () => json({ errors: [{ message: 'Not found' }] }, 404);

describe('subscribe validation', () => {
  it('needs a valid email and keeps only site paths', () => {
    expect(subscribeSchema.safeParse({ email: 'nope' }).success).toBe(false);
    const parsed = subscribeSchema.parse({ email: ' ada@example.com ', location: 'evil', path: 'https://spam.example' });
    expect(parsed).toEqual({ email: 'ada@example.com', location: 'footer', path: '/' });
    expect(subscribeSchema.parse({ email: 'a@b.co', location: 'post', path: '/writing/x/' }).path).toBe('/writing/x/');
  });
});

describe('Beehiiv subscribe (brief 8 and 12.4)', () => {
  it('looks up the email, then creates the subscription with tracking', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(notFound()).mockResolvedValueOnce(json({ data: { id: 'sub_1' } }));
    expect(await subscribe(request, options, fetcher)).toEqual({ result: 'subscribed', status: 200 });

    const [lookupUrl] = fetcher.mock.calls[0] as [string];
    expect(lookupUrl).toBe(`${BEEHIIV_API}/publications/pub_123/subscriptions/by_email/ada%2Bnews%40example.com`);
    const [createUrl, init] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(createUrl).toBe(`${BEEHIIV_API}/publications/pub_123/subscriptions`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'ada+news@example.com',
      reactivate_existing: true,
      utm_source: 'website',
      utm_medium: 'post',
      utm_campaign: '/writing/hello/',
      referring_site: 'https://joylynnwanjiru.com/writing/hello/',
    });
  });

  it('says "already on the list" for an active or pending subscriber, without creating', async () => {
    for (const status of ['active', 'pending', 'validating']) {
      const fetcher = vi.fn().mockResolvedValueOnce(json({ data: { status } }));
      expect((await subscribe(request, options, fetcher)).result).toBe('already');
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('resubscribes someone who unsubscribed', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ data: { status: 'inactive' } }))
      .mockResolvedValueOnce(json({ data: { id: 'sub_1' } }));
    expect((await subscribe(request, options, fetcher)).result).toBe('subscribed');
  });

  it('never reports success unless Beehiiv confirms', async () => {
    const down = vi.fn().mockResolvedValueOnce(notFound()).mockResolvedValueOnce(json({}, 500));
    expect(await subscribe(request, options, down)).toEqual({ result: 'failed', status: 500 });
    const empty = vi.fn().mockResolvedValueOnce(notFound()).mockResolvedValueOnce(json({}));
    expect((await subscribe(request, options, empty)).result).toBe('failed');
    const offline = vi.fn().mockRejectedValue(new Error('network'));
    expect((await subscribe(request, options, offline)).result).toBe('failed');
  });

  it('gives up when Beehiiv is slow (one deadline for both calls)', async () => {
    const slow = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    });
    expect((await subscribe(request, options, slow as unknown as typeof fetch, 20)).result).toBe('failed');
    expect(TIMEOUT_MS).toBe(8000);
  });
});

describe('form messages', () => {
  it('uses the brief 12.4 wording', () => {
    expect(resultMessage('already')).toBe("You're already on the list.");
    expect(resultMessage('failed')).toBe("Couldn't subscribe just now. Please try again, or email me.");
    expect(resultMessage(undefined)).toBe(SUBSCRIBE_MESSAGES.failed);
    expect(resultMessage('failed', 'turnstile')).toMatch(/check/);
  });
});
