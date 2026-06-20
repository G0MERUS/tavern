import { createRequire } from 'node:module';

// `node:sqlite` is still flagged experimental, so this Node build omits it from
// `module.builtinModules`. That means vite-node (Vitest's loader) doesn't
// recognise it as a builtin and tries to transform/bundle it, which fails.
//
// We sidestep the loader entirely by pulling the module in through a real
// CommonJS `require` (via createRequire) and re-exporting the bits the app
// uses. vitest.config.ts aliases `node:sqlite` to this file for tests only;
// production still imports the builtin directly under `--experimental-sqlite`.
const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite');

export const DatabaseSync = sqlite.DatabaseSync;
export const StatementSync = sqlite.StatementSync;
export default sqlite;
