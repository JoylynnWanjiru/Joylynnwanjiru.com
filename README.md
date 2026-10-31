# joylynnwanjiru.com

Source for Joylynn Wanjiru's personal site: writing, a weekly Steps log, case studies and a way to work with her. `BUILD_BRIEF.md` is the full specification; this file describes only what is in the repo today.

**Status:** Phase 2 (pages) of the build plan in brief section 9. Every page route exists with plain markup and visible placeholders; the visual pass against the design mockups is still to come. Phase 3 (integrations) is in progress: the contact and newsletter forms send once their accounts' keys are set on Cloudflare; until then they answer "not configured".

## Pages

| URL | Page |
| --- | --- |
| `/` | Home |
| `/start/` | Start here (editor-picked posts and case study) |
| `/writing/`, `/writing/page/[n]/`, `/writing/tags/[tag]/`, `/writing/series/[series]/`, `/writing/[slug]/` | Writing index (9 per page), tag and series pages, posts |
| `/steps/`, `/steps/[slug]/` | Steps log |
| `/work/`, `/work/[slug]/` | Work index (service filter without JavaScript, experience timeline) and case studies |
| `/about/` | About + Now (`#now`); `/now` redirects there |
| `/work-with-me/`, `/work-with-me/[service]/` | Services, One Step Audit, Kadi, service pages |
| `/contact/` | Contact form (posts to `/api/contact`) |
| `/thanks/`, `/thanks/call/`, `/thanks/kadi/`, `/contact/error/` | Contact confirmations (BR-1, BR-2) and the no-JavaScript error page, `noindex` |
| `/newsletter/thanks/`, `/newsletter/already/`, `/newsletter/error/` | One Step sign-up results for forms posted without JavaScript, `noindex` |
| `/api/contact`, `/api/subscribe` | Server routes on Cloudflare: Turnstile check, then Resend (contact) or Beehiiv (newsletter) |
| `/404` | Not found |

Drafts (`draft: true`) render only in `pnpm dev`, never in a build (BR-5).

## Stack

- [Astro](https://astro.build) 7 with TypeScript (strict), static output, deployed to Cloudflare Workers through `@astrojs/cloudflare`
- Tailwind CSS 4, with the design tokens from brief section 3 in `src/styles/global.css`
- Self-hosted fonts: Plus Jakarta Sans, Inter, JetBrains Mono (Fontsource)
- [Keystatic](https://keystatic.com) as the editor at `/keystatic`: local mode in development, GitHub mode in production
- MDX content collections, validated by the schemas in `src/content.config.ts`
- Social images generated at build time with `satori` and `@resvg/resvg-js`
- Sitemap (`@astrojs/sitemap`), RSS (`@astrojs/rss`), `robots.txt` and `llms.txt`
- Vitest for tests, ESLint for lint

## Requirements

- Node 24 (current LTS)
- pnpm, at the version pinned in `packageManager` in `package.json` (`corepack enable` picks it up)

## Getting started

```sh
pnpm install
pnpm dev        # http://127.0.0.1:4321, editor at /keystatic (local mode)
```

`pnpm dev` runs on Node without the Cloudflare adapter, because Keystatic's local mode needs file access. `pnpm build` and `pnpm preview` use the adapter.

Copy `.env.example` to `.env` if you need Keystatic's GitHub mode or want to try the forms locally (it lists Cloudflare's Turnstile test keys).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build into `dist/` (also runs the build rules below) |
| `pnpm preview` | Serve the production build locally (Cloudflare runtime) |
| `pnpm check` | Type check (`astro check`) |
| `pnpm lint` | ESLint over JavaScript, TypeScript and Astro files |
| `pnpm test` | Vitest |
| `pnpm check:launch` | Lists every `TODO(joylynn)` placeholder; fails if a launch blocker remains (brief section 10). `--report-only` never fails |
| `pnpm check:images` | Warns about source images over 5 MB |
| `pnpm urls:check` | After a build: fails if a published URL disappeared without a redirect (BR-11) |
| `pnpm urls:update` | After a build: adds newly built pages to `published-urls.json` |

## Project layout

```
build/            Build rules (Astro integration) and the pure checks it and the scripts share
scripts/          check:launch, check:images, published-URL check
src/assets/       Images (all images go through astro:assets)
src/components/   Header, Footer, SEOHead, ThemeToggle, Todo placeholder, cards, lists, FAQ, pagination
src/content/      Posts, steps, projects, experience, services, testimonials, page singletons, settings
src/layouts/      BaseLayout
src/lib/          Shared helpers: slugs, dates, reading time, SEO, site settings, social images,
                  collection queries, prices and booking links, contact form options,
                  newsletter copy, form scripts; server/ holds the form route logic
src/pages/        Routes, including og/ (social images), rss.xml, robots.txt, llms.txt
test/             Vitest tests, including the Keystatic/Astro schema drift test
keystatic.config.ts   Editor collections (kept in step with src/content.config.ts)
published-urls.json   Every URL ever published, for BR-11
```

## Content and placeholders

Content is edited in Keystatic, which commits to GitHub. Anything Joylynn has not provided yet is a visible `TODO(joylynn): …` placeholder, never invented text. `pnpm check:launch` lists them all and separates the launch blockers.

Prices (audit, build-from, deposit) come only from `src/content/settings/site.json`; a test fails if one is hard-coded (BR-7).

## Build rules

The build fails if a published post, step or project has no description, an image has no alt text, Steps numbers repeat or skip, or a draft or `noindex` page leaks into the sitemap, RSS or `llms.txt`. It also writes redirects and security headers. See `build/build-rules.mjs` and brief section 12.3.

## CI and deploys

- **Cloudflare Workers Builds** deploys `main` to production and every other branch to a preview at `https://<branch>-joylynnwanjiru.joylynnwanjiru-com.workers.dev`.
- **GitHub Actions** (`.github/workflows/ci.yml`) on pull requests and `main`: type check, lint, tests, large-image warning, build, published-URL check, internal link check (offline; `/api/` routes skipped) and the launch check (report only until Phase 4). On pull requests it also runs Lighthouse (mobile) against the preview and fails below the budget in brief section 7 (`lighthouserc.json`).
- **Monthly link check** (`.github/workflows/link-check.yml`) opens an issue for broken links.
- **Dependabot** opens weekly update pull requests.

## Environment variables

Names are in `.env.example`; values live only in `.env` (git-ignored) and on Cloudflare. They are typed through `astro:env` in `astro.config.mjs`:

- Worker secrets: `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (optional), `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` (or set it in site settings), plus the three Keystatic secrets.
- Workers Builds build variables (inlined at build): `TURNSTILE_SITE_KEY`, `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`.

## License

No license file: all rights reserved by default.
