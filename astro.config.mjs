// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import keystatic from '@keystatic/astro';

// Keystatic local mode needs Node.js file access, but with the Cloudflare
// adapter `astro dev` runs in workerd. So dev runs on Node without the
// adapter; builds and previews use the adapter.
const isDev = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  site: 'https://joylynnwanjiru.com',
  output: 'static',
  // 'compile' optimises images with sharp at build time (brief section 2),
  // instead of the adapter default that resizes at request time.
  adapter: isDev ? undefined : cloudflare({ imageService: 'compile' }),
  // No Astro sessions; stops the adapter provisioning a KV namespace.
  session: false,
  integrations: [react(), mdx(), keystatic()],
});
