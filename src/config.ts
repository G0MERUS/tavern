import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { nanoid } from 'nanoid';

// Precedence: CLI flag > env var > config.json > default.

export interface Config {
  /** Where the DB and blobs live. */
  dataDir: string;
  /** Listen port. */
  port: number;
  /** Listen address. 127.0.0.1 = no auth. Anything else = bearer required. */
  host: string;
  /** Bearer token for /api/* when host !== 127.0.0.1. Auto-generated if empty. */
  apiToken: string;
  /** Outbound proxy for upstream LLM requests. http://, https://, socks5://. */
  outboundProxy: string;
  /** Generation timeout in seconds. */
  generateTimeout: number;
}

const DEFAULTS: Config = {
  dataDir: './data',
  port: 8000,
  host: '127.0.0.1',
  apiToken: '',
  outboundProxy: '',
  generateTimeout: 300,
};

/** Map a config key to its TAVERN_* env var. */
function envFor(key: keyof Config): string {
  return 'TAVERN_' + key.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase();
}

/** Minimal argv parser — supports `--key value` and `--key=value`. */
function parseArgv(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq > 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[arg.slice(2)] = next;
        i++;
      } else {
        out[arg.slice(2)] = 'true';
      }
    }
  }
  return out;
}

/** camelCase config key → kebab-case CLI flag. */
function cliFor(key: keyof Config): string {
  return key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

let config: Config;
let configPath: string;

export function loadConfig(argv: string[] = process.argv.slice(2)): Config {
  const flags = parseArgv(argv);

  if (flags['help']) {
    console.log(`tavern [options]
  --port <n>          listen port (default ${DEFAULTS.port})
  --host <addr>       listen address (default ${DEFAULTS.host})
  --data-dir <path>   data directory (default ${DEFAULTS.dataDir})
  --config <path>     config file path (default ./config.json)
  --version
  --help`);
    process.exit(0);
  }
  if (flags['version']) {
    console.log('tavern 0.1.0');
    process.exit(0);
  }

  configPath = flags['config'] ?? process.env['TAVERN_CONFIG'] ?? './config.json';
  configPath = resolve(configPath);

  let fileConfig: Partial<Config> = {};
  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error(`✗ Failed to parse ${configPath}:`, (err as Error).message);
      process.exit(1);
    }
  }

  const resolved = {} as Config;
  for (const key of Object.keys(DEFAULTS) as (keyof Config)[]) {
    const cli = flags[cliFor(key)];
    const env = process.env[envFor(key)];
    const file = fileConfig[key];
    const def = DEFAULTS[key];

    let raw: unknown = cli ?? env ?? file ?? def;

    if (typeof def === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        console.error(`✗ Config key '${key}' must be a number, got: ${raw}`);
        process.exit(1);
      }
      raw = n;
    }
    (resolved as unknown as Record<string, unknown>)[key] = raw;
  }

  // dataDir is resolved relative to the config file's directory.
  resolved.dataDir = resolve(dirname(configPath), resolved.dataDir);

  // Auto-generate token on first non-localhost boot.
  const isLocal = resolved.host === '127.0.0.1' || resolved.host === 'localhost' || resolved.host === '::1';
  if (!isLocal && !resolved.apiToken) {
    resolved.apiToken = nanoid(32);
    fileConfig.apiToken = resolved.apiToken;
    writeFileSync(configPath, JSON.stringify(fileConfig, null, 2) + '\n');
    console.log('─'.repeat(60));
    console.log('  Generated API token (save this — it won\'t be shown again):');
    console.log(`  ${resolved.apiToken}`);
    console.log(`  Written to ${configPath}`);
    console.log('─'.repeat(60));
  }

  config = resolved;
  return resolved;
}

export function getConfig(): Config {
  if (!config) throw new Error('Config not loaded — call loadConfig() first');
  return config;
}

/** Auth is required iff we're not bound to loopback. */
export function requiresAuth(): boolean {
  const h = config.host;
  return h !== '127.0.0.1' && h !== 'localhost' && h !== '::1';
}
