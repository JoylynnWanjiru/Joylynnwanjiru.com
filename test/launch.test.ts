// Tests for `pnpm check:launch` (brief rule 2 and section 10).
import { describe, expect, it } from 'vitest';
import { launchReport } from '../build/launch.mjs';

const readySite = JSON.stringify({
  email: 'hello@example.com',
  socials: [{ label: 'GitHub', url: 'https://github.com/example' }],
  bookingLinks: { freeCall: 'https://cal.com/example/call', audit: 'https://cal.com/example/audit' },
  beehiivPublicationId: 'pub_123',
});
const readyFiles = [
  { path: 'src/content/settings/site.json', text: readySite },
  { path: 'src/content/pages/home.yaml', text: 'portrait: ../../assets/portrait.jpg\nportraitAlt: Joylynn\n' },
  { path: 'src/content/pages/about.mdx', text: '---\nshortBio: Hello\nphoto: ../../assets/about.jpg\nphotoAlt: Joylynn\n---\nLong bio.\n' },
  { path: 'src/content/posts/live.mdx', text: '---\ntitle: Live\ndraft: false\n---\nBody.\n' },
];
const withFile = (path: string, text: string) => [...readyFiles.filter((file) => file.path !== path), { path, text }];

describe('check:launch', () => {
  it('passes when every launch field is filled in', () => {
    expect(launchReport(readyFiles)).toEqual({ blockers: [], others: [] });
  });

  it('blocks on a TODO in a launch-blocker file', () => {
    const { blockers } = launchReport(withFile('src/content/pages/about.mdx', "shortBio: 'TODO(joylynn): short bio'"));
    expect(blockers).toEqual(["src/content/pages/about.mdx:1  shortBio: 'TODO(joylynn): short bio'"]);
  });

  it('lists a TODO elsewhere without blocking', () => {
    const report = launchReport([...readyFiles, { path: 'src/content/pages/now.yaml', text: "focus: 'TODO(joylynn): focus'" }]);
    expect(report.blockers).toEqual([]);
    expect(report.others).toHaveLength(1);
  });

  it('blocks on a TODO in a published post but not in a draft', () => {
    const post = (draft: string) => `---\ntitle: 'TODO(joylynn): title'\n${draft}---\n`;
    expect(launchReport([...readyFiles, { path: 'src/content/posts/a.mdx', text: post('draft: false\n') }]).blockers).toHaveLength(1);
    expect(launchReport([...readyFiles, { path: 'src/content/posts/b.mdx', text: post('draft: true\n') }]).blockers).toEqual([]);
    expect(launchReport([...readyFiles, { path: 'src/content/posts/c.mdx', text: post('') }]).blockers).toEqual([]);
  });

  it('blocks when no post is published', () => {
    const { blockers } = launchReport(readyFiles.filter((file) => !file.path.startsWith('src/content/posts/')));
    expect(blockers).toEqual(['Writing: no published post yet (at least one is needed)']);
  });

  it('blocks on empty launch settings and a missing portrait', () => {
    const site = JSON.stringify({ socials: [], bookingLinks: { freeCall: null, audit: null }, beehiivPublicationId: null });
    expect(launchReport(withFile('src/content/settings/site.json', site)).blockers).toHaveLength(4);
    expect(launchReport(withFile('src/content/pages/home.yaml', 'portrait: null\n')).blockers).toEqual([
      'Home: portrait photo is not set',
    ]);
    expect(launchReport(withFile('src/content/pages/about.mdx', '---\nshortBio: Hello\nphoto: null\n---\n')).blockers).toEqual([
      'About: photo is not set',
    ]);
  });

  it('lists <Todo> component usages, blocking only when marked', () => {
    const page = '<p><Todo need="portrait photo" blocker /></p>\n<Todo need="screenshot" />';
    const report = launchReport([...readyFiles, { path: 'src/pages/index.astro', text: page }]);
    expect(report.blockers).toEqual(['src/pages/index.astro:1  TODO(joylynn): portrait photo']);
    expect(report.others).toEqual(['src/pages/index.astro:2  TODO(joylynn): screenshot']);
  });

  it('ignores the Todo component source', () => {
    expect(launchReport([...readyFiles, { path: 'src/components/Todo.astro', text: 'TODO(joylynn): {need}' }]).others).toEqual([]);
  });
});
