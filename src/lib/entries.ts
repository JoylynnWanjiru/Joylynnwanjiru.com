import { getCollection } from 'astro:content';
import { newestFirst } from './collections';

// Drafts are previewable in `astro dev` only (BR-5).
const visible = ({ data }: { data: { draft?: boolean } }) => import.meta.env.DEV || !data.draft;

/** Posts that render on this build, newest first. */
export const getPosts = async () => newestFirst(await getCollection('posts', visible));

/** Steps that render on this build, newest (highest number) first. */
export const getSteps = async () =>
  (await getCollection('steps', visible)).sort((a, b) => b.data.number - a.data.number);

/** Projects that render on this build: featured first, then by order, then title. */
export const getProjects = async () =>
  (await getCollection('projects', visible)).sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title),
  );

/** Services in their editor order. */
export const getServices = async () => (await getCollection('services')).sort((a, b) => a.data.order - b.data.order);

/** Experience timeline: by order, then most recent start first. */
export const getExperience = async () =>
  (await getCollection('experience')).sort(
    (a, b) => a.data.order - b.data.order || b.data.start.getTime() - a.data.start.getTime(),
  );

/** Testimonials that may render: permission must be true (BR-3). */
export const getTestimonials = async () => getCollection('testimonials', ({ data }) => data.permission);
