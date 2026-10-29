// Keystatic's editor fields and Astro's content schemas must describe the same
// fields (brief section 4). This fails when one side gains, loses or renames a
// field, at any depth (SEO group, list items, nested objects).
import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import keystatic from '../keystatic.config';
import { collections } from '../src/content.config';

type Tree = { [key: string]: Tree | null };

// --- Keystatic side -------------------------------------------------------
type KeystaticField = { kind: string; fields?: Record<string, KeystaticField>; element?: KeystaticField };

function keystaticTree(fields: Record<string, KeystaticField>, skip: string[] = []): Tree {
  const tree: Tree = {};
  for (const [key, field] of Object.entries(fields)) {
    if (skip.includes(key)) continue;
    tree[key] = keystaticNode(field);
  }
  return tree;
}

function keystaticNode(field: KeystaticField): Tree | null {
  if (field.kind === 'object' && field.fields) return keystaticTree(field.fields);
  if (field.kind === 'array' && field.element) return keystaticNode(field.element);
  return null;
}

// --- Astro (Zod) side -----------------------------------------------------
type ZodDef = { type: string; innerType?: z.ZodType; in?: z.ZodType; element?: z.ZodType; shape?: Record<string, z.ZodType> };
const def = (schema: z.ZodType) => (schema as unknown as { _zod: { def: ZodDef } })._zod.def;

// Peel optional, nullable, default and pipe wrappers.
function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (;;) {
    const d = def(current);
    const next = d.innerType ?? (d.type === 'pipe' ? d.in : undefined);
    if (!next) return current;
    current = next;
  }
}

function zodNode(schema: z.ZodType): Tree | null {
  const inner = unwrap(schema);
  const d = def(inner);
  if (d.type === 'object' && d.shape) return zodTree(d.shape);
  if (d.type === 'array' && d.element) return zodNode(d.element);
  return null;
}

function zodTree(shape: Record<string, z.ZodType>): Tree {
  return Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, zodNode(value)]));
}

type AstroCollection = { schema: z.ZodType | ((context: { image: () => z.ZodType }) => z.ZodType) };
function astroTree(collection: AstroCollection): Tree {
  const schema = typeof collection.schema === 'function' ? collection.schema({ image: () => z.string() }) : collection.schema;
  const tree = zodNode(schema);
  if (!tree) throw new Error('Collection schema is not an object');
  return tree;
}

// --- Compare ----------------------------------------------------------------
type Entry = { schema: Record<string, KeystaticField>; format?: unknown };
const contentField = (entry: Entry) => {
  const format = entry.format as { contentField?: string } | undefined;
  return format?.contentField ? [format.contentField] : [];
};

const editorEntries: Record<string, Entry> = {
  ...(keystatic.collections as unknown as Record<string, Entry>),
  ...(keystatic.singletons as unknown as Record<string, Entry>),
};
const astroCollections = collections as unknown as Record<string, AstroCollection>;

describe('Keystatic and Astro content schemas', () => {
  it('define the same collections and singletons', () => {
    expect(Object.keys(editorEntries).sort()).toEqual(Object.keys(astroCollections).sort());
  });

  for (const [name, entry] of Object.entries(editorEntries)) {
    it(`"${name}" has the same fields in both`, () => {
      // The body (content field) is the Markdown file body, not frontmatter.
      const editor = keystaticTree(entry.schema, contentField(entry));
      expect(astroTree(astroCollections[name])).toEqual(editor);
    });
  }
});
