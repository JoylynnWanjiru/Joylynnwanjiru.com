// Test stand-in for Astro's `astro:content` virtual module, enough to load
// src/content.config.ts and inspect its schemas.
import { z } from 'astro/zod';

export const defineCollection = <T>(collection: T) => collection;
export const reference = (_collection: string) => z.string();
export type SchemaContext = { image: () => z.ZodType };
