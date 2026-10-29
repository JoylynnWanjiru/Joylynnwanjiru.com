import { describe, expect, it } from 'vitest';
import { formatDate, isoDate } from '../src/lib/dates';
import { countWords, readingTime } from '../src/lib/reading-time';
import { slugify } from '../src/lib/slug';
import { TAG_VALUES } from '../src/content/tags';

describe('slugify', () => {
  it('matches the slugs Keystatic gives the service files', () => {
    expect(slugify('Automation & AI')).toBe('automation-ai');
    expect(slugify('Websites & Custom Software')).toBe('websites-custom-software');
    expect(slugify('Growth & Discoverability')).toBe('growth-discoverability');
  });

  it('drops accents, symbols and edge hyphens', () => {
    expect(slugify('  Café — Nairobi!  ')).toBe('cafe-nairobi');
    expect(slugify('One step at a time.')).toBe('one-step-at-a-time');
  });

  it('gives unique tag slugs', () => {
    expect(new Set(TAG_VALUES).size).toBe(TAG_VALUES.length);
  });
});

describe('reading time', () => {
  it('counts body words only, not frontmatter, code or link URLs', () => {
    const markdown = [
      '---',
      'title: Ignored frontmatter words here',
      '---',
      '# Heading words',
      'One two [three](https://example.com/not-counted) four.',
      '```ts',
      'const notCounted = "code words";',
      '```',
      'Uses `inlineCode` five.',
    ].join('\n');
    // Heading words(2) + One two three four(4) + Uses five(2)
    expect(countWords(markdown)).toBe(8);
  });

  it('is at least one minute and rounds at 225 words per minute', () => {
    expect(readingTime('')).toBe(1);
    expect(readingTime('word '.repeat(450))).toBe(2);
  });
});

describe('dates', () => {
  it('formats calendar dates the same in every time zone', () => {
    const date = new Date('2026-10-26');
    expect(formatDate(date)).toBe('26 Oct 2026');
    expect(isoDate(date)).toBe('2026-10-26');
  });
});
