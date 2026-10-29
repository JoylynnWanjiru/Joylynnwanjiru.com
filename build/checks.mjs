// Pure checks for the build rules in brief section 12.3. Plain JavaScript so the
// Astro integration, the published-URL script and the tests can all import it.
import { createHash } from 'node:crypto';

/**
 * BR-9: Steps numbers are unique and sequential from 1.
 * @param {number[]} numbers
 * @returns {string[]} problems
 */
export function stepNumberProblems(numbers) {
  const problems = [];
  const seen = new Set();
  for (const number of numbers) {
    if (seen.has(number)) problems.push(`Step ${number} is used more than once.`);
    seen.add(number);
  }
  const max = Math.max(0, ...numbers);
  for (let n = 1; n <= max; n += 1) {
    if (!seen.has(n)) problems.push(`Step ${n} is missing (numbers must run 1, 2, 3… with no gaps).`);
  }
  return problems;
}

/**
 * BR-10: images in Markdown/MDX bodies must have alt text.
 * Finds `![](…)` with empty alt and `<img>` tags without an alt attribute.
 * @param {string} body
 * @returns {string[]} the offending image snippets
 */
export function imagesWithoutAlt(body) {
  const markdown = [...body.matchAll(/!\[\s*\]\([^)]*\)/g)].map((match) => match[0]);
  const html = [...body.matchAll(/<img\b(?![^>]*\balt\s*=\s*["'][^"']+["'])[^>]*>/gi)].map((match) => match[0]);
  return [...markdown, ...html];
}

/**
 * BR-11: redirect rules from `redirectFrom` (old slugs) plus manual redirects.
 * @param {{ path: string; section: string; redirectFrom: string[] }[]} entries
 * @param {Record<string, string>} manual old path → new path
 * @returns {{ rules: [string, string][]; problems: string[] }}
 */
export function redirectRules(entries, manual) {
  const live = new Set(entries.map((entry) => entry.path));
  const rules = new Map(Object.entries(manual));
  const problems = [];
  for (const entry of entries) {
    for (const slug of entry.redirectFrom) {
      const from = `${entry.section}${slug}/`;
      if (live.has(from)) problems.push(`${from} is live, so it cannot also redirect to ${entry.path}.`);
      else if (rules.has(from) && rules.get(from) !== entry.path) problems.push(`${from} redirects to two places.`);
      else rules.set(from, entry.path);
    }
  }
  for (const from of Object.keys(manual)) {
    if (live.has(from)) problems.push(`Manual redirect ${from} points away from a live page.`);
  }
  return { rules: [...rules.entries()], problems };
}

/**
 * BR-11: published URLs that are neither built nor redirected.
 * @param {string[]} manifest URLs that have ever been published
 * @param {Set<string>} built paths in this build
 * @param {Set<string>} redirected redirect sources in this build
 */
export function missingPublishedUrls(manifest, built, redirected) {
  return manifest.filter((url) => !built.has(url) && !redirected.has(url));
}

/**
 * HTML file path relative to the output folder → page path.
 * "index.html" → "/", "writing/x/index.html" → "/writing/x/", "404.html" → "/404".
 * @param {string} file
 */
export function pagePath(file) {
  const normalised = file.replace(/\\/g, '/');
  if (normalised === 'index.html') return '/';
  if (normalised.endsWith('/index.html')) return `/${normalised.slice(0, -'index.html'.length)}`;
  return `/${normalised.replace(/\.html$/, '')}`;
}

/**
 * CSP hashes for inline executable scripts (JSON-LD data blocks are not executed).
 * @param {string} html
 * @returns {string[]} 'sha256-…' sources
 */
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attributes, content] = match;
    if (/\bsrc\s*=/.test(attributes) || /type\s*=\s*["']application\/ld\+json["']/i.test(attributes)) continue;
    hashes.push(`'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`);
  }
  return hashes;
}

/**
 * Content-Security-Policy for static pages (brief 12.5): only this site, Cloudflare
 * Turnstile and Cloudflare Web Analytics. Inline scripts are allowed by hash.
 * @param {string[]} scriptHashes
 */
export function contentSecurityPolicy(scriptHashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${[...new Set(scriptHashes)].sort().join(' ')} https://challenges.cloudflare.com https://static.cloudflareinsights.com`.replace(/\s+/g, ' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * BR-5 / BR-6: hidden pages (drafts, noindex) must not leak into listings.
 * @param {{ path: string; reason: 'draft' | 'noindex' }[]} hidden
 * @param {Record<string, string>} outputs file name → contents (sitemap, rss, llms.txt)
 * @param {Set<string>} built paths with an HTML page in this build
 * @param {string} siteUrl
 * @returns {string[]} problems
 */
export function hiddenPageLeaks(hidden, outputs, built, siteUrl) {
  const problems = [];
  for (const { path, reason } of hidden) {
    const url = new URL(path, siteUrl).toString();
    if (reason === 'draft' && built.has(path)) problems.push(`Draft ${path} was built as a page.`);
    for (const [file, contents] of Object.entries(outputs)) {
      if (contents.includes(url)) problems.push(`${reason === 'draft' ? 'Draft' : 'Noindex page'} ${path} appears in ${file}.`);
    }
  }
  return problems;
}
