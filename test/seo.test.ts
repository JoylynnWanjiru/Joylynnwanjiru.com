import { describe, expect, it } from 'vitest';
import { absoluteUrl, serializeJsonLd, socialImagePath } from '../src/lib/seo';

describe('socialImagePath', () => {
  it('maps page paths to one PNG each', () => {
    expect(socialImagePath('/')).toBe('/og/index.png');
    expect(socialImagePath('/writing/my-post/')).toBe('/og/writing/my-post.png');
    expect(socialImagePath('/work/kadi')).toBe('/og/work/kadi.png');
  });
});

describe('absoluteUrl', () => {
  it('always points at the production domain', () => {
    expect(absoluteUrl('/writing/')).toBe('https://joylynnwanjiru.com/writing/');
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script tag it sits in', () => {
    const json = serializeJsonLd({ headline: 'Bad </script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json).headline).toBe('Bad </script><script>alert(1)</script>');
  });
});
