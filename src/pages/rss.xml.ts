import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isPublished, SITE_URL } from '../lib/seo';
import { getSite } from '../lib/site';

// Posts and steps, newest first. Drafts and noindex entries are left out (BR-5, BR-6).
export const GET: APIRoute = async () => {
  const site = await getSite();
  const listed = ({ data }: { data: { draft?: boolean; seo?: { noindex?: boolean } | null } }) =>
    isPublished({ data }) && !data.seo?.noindex;
  const [posts, steps] = await Promise.all([getCollection('posts', listed), getCollection('steps', listed)]);

  const items = [
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/writing/${post.id}/`,
      categories: post.data.tags,
    })),
    ...steps.map((step) => ({
      title: `Step ${step.data.number}: ${step.data.title}`,
      description: step.data.summary,
      pubDate: step.data.date,
      link: `/steps/${step.id}/`,
      categories: step.data.tags,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: `${site.name}: writing and steps`,
    description: site.heroLine,
    site: SITE_URL,
    items,
  });
};
