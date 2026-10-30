// Launch readiness (brief rule 2 and section 10). Pure so the script and the tests
// share it: takes source files, returns what still blocks launch and what does not.

export const MARKER = 'TODO(joylynn)';

// The component that renders the marker on pages; its own source is not content.
const IGNORED = ['src/components/Todo.astro'];

/** A usage of that component; `blocker` marks a launch blocker. */
const TODO_COMPONENT = /<Todo\b([^>]*?)\/?>/g;

/**
 * Files whose placeholders block launch (brief section 10). Posts are handled
 * separately: only published ones block.
 */
const BLOCKER_FILES = {
  'src/content/pages/about.mdx': 'About: short bio, long bio, education, timeline',
  'src/content/pages/home.yaml': 'Portrait photo',
  'src/content/settings/site.json': 'Site settings (contact email and other launch fields)',
};

/** Posts default to draft (content.config.ts), so only an explicit `draft: false` publishes. */
const isPublishedPost = (path, text) =>
  path.startsWith('src/content/posts/') && /^draft:\s*false\s*$/m.test(frontmatter(text));

const frontmatter = (text) => text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';

/**
 * @param {{ path: string; text: string }[]} files repo-relative paths with forward slashes
 * @returns {{ blockers: string[]; others: string[] }} human-readable lines
 */
export function launchReport(files) {
  const blockers = [];
  const others = [];

  for (const { path, text } of files) {
    if (IGNORED.includes(path)) continue;
    const blocking = path in BLOCKER_FILES || isPublishedPost(path, text);
    text.split(/\r?\n/).forEach((line, index) => {
      const where = `${path}:${index + 1}`;
      if (line.includes(MARKER)) (blocking ? blockers : others).push(`${where}  ${line.trim()}`);
      // The <Todo need="…" /> component renders the marker, so its source does not contain it.
      for (const [, attributes] of line.matchAll(TODO_COMPONENT)) {
        const need = attributes.match(/\bneed="([^"]*)"/)?.[1] ?? '';
        const entry = `${where}  ${MARKER}: ${need}`;
        (blocking || /\sblocker\b/.test(attributes) ? blockers : others).push(entry);
      }
    });
  }

  // Missing values that are empty rather than marked with a TODO.
  const file = (path) => files.find((candidate) => candidate.path === path)?.text;

  const site = file('src/content/settings/site.json');
  if (site) {
    const settings = JSON.parse(site);
    if (!settings.socials?.length) blockers.push('Site settings: no social links (socials is empty)');
    if (!settings.bookingLinks?.freeCall) blockers.push('Site settings: free-call booking link (Cal.com) is not set');
    if (!settings.bookingLinks?.audit) blockers.push('Site settings: audit booking link is not set');
    if (!settings.beehiivPublicationId) blockers.push('Site settings: Beehiiv publication ID is not set');
  }

  const home = file('src/content/pages/home.yaml');
  if (home && /^portrait:\s*(null|~)?\s*$/m.test(home)) blockers.push('Home: portrait photo is not set');

  const published = files.filter(({ path, text }) => isPublishedPost(path, text));
  if (published.length === 0) blockers.push('Writing: no published post yet (at least one is needed)');

  return { blockers, others };
}
