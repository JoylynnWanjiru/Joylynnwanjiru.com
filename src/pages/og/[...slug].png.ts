import type { APIRoute, GetStaticPaths } from 'astro';
import { renderSocialImage } from '../../lib/og';
import { socialCards, socialImagePath, type SocialCard } from '../../lib/seo';
import { getSite } from '../../lib/site';

// One PNG per page in socialCards(), written at build time.
export const getStaticPaths = (async () => {
  const cards = await socialCards();
  return cards.map((card) => ({
    params: { slug: socialImagePath(card.path).replace(/^\/og\/|\.png$/g, '') },
    props: { card },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ card: SocialCard }> = async ({ props }) => {
  const site = await getSite();
  const base = { name: site.name, signature: site.tagline };
  let png: Buffer;
  try {
    png = await renderSocialImage({ ...base, title: props.card.title, eyebrow: props.card.eyebrow });
  } catch (error) {
    // One bad entry must not break the build: fall back to the site card (brief 12.4).
    console.warn(`[og] Social image for ${props.card.path} failed; using the site card instead.`, error);
    png = await renderSocialImage({ ...base, title: site.heroLine, eyebrow: site.name });
  }
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
