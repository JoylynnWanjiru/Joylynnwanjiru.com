import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { imagesWithoutAlt, redirectRules, stepNumberProblems } from '../../../build/checks.mjs';
import publishedUrls from '../../../published-urls.json';

// Build-time only: enforces the content rules (BR-9, BR-10, BR-11 conflicts) and
// tells the build-rules integration which pages are hidden or redirected.
// The integration deletes this file from the output after reading it.

type Entry = {
  path: string;
  section: string;
  draft: boolean;
  noindex: boolean;
  redirectFrom: string[];
  body?: string;
  label: string;
};

export const GET: APIRoute = async () => {
  const [posts, steps, projects] = await Promise.all([
    getCollection('posts'),
    getCollection('steps'),
    getCollection('projects'),
  ]);

  const entries: Entry[] = [
    ...posts.map((p) => ({ section: '/writing/', id: p.id, data: p.data, body: p.body, label: `Post "${p.data.title}"` })),
    ...steps.map((s) => ({ section: '/steps/', id: s.id, data: s.data, body: s.body, label: `Step "${s.data.title}"` })),
    ...projects.map((p) => ({ section: '/work/', id: p.id, data: p.data, body: p.body, label: `Project "${p.data.title}"` })),
  ].map(({ section, id, data, body, label }) => ({
    path: `${section}${id}/`,
    section,
    draft: data.draft,
    noindex: Boolean(data.seo?.noindex),
    redirectFrom: data.redirectFrom,
    body,
    label,
  }));

  // Singleton pages that can be noindexed in the editor.
  const pages = await Promise.all(
    (
      [
        ['home', '/'],
        ['about', '/about/'],
        ['start', '/start/'],
        ['workWithMe', '/work-with-me/'],
      ] as const
    ).map(async ([collection, path]) => {
      const entry = await getEntry(collection, collection === 'workWithMe' ? 'work-with-me' : collection);
      return { path, noindex: Boolean(entry?.data.seo?.noindex) };
    }),
  );

  const published = entries.filter((entry) => !entry.draft);
  const problems = [
    ...stepNumberProblems(steps.filter((s) => !s.data.draft).map((s) => s.data.number)),
    ...published.flatMap((entry) =>
      imagesWithoutAlt(entry.body ?? '').map((image) => `${entry.label} has an image without alt text: ${image}`),
    ),
  ];
  const redirects = redirectRules(published, publishedUrls.redirects);
  problems.push(...redirects.problems);

  if (problems.length > 0) {
    throw new Error(`Build rules failed:\n- ${problems.join('\n- ')}`);
  }

  return Response.json({
    hidden: [
      ...entries.filter((e) => e.draft).map((e) => ({ path: e.path, reason: 'draft' })),
      ...published.filter((e) => e.noindex).map((e) => ({ path: e.path, reason: 'noindex' })),
      ...pages.filter((p) => p.noindex).map((p) => ({ path: p.path, reason: 'noindex' })),
    ],
    redirects: redirects.rules,
  });
};
