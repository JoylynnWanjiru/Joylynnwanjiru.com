// Social images (1200×630 PNG) generated at build time with satori + resvg
// (brief section 7). Satori cannot read WOFF2 or variable fonts, so these use
// the static WOFF files from @fontsource/plus-jakarta-sans and @fontsource/inter.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const WIDTH = 1200;
const HEIGHT = 630;

// Light-theme colour tokens from brief section 3.
const colors = { ink: '#16213A', muted: '#5A6577', wash: '#FEF4F8', blue: '#2B5CE6', pink: '#E8468D', pinkText: '#C92F72' };

const fontFile = (pkg: string, file: string) => readFile(join(process.cwd(), 'node_modules', pkg, 'files', file));

let fonts: Promise<Parameters<typeof satori>[1]['fonts']> | undefined;
const loadFonts = () =>
  (fonts ??= Promise.all([
    fontFile('@fontsource/plus-jakarta-sans', 'plus-jakarta-sans-latin-700-normal.woff'),
    fontFile('@fontsource/inter', 'inter-latin-500-normal.woff'),
  ]).then(([heading, body]) => [
    { name: 'Plus Jakarta Sans', data: heading, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: body, weight: 500 as const, style: 'normal' as const },
  ]));

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

export interface SocialImageInput {
  title: string;
  eyebrow: string;
  name: string;
  signature: string;
}

export async function renderSocialImage({ title, eyebrow, name, signature }: SocialImageInput): Promise<Buffer> {
  const card = h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      position: 'relative',
      // Brand frame: blue to pink border around the wash background.
      backgroundImage: `linear-gradient(135deg, ${colors.blue}, ${colors.pink})`,
    },
    h(
      'div',
      {
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 16,
        left: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundColor: colors.wash,
        borderRadius: 24,
      },
      [
        h('div', { fontFamily: 'Inter', fontSize: 30, color: colors.pinkText }, eyebrow),
        // Long titles stop at three lines with an ellipsis (BR-13).
        h(
          'div',
          {
            fontFamily: 'Plus Jakarta Sans',
            fontSize: title.length > 60 ? 56 : 68,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: colors.ink,
            display: 'block',
            lineClamp: 3,
          },
          title,
        ),
        h('div', { display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontSize: 30 }, [
          h('div', { color: colors.ink }, name),
          h('div', { color: colors.pinkText }, signature),
        ]),
      ],
    ),
  );

  const svg = await satori(card as Parameters<typeof satori>[0], { width: WIDTH, height: HEIGHT, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
}
