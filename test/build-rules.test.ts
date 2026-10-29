// Tests for the business rules in brief section 12.3 that run at build time.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import {
  contentSecurityPolicy,
  hiddenPageLeaks,
  imagesWithoutAlt,
  inlineScriptHashes,
  missingPublishedUrls,
  pagePath,
  redirectRules,
  stepNumberProblems,
} from '../build/checks.mjs';
import { collections } from '../src/content.config';
import { isPublished } from '../src/lib/seo';

const SITE = 'https://joylynnwanjiru.com';
type Schema = z.ZodType;
const schemaOf = (name: keyof typeof collections) => {
  const schema = (collections[name] as unknown as { schema: Schema | ((c: { image: () => Schema }) => Schema) }).schema;
  return typeof schema === 'function' ? schema({ image: () => z.string() }) : schema;
};

describe('BR-5: drafts never appear in production output', () => {
  it('treats drafts as unpublished', () => {
    expect(isPublished({ data: { draft: true } })).toBe(false);
    expect(isPublished({ data: { draft: false } })).toBe(true);
  });

  it('new posts are drafts by default', () => {
    const post = schemaOf('posts').parse({ title: 'T', description: 'D', date: '2026-10-29' }) as { draft: boolean };
    expect(post.draft).toBe(true);
  });

  it('flags a draft that was built or listed', () => {
    const hidden = [{ path: '/writing/secret/', reason: 'draft' as const }];
    const leaks = hiddenPageLeaks(
      hidden,
      { 'rss.xml': `<link>${SITE}/writing/secret/</link>`, 'sitemap-0.xml': '' },
      new Set(['/', '/writing/secret/']),
      SITE,
    );
    expect(leaks).toEqual(['Draft /writing/secret/ was built as a page.', 'Draft /writing/secret/ appears in rss.xml.']);
  });
});

describe('BR-6: noindex pages stay out of the sitemap and llms.txt', () => {
  it('flags a noindex page in the sitemap', () => {
    const leaks = hiddenPageLeaks(
      [{ path: '/about/', reason: 'noindex' }],
      { 'sitemap-0.xml': `<loc>${SITE}/about/</loc>`, 'llms.txt': '' },
      new Set(['/about/']),
      SITE,
    );
    expect(leaks).toEqual(['Noindex page /about/ appears in sitemap-0.xml.']);
  });

  it('allows a noindex page to be built (it stays reachable)', () => {
    expect(hiddenPageLeaks([{ path: '/about/', reason: 'noindex' }], {}, new Set(['/about/']), SITE)).toEqual([]);
  });
});

describe('BR-7: no hard-coded prices in components, layouts or pages', () => {
  const dirs = ['src/components', 'src/layouts', 'src/pages'];
  const files = dirs.flatMap((dir) =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name)),
  );

  it('finds files to scan', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file.replace(/\\/g, '/')} has no $77, $500 or 60%`, () => {
      expect(readFileSync(file, 'utf8')).not.toMatch(/\$\s?77\b|\$\s?500\b|\b60\s?%/);
    });
  }
});

describe('BR-9: Steps numbers are unique and sequential', () => {
  it('accepts 1, 2, 3 in any order', () => {
    expect(stepNumberProblems([2, 1, 3])).toEqual([]);
    expect(stepNumberProblems([])).toEqual([]);
  });

  it('fails on a duplicate', () => {
    expect(stepNumberProblems([1, 2, 2])).toEqual(['Step 2 is used more than once.']);
  });

  it('fails on a gap', () => {
    expect(stepNumberProblems([1, 3])).toEqual(['Step 2 is missing (numbers must run 1, 2, 3… with no gaps).']);
  });
});

describe('BR-10: descriptions and alt text are required', () => {
  it('rejects a post without a description', () => {
    expect(schemaOf('posts').safeParse({ title: 'T', description: '', date: '2026-10-29' }).success).toBe(false);
  });

  it('rejects a cover image without alt text', () => {
    const result = schemaOf('posts').safeParse({ title: 'T', description: 'D', date: '2026-10-29', cover: 'cover.png' });
    expect(result.success).toBe(false);
  });

  it('rejects a step without a summary and a project without a one-liner', () => {
    expect(schemaOf('steps').safeParse({ title: 'T', number: 1, date: '2026-10-29', summary: '' }).success).toBe(false);
    expect(schemaOf('projects').safeParse({ title: 'T', kind: 'client', oneLiner: '', role: 'R' }).success).toBe(false);
  });

  it('finds body images without alt text', () => {
    expect(imagesWithoutAlt('![](a.png) ![Fine](b.png) <img src="c.png"> <img src="d.png" alt="Fine">')).toEqual([
      '![](a.png)',
      '<img src="c.png">',
    ]);
  });
});

describe('BR-11: published URLs stay reachable', () => {
  const entries = [{ path: '/writing/new-slug/', section: '/writing/', redirectFrom: ['old-slug'] }];

  it('redirects old slugs to the current page', () => {
    expect(redirectRules(entries, {}).rules).toEqual([['/writing/old-slug/', '/writing/new-slug/']]);
  });

  it('keeps manual redirects for removed pages', () => {
    expect(redirectRules([], { '/writing/gone/': '/writing/' }).rules).toEqual([['/writing/gone/', '/writing/']]);
  });

  it('refuses to redirect away from a live page', () => {
    const live = [...entries, { path: '/writing/old-slug/', section: '/writing/', redirectFrom: [] }];
    expect(redirectRules(live, {}).problems).toHaveLength(1);
  });

  it('reports a published URL that is neither built nor redirected', () => {
    const missing = missingPublishedUrls(
      ['/', '/writing/a/', '/writing/b/'],
      new Set(['/', '/writing/a/']),
      new Set(['/writing/old/']),
    );
    expect(missing).toEqual(['/writing/b/']);
  });

  it('maps built files to page paths', () => {
    expect(pagePath('index.html')).toBe('/');
    expect(pagePath('writing\\x\\index.html')).toBe('/writing/x/');
    expect(pagePath('404.html')).toBe('/404');
  });
});

describe('BR-13: SEO title and description limits', () => {
  const seo = (fields: Record<string, string>) =>
    schemaOf('posts').safeParse({ title: 'T', description: 'D', date: '2026-10-29', seo: fields }).success;

  it('allows 60 / 155 characters and rejects more', () => {
    expect(seo({ title: 'x'.repeat(60), description: 'x'.repeat(155) })).toBe(true);
    expect(seo({ title: 'x'.repeat(61) })).toBe(false);
    expect(seo({ description: 'x'.repeat(156) })).toBe(false);
  });
});

describe('Security headers (brief 12.5)', () => {
  it('hashes inline scripts but not JSON-LD or external scripts', () => {
    const html =
      '<script>a()</script><script type="module">b()</script><script type="application/ld+json">{}</script><script src="/x.js"></script>';
    expect(inlineScriptHashes(html)).toHaveLength(2);
  });

  it('allows only this site, Turnstile and Cloudflare analytics', () => {
    const csp = contentSecurityPolicy(["'sha256-abc'"]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'sha256-abc' https://challenges.cloudflare.com https://static.cloudflareinsights.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });
});
