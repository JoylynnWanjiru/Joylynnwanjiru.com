// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Keystatic local mode needs Node.js file access, but with the Cloudflare
// adapter `astro dev` runs in workerd. So dev runs on Node without the
// adapter; builds and previews use the adapter.
const isDev = process.argv.includes('dev');

// Self-hosted fonts from the brief's Fontsource packages, Latin subset only.
/** @param {string} pkg @param {string} file */
const fontFile = (pkg, file) => `./node_modules/${pkg}/files/${file}`;

// https://astro.build/config
export default defineConfig({
  site: 'https://joylynnwanjiru.com',
  output: 'static',
  // 'compile' optimises images with sharp at build time (brief section 2),
  // instead of the adapter default that resizes at request time.
  // Static pages prerender in Node: the social image generator uses
  // @resvg/resvg-js (a native addon) and reads font files from disk.
  adapter: isDev ? undefined : cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' }),
  // No Astro sessions; stops the adapter provisioning a KV namespace.
  session: false,
  integrations: [
    react(),
    mdx(),
    keystatic(),
    // sitemap-index.xml; noindex pages are also removed by the build rules (BR-6).
    sitemap({ filter: (page) => !/\/(keystatic|404)(\/|$)/.test(new URL(page).pathname) }),
  ],
  vite: { plugins: [tailwindcss()] },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Plus Jakarta Sans',
      cssVariable: '--font-jakarta',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            weight: '200 800',
            style: 'normal',
            display: 'swap',
            src: [fontFile('@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2')],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            weight: '100 900',
            style: 'normal',
            display: 'swap',
            src: [fontFile('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2')],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains',
      fallbacks: ['monospace'],
      options: {
        variants: [
          {
            weight: '400',
            style: 'normal',
            display: 'swap',
            src: [fontFile('@fontsource/jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff2')],
          },
        ],
      },
    },
  ],
});
