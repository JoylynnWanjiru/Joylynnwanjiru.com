import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/seo';

// Search and AI crawlers are welcome; the editor is not for crawling (brief 7, 12.5).
export const GET: APIRoute = () =>
  new Response(
    ['User-agent: *', 'Allow: /', 'Disallow: /keystatic', 'Disallow: /api/', '', `Sitemap: ${SITE_URL}/sitemap-index.xml`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
