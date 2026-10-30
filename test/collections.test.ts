import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  newestFirst,
  paginate,
  seriesInUse,
  stepNeighbours,
  tagLabel,
  tagsInUse,
  writingPagePath,
} from '../src/lib/collections';

const post = (id: string, date: string, tags: string[] = [], series?: string) => ({
  id,
  data: { date: new Date(date), tags, series },
});

describe('newestFirst', () => {
  it('sorts by date, newest first, with ties ordered by id', () => {
    const sorted = newestFirst([post('b', '2026-01-01'), post('c', '2026-03-01'), post('a', '2026-01-01')]);
    expect(sorted.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('uses nine per page', () => {
    expect(PAGE_SIZE).toBe(9);
    expect(paginate(items, 1)).toMatchObject({ items: items.slice(0, 9), totalPages: 3 });
    expect(paginate(items, 3).items).toEqual([18, 19]);
  });

  it('still has one page when there is nothing to list', () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe('writingPagePath', () => {
  it('keeps page 1 at /writing/', () => {
    expect(writingPagePath(1)).toBe('/writing/');
    expect(writingPagePath(2)).toBe('/writing/page/2/');
  });
});

describe('tags and series', () => {
  const posts = [post('a', '2026-01-01', ['backend', 'ai'], 'Building Wazi '), post('b', '2026-01-02', ['ai'], 'Building Wazi')];

  it('lists only tags in use, in tag-list order', () => {
    expect(tagsInUse(posts).map((tag) => tag.value)).toEqual(['ai', 'backend']);
    expect(tagLabel('ai')).toBe('AI');
  });

  it('lists each series once, with a slug', () => {
    expect(seriesInUse([...posts, post('c', '2026-01-03')])).toEqual([{ name: 'Building Wazi', slug: 'building-wazi' }]);
  });
});

describe('stepNeighbours', () => {
  const steps = [3, 1, 2].map((number) => ({ data: { number } }));

  it('finds the older and newer step by number', () => {
    const { previous, next } = stepNeighbours(steps, steps[2]);
    expect(previous?.data.number).toBe(1);
    expect(next?.data.number).toBe(3);
  });

  it('has no previous step for Step 1', () => {
    expect(stepNeighbours(steps, steps[1]).previous).toBeUndefined();
  });
});
