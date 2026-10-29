import { collection, config, fields, singleton } from '@keystatic/core';
import { TAGS } from './src/content/tags';

// Editor for the content model in brief section 4. src/content.config.ts holds
// the matching Astro schemas; test/content-drift.test.ts fails if they drift.
// Local mode in development, GitHub mode in production builds.
// PUBLIC_KEYSTATIC_STORAGE=github forces GitHub mode in dev, which is needed
// once to create the GitHub App (Keystatic writes its secrets to .env).
const useGitHub = import.meta.env.PROD || import.meta.env.PUBLIC_KEYSTATIC_STORAGE === 'github';

// Images live in src/assets so they go through astro:assets; publicPath uses
// the @assets alias so Astro's image() helper resolves them.
const images = (folder: string) => ({
  directory: `src/assets/images/${folder}`,
  publicPath: `@assets/images/${folder}/`,
});

const faq = () =>
  fields.array(
    fields.object({
      question: fields.text({ label: 'Question', validation: { length: { min: 1 } } }),
      answer: fields.text({ label: 'Answer', multiline: true, validation: { length: { min: 1 } } }),
    }),
    { label: 'FAQ', itemLabel: (props) => props.fields.question.value || 'New question' },
  );

const seo = () =>
  fields.object(
    {
      title: fields.text({
        label: 'SEO title',
        description: 'Optional, 60 characters max. Falls back to the title.',
        validation: { length: { max: 60 } },
      }),
      description: fields.text({
        label: 'SEO description',
        description: '155 characters max. Falls back to the description or summary.',
        multiline: true,
        validation: { length: { max: 155 } },
      }),
      focusKeyword: fields.text({ label: 'Focus keyword', description: 'A hint for writing; not added to the page.' }),
      canonical: fields.url({ label: 'Canonical URL', description: 'Only for pieces first published elsewhere.' }),
      noindex: fields.checkbox({ label: 'Hide from search engines (noindex)', defaultValue: false }),
      ogImage: fields.image({
        label: 'Social image',
        description: 'Optional. One is generated automatically if empty.',
        ...images('og'),
      }),
      faq: faq(),
    },
    { label: 'SEO' },
  );

const tags = () => fields.multiselect({ label: 'Tags', options: TAGS, defaultValue: [] });

const redirectFrom = () =>
  fields.array(fields.text({ label: 'Old slug' }), {
    label: 'Redirect from',
    description: 'Old slugs that should redirect here. Added when a slug changes.',
    itemLabel: (props) => props.value,
  });

const draft = () =>
  fields.checkbox({ label: 'Draft', description: 'Drafts never appear on the live site.', defaultValue: true });

const coverFields = (folder: string) => ({
  cover: fields.image({ label: 'Cover image', ...images(folder) }),
  coverAlt: fields.text({ label: 'Cover alt text', description: 'Required when a cover image is set.' }),
});

const mdxBody = (folder: string, description?: string) =>
  fields.mdx({ label: 'Body', description, options: { image: images(folder) } });

