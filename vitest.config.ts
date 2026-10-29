import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Astro's virtual module only exists inside an Astro build; tests use a stub.
      'astro:content': fileURLToPath(new URL('./test/stubs/astro-content.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
