import { slugify } from './slug';
import { TAGS } from '../content/tags';

// Pure helpers for listing posts and steps. Pages fetch with getCollection and
// pass the entries in, so these stay testable without an Astro build.

/** Posts on each writing index page (brief section 5). */
export const PAGE_SIZE = 9;

interface Dated {
  data: { date: Date };
}

/** Newest first. Ties keep a stable order by id so builds are deterministic. */
export function newestFirst<T extends Dated & { id: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

/** Page n (1-based) of a list, plus the page count (always at least 1, so an empty index still renders). */
export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  return { items: items.slice((page - 1) * size, page * size), page, totalPages };
}

/** URL of a writing index page: page 1 is /writing/, later pages /writing/page/n/. */
export function writingPagePath(page: number): string {
  return page <= 1 ? '/writing/' : `/writing/page/${page}/`;
}

/** Tags used by at least one entry, in the fixed tag-list order, with labels. */
export function tagsInUse(entries: { data: { tags: string[] } }[]) {
  const used = new Set(entries.flatMap((entry) => entry.data.tags));
  return TAGS.filter((tag) => used.has(tag.value));
}

export function tagLabel(value: string): string {
  return TAGS.find((tag) => tag.value === value)?.label ?? value;
}

/** Series names in use, each with its URL slug, sorted by name. */
export function seriesInUse(entries: { data: { series?: string | null } }[]) {
  const names = new Set(entries.map((entry) => entry.data.series?.trim()).filter((name): name is string => !!name));
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name, slug: slugify(name) }));
}

/** Previous (older) and next (newer) step by step number. */
export function stepNeighbours<T extends { data: { number: number } }>(steps: T[], current: T) {
  const ordered = [...steps].sort((a, b) => a.data.number - b.data.number);
  const index = ordered.indexOf(current);
  return { previous: ordered[index - 1], next: ordered[index + 1] };
}

/** Ids of confidential projects that still have links filled in. The links never render (BR-4); the build warns. */
export function confidentialWithLinks(
  projects: { id: string; data: { confidential: boolean; links?: { live?: string | null; repo?: string | null } } }[],
): string[] {
  return projects
    .filter(({ data }) => data.confidential && (data.links?.live || data.links?.repo))
    .map(({ id }) => id);
}
