// Astro integration for the build rules (brief 12.3 and 12.5). Two parts, placed
// around @astrojs/sitemap in astro.config.mjs:
//   prepare: reads the build-only published.json, writes _redirects and the
//            security headers, and records noindex/draft paths for the sitemap filter.
//   verify:  after the sitemap exists, fails the build if a draft or noindex page
//            leaked into the sitemap, RSS, llms.txt, the search index or the built
//            pages (BR-5, BR-6), then builds the Pagefind search index.
import { existsSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pagefind from 'pagefind';
import { contentSecurityPolicy, hiddenPageLeaks, inlineScriptHashes, pagePath } from './checks.mjs';

const MAX_HEADER_LINE = 2000; // Cloudflare _headers limit per line

/** @param {string} dir */
async function htmlFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** @param {string} siteUrl */
export function buildRules(siteUrl) {
  /** @type {Set<string>} */
  const hiddenPaths = new Set();
  /** @type {{ path: string; reason: 'draft' | 'noindex' }[]} */
  let hidden = [];

  /** Sitemap filter: leaves out drafts and noindex pages (BR-5, BR-6). */
  const sitemapFilter = (/** @type {string} */ page) => !hiddenPaths.has(new URL(page).pathname);

  /** @type {import('astro').AstroIntegration} */
  const prepare = {
    name: 'build-rules:prepare',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const manifestFile = join(out, 'build', 'published.json');
        const published = JSON.parse(await readFile(manifestFile, 'utf8'));
        await rm(join(out, 'build'), { recursive: true });

        hidden = published.hidden;
        // Code pages marked noindex (confirmations, errors) are hidden too, not only content entries.
        const listed = new Set(hidden.map((page) => page.path));
        for (const file of await htmlFiles(out)) {
          const path = pagePath(relative(out, file));
          if (listed.has(path) || !/<meta name="robots" content="noindex/.test(await readFile(file, 'utf8'))) continue;
          hidden.push({ path, reason: 'noindex' });
        }
        for (const page of hidden) hiddenPaths.add(page.path);

        // Redirects (BR-11): old slug → current page, 301.
        /** @type {[string, string][]} */
        const redirects = published.redirects;
        const redirectLines = redirects.map(([from, to]) => `${from} ${to} 301`);
        await writeFile(join(out, '_redirects'), `${redirectLines.join('\n')}\n`);
        logger.info(`Wrote ${redirects.length} redirect(s).`);

        // Security headers (brief 12.5). Static pages only; the Worker sets its own.
        const hashes = [];
        for (const file of await htmlFiles(out)) hashes.push(...inlineScriptHashes(await readFile(file, 'utf8')));
        const csp = contentSecurityPolicy(hashes);
        const block = [
          '/*',
          `  Content-Security-Policy: ${csp}`,
          '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
          '  X-Content-Type-Options: nosniff',
          '  X-Frame-Options: DENY',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          '',
        ];
        const tooLong = block.find((line) => line.length > MAX_HEADER_LINE);
        if (tooLong) throw new Error(`Security header line is over ${MAX_HEADER_LINE} characters: ${tooLong.slice(0, 80)}…`);
        const headersFile = join(out, '_headers');
        const existing = existsSync(headersFile) ? await readFile(headersFile, 'utf8') : '';
        await writeFile(headersFile, `${block.join('\n')}\n${existing}`);
        logger.info(`Wrote security headers (${new Set(hashes).size} inline script hash(es)).`);
      },
    },
  };

  /** @type {import('astro').AstroIntegration} */
  const verify = {
    name: 'build-rules:verify',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const files = await htmlFiles(out);
        const built = new Set(files.map((file) => pagePath(relative(out, file))));

        /** @type {Record<string, string>} */
        const outputs = {};
        for (const name of ['sitemap-0.xml', 'rss.xml', 'llms.txt']) {
          const file = join(out, name);
          if (existsSync(file)) outputs[name] = await readFile(file, 'utf8');
        }
        const problems = hiddenPageLeaks(hidden, outputs, built, siteUrl);

        // noindex pages must carry the robots tag and stay out of search (BR-6).
        // Pagefind indexes only pages marked data-pagefind-body (BaseLayout skips noindex ones).
        for (const { path } of hidden.filter((page) => page.reason === 'noindex')) {
          const file = files.find((f) => pagePath(relative(out, f)) === path);
          if (!file) continue;
          const html = await readFile(file, 'utf8');
          if (!/<meta name="robots" content="noindex/.test(html)) {
            problems.push(`Noindex page ${path} is missing its robots noindex tag.`);
          }
          if (/\bdata-pagefind-body\b/.test(html)) problems.push(`Noindex page ${path} would be in the search index.`);
        }

        if (problems.length > 0) throw new Error(`Build rules failed:\n- ${problems.join('\n- ')}`);
        logger.info(`Checked ${hidden.length} hidden page(s): none leaked.`);

        // Search index (Pagefind), loaded in the browser only when search opens.
        const { index, errors: createErrors } = await pagefind.createIndex();
        if (!index) throw new Error(`Pagefind failed: ${createErrors.join('; ')}`);
        const added = await index.addDirectory({ path: out });
        const written = await index.writeFiles({ outputPath: join(out, 'pagefind') });
        await pagefind.close();
        const errors = [...added.errors, ...written.errors];
        if (errors.length > 0) throw new Error(`Pagefind failed: ${errors.join('; ')}`);
        logger.info(`Search index: ${added.page_count} page(s).`);
      },
    },
  };

  return { prepare, verify, sitemapFilter };
}
