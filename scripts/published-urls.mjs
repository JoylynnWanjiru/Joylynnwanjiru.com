// BR-11: every URL that has ever been published stays reachable.
//   node scripts/published-urls.mjs --check   fails if a URL in published-urls.json
//                                             is neither built nor redirected
//   node scripts/published-urls.mjs --update  adds newly built pages to the list
// Run after `pnpm build`. To retire a page, add its old URL to "redirects".
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { missingPublishedUrls, pagePath } from '../build/checks.mjs';

const OUT = 'dist/client';
const MANIFEST = 'published-urls.json';
const mode = process.argv[2];

if (mode !== '--check' && mode !== '--update') {
  console.error('Usage: node scripts/published-urls.mjs --check | --update');
  process.exit(2);
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

const files = (await readdir(OUT, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => pagePath(relative(OUT, join(entry.parentPath, entry.name))));
// Error pages are not published URLs.
const built = new Set(files.filter((path) => path !== '/404'));

const redirectsFile = await readFile(join(OUT, '_redirects'), 'utf8').catch(() => '');
const redirected = new Set(
  redirectsFile
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((source) => source && !source.startsWith('#')),
);

if (mode === '--check') {
  const missing = missingPublishedUrls(manifest.urls, built, redirected);
  if (missing.length > 0) {
    console.error(
      `These published URLs disappeared without a redirect (BR-11):\n- ${missing.join('\n- ')}\n` +
        'Add the old slug to the entry\'s "Redirect from" field in Keystatic, or add the URL to "redirects" in published-urls.json.',
    );
    process.exit(1);
  }
  const unlisted = [...built].filter((path) => !manifest.urls.includes(path));
  console.log(`All ${manifest.urls.length} published URL(s) are reachable.`);
  if (unlisted.length > 0) console.log(`New pages not yet in ${MANIFEST}: ${unlisted.join(', ')} (run with --update).`);
} else {
  const urls = [...new Set([...manifest.urls, ...built])].sort();
  await writeFile(MANIFEST, `${JSON.stringify({ ...manifest, urls }, null, 2)}\n`);
  console.log(`${MANIFEST} now lists ${urls.length} URL(s).`);
}
