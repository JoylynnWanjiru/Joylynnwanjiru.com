import { config, collection, fields } from '@keystatic/core';

// SPIKE: minimal config to prove Keystatic runs on the Cloudflare adapter.
// Local mode in development, GitHub mode in production builds.
// PUBLIC_KEYSTATIC_STORAGE=github forces GitHub mode in dev, which is needed
// once to create the GitHub App (Keystatic writes its secrets to .env).
const useGitHub = import.meta.env.PROD || import.meta.env.PUBLIC_KEYSTATIC_STORAGE === 'github';
const imageDir = 'src/assets/images/posts';
const imagePublicPath = '@assets/images/posts/';

export default config({
  storage: useGitHub
    ? { kind: 'github', repo: 'JoylynnWanjiru/Joylynnwanjiru.com' }
    : { kind: 'local' },
  ui: { brand: { name: 'joylynnwanjiru.com' } },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'body' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          validation: { length: { min: 1, max: 155 } },
        }),
        cover: fields.image({
          label: 'Cover image',
          directory: imageDir,
          publicPath: imagePublicPath,
        }),
        coverAlt: fields.text({ label: 'Cover alt text' }),
        body: fields.mdx({
          label: 'Body',
          options: { image: { directory: imageDir, publicPath: imagePublicPath } },
        }),
      },
    }),
  },
});
