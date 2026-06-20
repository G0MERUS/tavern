import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// `node:sqlite` is still experimental, so it's absent from `builtinModules`.
// vite-node (Vitest's loader) therefore doesn't treat it as a builtin and
// tries to transform it — which fails (it strips the `node:` prefix and can't
// find a `sqlite` package). We alias the import to a tiny shim that pulls the
// real module in via `createRequire`, bypassing the loader. Production code is
// unaffected: it imports the builtin directly under `--experimental-sqlite`.
const sqliteShim = fileURLToPath(new URL('./tests/sqlite-shim.ts', import.meta.url));

// Backend test runner. The frontend has its own Vitest setup under web/ (with
// SvelteKit `$lib` aliases), so we scope this root config to the backend
// `tests/` tree and explicitly exclude web to avoid picking up tests that need
// the Vite/Svelte resolver.
export default defineConfig({
  resolve: {
    alias: {
      'node:sqlite': sqliteShim,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['web/**', 'node_modules/**'],
    // Core layer is synchronous against a shared singleton DB; run serially so
    // tests don't stomp each other's in-memory database.
    fileParallelism: false,
  },
});



