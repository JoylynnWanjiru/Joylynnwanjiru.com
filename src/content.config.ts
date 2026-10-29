import { defineCollection, reference, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TAG_VALUES } from './content/tags';

// Content schemas (brief section 4). keystatic.config.ts describes the same
// fields for the editor; test/content-drift.test.ts fails if the two drift.

type ImageHelper = SchemaContext['image'];

// Keystatic writes empty optional fields as null; accept both null and absent.
const optionalText = () => z.string().nullable().optional();
const optionalUrl = () => z.url().nullable().optional();
const optionalDate = () => z.coerce.date().nullable().optional();

const faq = () => z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]);

// Shared SEO group on every post, step, project and page.
const seo = (image: ImageHelper) =>
  z
    .object({
      title: z.string().max(60).nullable().optional(),
      description: z.string().max(155).nullable().optional(),
      focusKeyword: optionalText(),
      canonical: optionalUrl(),
      noindex: z.boolean().default(false),
      ogImage: image().nullable().optional(),
      faq: faq(),
    })
    .optional();

const tags = () => z.array(z.enum(TAG_VALUES)).default([]);
const redirectFrom = () => z.array(z.string()).default([]);

// Alt text is required whenever a cover image is set (BR-10).
const requireCoverAlt = (data: { cover?: unknown; coverAlt?: string | null }, ctx: z.RefinementCtx) => {
  if (data.cover && !data.coverAlt?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'Alt text is required when a cover image is set.' });
  }
};

const posts = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        description: z.string().min(1).max(155),
        date: z.coerce.date(),
        updated: optionalDate(),
        tags: tags(),
        series: optionalText(),
        cover: image().nullable().optional(),
        coverAlt: optionalText(),
        draft: z.boolean().default(true),
        featured: z.boolean().default(false),
        services: z.array(reference('services')).default([]),
        redirectFrom: redirectFrom(),
        seo: seo(image),
      })
      .superRefine(requireCoverAlt),
});

const steps = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/steps' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      number: z.number().int().positive(),
      date: z.coerce.date(),
      tags: tags(),
      summary: z.string().min(1).max(160),
      draft: z.boolean().default(true),
      redirectFrom: redirectFrom(),
      seo: seo(image),
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        kind: z.enum(['client', 'product', 'programme', 'personal']),
        oneLiner: z.string().min(1).max(140),
        year: z.number().int().nullable().optional(),
        role: z.string().min(1),
        team: z.array(z.object({ name: z.string().min(1), link: optionalUrl() })).default([]),
        context: optionalText(),
        services: z.array(reference('services')).default([]),
        stack: z.array(z.string()).default([]),
        outcome: optionalText(),
        links: z.object({ live: optionalUrl(), repo: optionalUrl() }).optional(),
        confidential: z.boolean().default(false),
        cover: image().nullable().optional(),
        coverAlt: optionalText(),
        gallery: z.array(z.object({ image: image(), alt: z.string().min(1) })).default([]),
        draft: z.boolean().default(true),
        featured: z.boolean().default(false),
        order: z.number().int().default(0),
        redirectFrom: redirectFrom(),
        seo: seo(image),
      })
      .superRefine(requireCoverAlt),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/experience' }),
  schema: z.object({
    organisation: z.string().min(1),
    url: optionalUrl(),
    role: z.string().min(1),
    start: z.coerce.date(),
    end: optionalDate(), // empty means "present"
    location: optionalText(),
    highlights: z.array(z.string()).default([]),
    order: z.number().int().default(0),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/services' }),
  schema: z.object({
    name: z.string().min(1),
    oneLiner: z.string().min(1),
    includes: z.array(z.string()).default([]),
    buttonLabel: z.string().min(1),
    order: z.number().int().default(0),
    faq: faq(),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/testimonials' }),
  schema: z.object({
    quote: z.string().min(1),
    name: z.string().min(1),
    role: optionalText(),
    organisation: optionalText(),
    link: optionalUrl(),
    project: reference('projects').nullable().optional(),
    permission: z.boolean().default(false), // must be true to render (BR-3)
  }),
});

// Singletons: one file each, edited under Settings and Pages in Keystatic.
const singleton = (base: string, file: string) => glob({ pattern: file, base });

const site = defineCollection({
  loader: singleton('./src/content/settings', 'site.json'),
  schema: z.object({
    name: z.string().min(1),
    tagline: z.string().min(1),
    heroLine: z.string().min(1),
    email: z.string().min(1),
    location: z.string().min(1),
    timeZone: z.string().min(1),
    socials: z.array(z.object({ label: z.string().min(1), url: z.url() })).default([]),
    bookingLinks: z.object({ freeCall: optionalUrl(), audit: optionalUrl() }),
    currency: z.string().min(1),
    auditPrice: z.number().positive(),
    buildFrom: z.number().positive(),
    deposit: z.number().int().min(1).max(100),
    analytics: z.object({ cloudflareToken: optionalText(), eventTrackerId: optionalText() }),
    verification: z.object({ google: optionalText(), bing: optionalText() }),
    beehiivPublicationId: optionalText(),
  }),
});

const seoDefaults = defineCollection({
  loader: singleton('./src/content/settings', 'seo.json'),
  schema: ({ image }) =>
    z.object({
      description: z.string().min(1).max(155),
      ogImage: image().nullable().optional(),
    }),
});

const home = defineCollection({
  loader: singleton('./src/content/pages', 'home.yaml'),
  schema: ({ image }) =>
    z.object({
      portrait: image().nullable().optional(),
      portraitAlt: optionalText(),
      seo: seo(image),
    }),
});

const about = defineCollection({
  loader: singleton('./src/content/pages', 'about.mdx'),
  schema: ({ image }) =>
    z.object({
      shortBio: z.string().min(1),
      education: z.array(z.object({ institution: z.string().min(1), qualification: optionalText(), years: optionalText() })).default([]),
      timeline: z.array(z.object({ when: z.string().min(1), what: z.string().min(1) })).default([]),
      photographyNote: optionalText(),
      photo: image().nullable().optional(),
      photoAlt: optionalText(),
      seo: seo(image),
    }),
});

const now = defineCollection({
  loader: singleton('./src/content/pages', 'now.yaml'),
  schema: z.object({
    updated: z.coerce.date(),
    focus: z.string().min(1),
    building: z.string().min(1),
    learning: z.string().min(1),
  }),
});

const start = defineCollection({
  loader: singleton('./src/content/pages', 'start.yaml'),
  schema: ({ image }) =>
    z.object({
      intro: z.string().min(1),
      bestPosts: z.array(reference('posts')).max(3).default([]),
      bestCaseStudy: reference('projects').nullable().optional(),
      seo: seo(image),
    }),
});

const workWithMe = defineCollection({
  loader: singleton('./src/content/pages', 'work-with-me.yaml'),
  schema: ({ image }) =>
    z.object({
      faq: faq(),
      seo: seo(image),
    }),
});

export const collections = {
  posts,
  steps,
  projects,
  experience,
  services,
  testimonials,
  site,
  seoDefaults,
  home,
  about,
  now,
  start,
  workWithMe,
};
