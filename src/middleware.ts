import { defineMiddleware } from 'astro:middleware';

// Headers for responses the Worker generates (the editor and its API). Cloudflare's
// _headers file only covers static pages, which build/build-rules.mjs handles.
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const { pathname } = context.url;
  if (!pathname.startsWith('/keystatic') && !pathname.startsWith('/api/')) return response;

  // Copy first: some responses (redirects, fetched assets) have read-only headers.
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
