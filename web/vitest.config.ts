// Vitest config separate from vite.config.ts. Vitest bundles its own Vite
// (under node_modules/vitest/node_modules/vite) and the Plugin types between
// the two copies are nominally incompatible — `defineConfig` from
// `vitest/config` rejects plugins typed against the outer Vite. Splitting
// dodges the type clash entirely. mergeConfig joins them at runtime.
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      include: ['tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
    },
  }),
);
