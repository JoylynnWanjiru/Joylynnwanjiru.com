// Astro integration for the build rules (brief 12.3 and 12.5). Two parts, placed
// around @astrojs/sitemap in astro.config.mjs:
//   prepare: reads the build-only published.json, writes _redirects and the
//            security headers, and records noindex/draft paths for the sitemap filter.
//   verify:  after the sitemap exists, fails the build if a draft or noindex page
//            leaked into the sitemap, RSS, llms.txt or the built pages (BR-5, BR-6).
import { existsSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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

        // noindex pages must carry the robots tag (BR-6).
        for (const { path } of hidden.filter((page) => page.reason === 'noindex')) {
          const file = files.find((f) => pagePath(relative(out, f)) === path);
          if (file && !/<meta name="robots" content="noindex/.test(await readFile(file, 'utf8'))) {
            problems.push(`Noindex page ${path} is missing its robots noindex tag.`);
          }
        }

        if (problems.length > 0) throw new Error(`Build rules failed:\n- ${problems.join('\n- ')}`);
        logger.info(`Checked ${hidden.length} hidden page(s): none leaked.`);
      },
    },
  };

  return { prepare, verify, sitemapFilter };
}
