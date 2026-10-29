import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl, isPublished } from '../lib/seo';
import { getSite } from '../lib/site';

// llms.txt (llmstxt.org): a plain summary of the site and its recent writing.
// Built only from site settings and content, so it never states anything new.
// Drafts and noindex entries are left out (BR-5, BR-6).
export const GET: APIRoute = async () => {
  const site = await getSite();
  const listed = ({ data }: { data: { draft?: boolean; seo?: { noindex?: boolean } | null } }) =>
    isPublished({ data }) && !data.seo?.noindex;
  const [posts, steps, projects, services] = await Promise.all([
    getCollection('posts', listed),
    getCollection('steps', listed),
    getCollection('projects', listed),
    getCollection('services'),
  ]);

  const writing = [
    ...posts.map((post) => ({ date: post.data.date, line: `- [${post.data.title}](${absoluteUrl(`/writing/${post.id}/`)}): ${post.data.description}` })),
    ...steps.map((step) => ({ date: step.data.date, line: `- [Step ${step.data.number}: ${step.data.title}](${absoluteUrl(`/steps/${step.id}/`)}): ${step.data.summary}` })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 20)
    .map((entry) => entry.line);

  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.heroLine}`,
    '',
    `Software engineer based in ${site.location} (${site.timeZone}).`,
    '',
    '## Pages',
    `- [Start here](${absoluteUrl('/start/')})`,
    `- [Writing](${absoluteUrl('/writing/')})`,
    `- [Steps](${absoluteUrl('/steps/')})`,
    `- [Work](${absoluteUrl('/work/')})`,
    `- [About](${absoluteUrl('/about/')})`,
    `- [Work with me](${absoluteUrl('/work-with-me/')})`,
    '',
    '## Services',
    ...[...services]
      .sort((a, b) => a.data.order - b.data.order)
      .map((service) => `- [${service.data.name}](${absoluteUrl(`/work-with-me/${service.id}/`)}): ${service.data.oneLiner}`),
    '',
    '## Case studies',
    ...(projects.length ? projects.map((project) => `- [${project.data.title}](${absoluteUrl(`/work/${project.id}/`)}): ${project.data.oneLiner}`) : ['- Coming soon.']),
    '',
    '## Recent writing',
    ...(writing.length ? writing : ['- Coming soon.']),
    '',
  ];

  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
