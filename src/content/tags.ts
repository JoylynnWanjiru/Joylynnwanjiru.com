import { slugify } from '../lib/slug';

// The fixed tag list for posts and steps (brief section 4). Shared by Keystatic
// (editor options) and the Astro schemas (validation), so they cannot drift.
// TODO(joylynn): confirm or replace this list. Seeded from the topics named in brief section 1.
export const TAG_LABELS = ['AI', 'Backend', 'Products', 'Entrepreneurship', 'Photography'] as const;

export const TAGS = TAG_LABELS.map((label) => ({ label, value: slugify(label) }));
export const TAG_VALUES = TAGS.map((tag) => tag.value) as [string, ...string[]];
