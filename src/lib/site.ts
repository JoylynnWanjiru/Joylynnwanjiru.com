import { getEntry } from 'astro:content';

// Site settings come from the Keystatic singleton (src/content/settings/site.json),
// so names, contact details and prices are edited in one place (BR-7).
export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('Missing site settings: src/content/settings/site.json');
  return entry.data;
}

export const nav = [
  { href: '/writing', label: 'Writing' },
  { href: '/steps', label: 'Steps' },
  { href: '/work', label: 'Work' },
  { href: '/about', label: 'About' },
] as const;

export const workWithMe = { href: '/work-with-me', label: 'Work with me' } as const;