export default config({
  storage: useGitHub ? { kind: 'github', repo: 'JoylynnWanjiru/Joylynnwanjiru.com' } : { kind: 'local' },
  ui: {
    brand: { name: 'joylynnwanjiru.com' },
    navigation: {
      Writing: ['posts', 'steps'],
      Work: ['projects', 'experience'],
      Pages: ['home', 'about', 'now', 'start', 'workWithMe'],
      Business: ['services', 'testimonials'],
      Settings: ['site', 'seoDefaults'],
    },
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          description: '155 characters max.',
          multiline: true,
          validation: { length: { min: 1, max: 155 } },
        }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        updated: fields.date({ label: 'Updated', description: 'Set when a published post changes.' }),
        tags: tags(),
        series: fields.text({ label: 'Series', description: 'Optional.' }),
        ...coverFields('posts'),
        draft: draft(),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        services: fields.multiRelationship({ label: 'Related services', collection: 'services' }),
        redirectFrom: redirectFrom(),
        seo: seo(),
        body: mdxBody('posts'),
      },
    }),
    steps: collection({
      label: 'Steps',
      slugField: 'title',
      path: 'src/content/steps/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['title', 'number', 'date'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        number: fields.integer({
          label: 'Step number',
          description: 'The next number after the latest step. The build fails on a gap or duplicate.',
          validation: { isRequired: true, min: 1 },
        }),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        tags: tags(),
        summary: fields.text({ label: 'Summary', description: 'One line.', validation: { length: { min: 1, max: 160 } } }),
        draft: draft(),
        redirectFrom: redirectFrom(),
        seo: seo(),
        body: mdxBody('steps', '150–300 words recommended.'),
      },
    }),
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      columns: ['title', 'kind'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        kind: fields.select({
          label: 'Kind',
          options: [
            { label: 'Client work', value: 'client' },
            { label: 'Product', value: 'product' },
            { label: 'Programme', value: 'programme' },
            { label: 'Personal', value: 'personal' },
          ],
          defaultValue: 'client',
        }),
        oneLiner: fields.text({ label: 'One-liner', validation: { length: { min: 1, max: 140 } } }),
        year: fields.integer({ label: 'Year' }),
        role: fields.text({ label: 'Role', validation: { length: { min: 1 } } }),
        team: fields.array(
          fields.object({ name: fields.text({ label: 'Name' }), link: fields.url({ label: 'Link' }) }),
          { label: 'Team', itemLabel: (props) => props.fields.name.value || 'Team member' },
        ),
        context: fields.text({ label: 'Context', description: 'Client, partner or programme.' }),
        services: fields.multiRelationship({ label: 'Services', collection: 'services' }),
        stack: fields.array(fields.text({ label: 'Technology' }), { label: 'Stack', itemLabel: (props) => props.value }),
        outcome: fields.text({ label: 'Outcome', multiline: true, description: 'Numbers only if they are real.' }),
        links: fields.object(
          { live: fields.url({ label: 'Live site' }), repo: fields.url({ label: 'Repository' }) },
          { label: 'Links' },
        ),
        confidential: fields.checkbox({
          label: 'Confidential',
          description: 'Hides all links and shows "Private project".',
          defaultValue: false,
        }),
        ...coverFields('projects'),
        gallery: fields.array(
          fields.object({
            image: fields.image({ label: 'Image', validation: { isRequired: true }, ...images('projects') }),
            alt: fields.text({ label: 'Alt text', validation: { length: { min: 1 } } }),
          }),
          { label: 'Gallery', itemLabel: (props) => props.fields.alt.value || 'Image' },
        ),
        draft: draft(),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
        redirectFrom: redirectFrom(),
        seo: seo(),
        body: mdxBody('projects', 'Sections: Problem, What I built, How it works, Result, What I learned.'),
      },
    }),
    experience: collection({
      label: 'Experience',
      slugField: 'organisation',
      path: 'src/content/experience/*',
      format: { data: 'yaml' },
      columns: ['organisation', 'role'],
      schema: {
        organisation: fields.slug({ name: { label: 'Organisation' } }),
        url: fields.url({ label: 'Website' }),
        role: fields.text({ label: 'Role', validation: { length: { min: 1 } } }),
        start: fields.date({ label: 'Start', validation: { isRequired: true } }),
        end: fields.date({ label: 'End', description: 'Leave empty for "present".' }),
        location: fields.text({ label: 'Location', description: 'For example "Nairobi" or "Remote".' }),
        highlights: fields.array(fields.text({ label: 'Highlight' }), {
          label: 'Highlights',
          itemLabel: (props) => props.value,
        }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
    services: collection({
      label: 'Services',
      slugField: 'name',
      path: 'src/content/services/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        oneLiner: fields.text({ label: 'One-liner', validation: { length: { min: 1 } } }),
        includes: fields.array(fields.text({ label: 'Item' }), { label: 'Includes', itemLabel: (props) => props.value }),
        buttonLabel: fields.text({ label: 'Button label', validation: { length: { min: 1 } } }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
        faq: faq(),
        body: mdxBody('services', "Who it's for and how it works."),
      },
    }),
    testimonials: collection({
      label: 'Testimonials',
      slugField: 'name',
      path: 'src/content/testimonials/*',
      format: { data: 'yaml' },
      columns: ['name', 'organisation'],
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        quote: fields.text({ label: 'Quote', multiline: true, validation: { length: { min: 1 } } }),
        role: fields.text({ label: 'Role' }),
        organisation: fields.text({ label: 'Organisation' }),
        link: fields.url({ label: 'Link' }),
        project: fields.relationship({ label: 'Project', collection: 'projects' }),
        permission: fields.checkbox({
          label: 'Permission to publish',
          description: 'The testimonial only appears when this is ticked.',
          defaultValue: false,
        }),
      },
    }),
  },
  singletons: {
    site: singleton({
      label: 'Site settings',
      path: 'src/content/settings/site',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Name', validation: { length: { min: 1 } } }),
        tagline: fields.text({ label: 'Signature line', validation: { length: { min: 1 } } }),
        heroLine: fields.text({ label: 'Hero line', validation: { length: { min: 1 } } }),
        email: fields.text({ label: 'Contact email', validation: { length: { min: 1 } } }),
        location: fields.text({ label: 'Location', validation: { length: { min: 1 } } }),
        timeZone: fields.text({ label: 'Time zone', validation: { length: { min: 1 } } }),
        socials: fields.array(
          fields.object({
            label: fields.text({ label: 'Label', validation: { length: { min: 1 } } }),
            url: fields.url({ label: 'URL', validation: { isRequired: true } }),
          }),
          { label: 'Social links', itemLabel: (props) => props.fields.label.value || 'Link' },
        ),
        bookingLinks: fields.object(
          { freeCall: fields.url({ label: 'Free call (Cal.com)' }), audit: fields.url({ label: 'Audit (Cal.com)' }) },
          { label: 'Booking links' },
        ),
        currency: fields.text({ label: 'Currency', defaultValue: 'USD' }),
        auditPrice: fields.integer({ label: 'Audit price', validation: { isRequired: true, min: 1 } }),
        buildFrom: fields.integer({ label: 'Builds start from', validation: { isRequired: true, min: 1 } }),
        deposit: fields.integer({ label: 'Deposit (%)', validation: { isRequired: true, min: 1, max: 100 } }),
        analytics: fields.object(
          {
            cloudflareToken: fields.text({ label: 'Cloudflare Web Analytics token' }),
            eventTrackerId: fields.text({ label: 'Event tracker ID' }),
          },
          { label: 'Analytics' },
        ),
        verification: fields.object(
          { google: fields.text({ label: 'Google Search Console' }), bing: fields.text({ label: 'Bing Webmaster Tools' }) },
          { label: 'Search engine verification codes' },
        ),
        beehiivPublicationId: fields.text({
          label: 'Beehiiv publication ID',
          description: 'The API key stays in Cloudflare secrets, never here.',
        }),
      },
    }),
    seoDefaults: singleton({
      label: 'SEO defaults',
      path: 'src/content/settings/seo',
      format: { data: 'json' },
      schema: {
        description: fields.text({
          label: 'Default description',
          multiline: true,
          validation: { length: { min: 1, max: 155 } },
        }),
        ogImage: fields.image({ label: 'Default social image', ...images('og') }),
      },
    }),
    home: singleton({
      label: 'Home',
      path: 'src/content/pages/home',
      schema: {
        portrait: fields.image({ label: 'Portrait', ...images('pages') }),
        portraitAlt: fields.text({ label: 'Portrait alt text' }),
        seo: seo(),
      },
    }),
    about: singleton({
      label: 'About',
      path: 'src/content/pages/about',
      format: { contentField: 'body' },
      entryLayout: 'content',
      schema: {
        shortBio: fields.text({ label: 'Short bio', multiline: true, validation: { length: { min: 1 } } }),
        education: fields.array(
          fields.object({
            institution: fields.text({ label: 'Institution' }),
            qualification: fields.text({ label: 'Qualification' }),
            years: fields.text({ label: 'Years' }),
          }),
          { label: 'Education', itemLabel: (props) => props.fields.institution.value || 'Education' },
        ),
        timeline: fields.array(
          fields.object({ when: fields.text({ label: 'When' }), what: fields.text({ label: 'What' }) }),
          { label: 'Timeline', itemLabel: (props) => props.fields.when.value || 'Event' },
        ),
        photographyNote: fields.text({ label: 'Photography note', multiline: true }),
        photo: fields.image({ label: 'Photo', ...images('pages') }),
        photoAlt: fields.text({ label: 'Photo alt text' }),
        seo: seo(),
        body: mdxBody('pages', 'The long bio.'),
      },
    }),
    now: singleton({
      label: 'Now',
      path: 'src/content/pages/now',
      schema: {
        updated: fields.date({ label: 'Last updated', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        focus: fields.text({ label: 'Current focus', multiline: true, validation: { length: { min: 1 } } }),
        building: fields.text({ label: "What I'm building", multiline: true, validation: { length: { min: 1 } } }),
        learning: fields.text({ label: "What I'm learning", multiline: true, validation: { length: { min: 1 } } }),
      },
    }),
    start: singleton({
      label: 'Start here',
      path: 'src/content/pages/start',
      schema: {
        intro: fields.text({ label: 'Intro', multiline: true, validation: { length: { min: 1 } } }),
        bestPosts: fields.multiRelationship({
          label: 'Three best posts',
          collection: 'posts',
          validation: { length: { max: 3 } },
        }),
        bestCaseStudy: fields.relationship({ label: 'Best case study', collection: 'projects' }),
        seo: seo(),
      },
    }),
    workWithMe: singleton({
      label: 'Work with me',
      path: 'src/content/pages/work-with-me',
      schema: {
        faq: faq(),
        seo: seo(),
      },
    }),
  },
});
