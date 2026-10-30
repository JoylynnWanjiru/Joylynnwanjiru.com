import { getCollection } from 'astro:content';
import { getSite } from './site';

export const SITE_URL = 'https://joylynnwanjiru.com';

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

/** Published entries: not drafts. Drafts never reach production output (BR-5). */
export const isPublished = ({ data }: { data: { draft?: boolean } }) => !data.draft;

/** Social image path for a page path: "/" → "/og/index.png", "/writing/x/" → "/og/writing/x.png". */
export function socialImagePath(pathname: string): string {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  return `/og/${trimmed || 'index'}.png`;
}

export interface SocialCard {
  path: string; // page path, e.g. /writing/my-post/
  title: string;
  eyebrow: string; // small label above the title
}

/** Every page that gets its own generated social image (brief section 7). */
export async function socialCards(): Promise<SocialCard[]> {
  const site = await getSite();
  const [posts, steps, projects] = await Promise.all([
    getCollection('posts', isPublished),
    getCollection('steps', isPublished),
    getCollection('projects', isPublished),
  ]);
  return [
    { path: '/', title: site.heroLine, eyebrow: new URL(SITE_URL).hostname },
    ...posts.map((post) => ({ path: `/writing/${post.id}/`, title: post.data.title, eyebrow: 'Writing' })),
    ...steps.map((step) => ({ path: `/steps/${step.id}/`, title: step.data.title, eyebrow: `Step ${step.data.number}` })),
    ...projects.map((project) => ({ path: `/work/${project.id}/`, title: project.data.title, eyebrow: 'Case study' })),
  ];
}

type JsonLdNode = Record<string, unknown>;

export interface Breadcrumb {
  name: string;
  path: string;
}

/** The WebSite + Person nodes on every page, plus breadcrumbs and any page-specific nodes. */
export async function jsonLdGraph(options: { breadcrumbs?: Breadcrumb[]; nodes?: JsonLdNode[] }) {
  const site = await getSite();
  const services = await getCollection('services');
  const person = {
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
    name: site.name,
    url: SITE_URL,
    jobTitle: 'Software Engineer',
    address: { '@type': 'PostalAddress', addressLocality: 'Nairobi', addressCountry: 'KE' },
    sameAs: site.socials.map((social) => social.url),
    knowsAbout: [...services].sort((a, b) => a.data.order - b.data.order).map((service) => service.data.name),
  };
  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: site.name,
    publisher: { '@id': person['@id'] },
  };
  const graph: JsonLdNode[] = [website, person];
  if (options.breadcrumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'Home', path: '/' }, ...options.breadcrumbs].map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      })),
    });
  }
  graph.push(...(options.nodes ?? []));
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" in content. */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

/** CollectionPage + ItemList node for index pages (brief section 7). */
export function collectionPageNode(name: string, path: string, items: { name: string; path: string }[]) {
  return {
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl(path),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  };
}

/** FAQPage node, only when there are questions (brief section 7). */
export function faqPageNode(faq: { question: string; answer: string }[]) {
  if (faq.length === 0) return [];
  return [
    {
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}

/** Service node with the Person as provider (brief section 7). */
export function serviceNode(name: string, description: string, path: string) {
  return {
    '@type': 'Service',
    name,
    description,
    url: absoluteUrl(path),
    provider: { '@id': `${SITE_URL}/#person` },
  };
}
