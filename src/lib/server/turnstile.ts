// Server-side Turnstile check (BR-12). Verified against Cloudflare's docs on 31 October 2026:
// POST form or JSON to siteverify; tokens are at most 2,048 characters, last 300 seconds
// and can be verified only once (a replay returns `timeout-or-duplicate`).

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TOKEN_FIELD = 'cf-turnstile-response';
const MAX_TOKEN_LENGTH = 2048;

export type TurnstileResult = { ok: true } | { ok: false; codes: string[] };

/** Never throws: a network failure counts as "not verified", so no form is processed (BR-12). */
export async function verifyTurnstile(
  token: string | undefined,
  secret: string,
  ip: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!token) return { ok: false, codes: ['missing-input-response'] };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, codes: ['invalid-input-response'] };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetcher(SITEVERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
    const result = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
    return result.success === true ? { ok: true } : { ok: false, codes: result['error-codes'] ?? [] };
  } catch {
    return { ok: false, codes: ['siteverify-unreachable'] };
  }
}
