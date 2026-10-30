import { getCollection } from 'astro:content';
import { newestFirst } from './collections';

// Drafts are previewable in `astro dev` only (BR-5).
const visible = ({ data }: { data: { draft?: boolean } }) => import.meta.env.DEV || !data.draft;

/** Posts that render on this build, newest first. */
export const getPosts = async () => newestFirst(await getCollection('posts', visible));

/** Steps that render on this build, newest (highest number) first. */
export const getSteps = async () =>
  (await getCollection('steps', visible)).sort((a, b) => b.data.number - a.data.number);
