// GENERATED — DO NOT EDIT. Run: bun scripts/generate-catalog.ts
// Source: https://models.dev/api.json
// Generated: 2026-04-07T17:56:04.239Z
// Providers: 16, Models: 411

export interface CatalogModel {
  /** Wire id, e.g. "claude-opus-4-5-20251101" */
  id: string;
  /** Display name, e.g. "Claude Opus 4.5" */
  name: string;
  /** Context window in tokens */
  ctx: number;
  /** Max output tokens */
  out: number;
  /** Has a thinking/reasoning mode */
  reasoning: boolean;
  /** Accepts image input */
  vision: boolean;
  /** [$/Mtok in, $/Mtok out] — absent for free/local */
  cost?: [number, number];
  /** YYYY-MM-DD — for sorting newest-first */
  release?: string;
}

export interface CatalogProvider {
  /** "anthropic", "openrouter", "llamacpp" */
  id: string;
  /** "Anthropic" */
  name: string;
  /** Wire format discriminator — drives request shaping in generate.ts */
  kind: 'openai' | 'anthropic' | 'google';
  /** Pre-fill value for the connection form */
  base_url: string;
  /** Display hint shown next to the API key input ("x-api-key") */
  key_header?: string;
  models: CatalogModel[];
}

export const CATALOG: CatalogProvider[] = [
  {
    "id": "anthropic",
    "name": "Anthropic",
    "kind": "anthropic",
    "base_url": "https://api.anthropic.com/v1",
    "models": [
      {
        "id": "claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6",
        "ctx": 1000000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2026-02-17"
      },
      {
        "id": "claude-opus-4-6",
        "name": "Claude Opus 4.6",
        "ctx": 1000000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          5,
          25
        ],
        "release": "2026-02-05"
      },
      {
        "id": "claude-opus-4-5",
        "name": "Claude Opus 4.5 (latest)",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          5,
          25
        ],
        "release": "2025-11-24"
      },
      {
        "id": "claude-opus-4-5-20251101",
        "name": "Claude Opus 4.5",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          5,
          25
        ],
        "release": "2025-11-01"
      },
      {
        "id": "claude-haiku-4-5-20251001",
        "name": "Claude Haiku 4.5",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1,
          5
        ],
        "release": "2025-10-15"
      },
      {
        "id": "claude-haiku-4-5",
        "name": "Claude Haiku 4.5 (latest)",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1,
          5
        ],
        "release": "2025-10-15"
      },
      {
        "id": "claude-sonnet-4-5-20250929",
        "name": "Claude Sonnet 4.5",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-09-29"
      },
      {
        "id": "claude-sonnet-4-5",
        "name": "Claude Sonnet 4.5 (latest)",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-09-29"
      },
      {
        "id": "claude-opus-4-1",
        "name": "Claude Opus 4.1 (latest)",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-08-05"
      },
      {
        "id": "claude-opus-4-1-20250805",
        "name": "Claude Opus 4.1",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-08-05"
      },
      {
        "id": "claude-opus-4-20250514",
        "name": "Claude Opus 4",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-05-22"
      },
      {
        "id": "claude-sonnet-4-0",
        "name": "Claude Sonnet 4 (latest)",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-05-22"
      },
      {
        "id": "claude-sonnet-4-20250514",
        "name": "Claude Sonnet 4",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-05-22"
      },
      {
        "id": "claude-opus-4-0",
        "name": "Claude Opus 4 (latest)",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-05-22"
      },
      {
        "id": "claude-3-7-sonnet-20250219",
        "name": "Claude Sonnet 3.7",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-02-19"
      },
      {
        "id": "claude-3-5-haiku-20241022",
        "name": "Claude Haiku 3.5",
        "ctx": 200000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.8,
          4
        ],
        "release": "2024-10-22"
      },
      {
        "id": "claude-3-5-haiku-latest",
        "name": "Claude Haiku 3.5 (latest)",
        "ctx": 200000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.8,
          4
        ],
        "release": "2024-10-22"
      },
      {
        "id": "claude-3-5-sonnet-20241022",
        "name": "Claude Sonnet 3.5 v2",
        "ctx": 200000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2024-10-22"
      },
      {
        "id": "claude-3-5-sonnet-20240620",
        "name": "Claude Sonnet 3.5",
        "ctx": 200000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2024-06-20"
      },
      {
        "id": "claude-3-haiku-20240307",
        "name": "Claude Haiku 3",
        "ctx": 200000,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.25,
          1.25
        ],
        "release": "2024-03-13"
      },
      {
        "id": "claude-3-sonnet-20240229",
        "name": "Claude Sonnet 3",
        "ctx": 200000,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2024-03-04"
      },
      {
        "id": "claude-3-opus-20240229",
        "name": "Claude Opus 3",
        "ctx": 200000,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2024-02-29"
      }
    ],
    "key_header": "x-api-key"
  },
  {
    "id": "cohere",
    "name": "Cohere",
    "kind": "openai",
    "base_url": "https://api.cohere.ai/compatibility/v1",
    "models": [
      {
        "id": "command-a-translate-08-2025",
        "name": "Command A Translate",
        "ctx": 8000,
        "out": 8000,
        "reasoning": false,
        "vision": false,
        "cost": [
          2.5,
          10
        ],
        "release": "2025-08-28"
      },
      {
        "id": "command-a-reasoning-08-2025",
        "name": "Command A Reasoning",
        "ctx": 256000,
        "out": 32000,
        "reasoning": true,
        "vision": false,
        "cost": [
          2.5,
          10
        ],
        "release": "2025-08-21"
      },
      {
        "id": "command-a-vision-07-2025",
        "name": "Command A Vision",
        "ctx": 128000,
        "out": 8000,
        "reasoning": false,
        "vision": false,
        "cost": [
          2.5,
          10
        ],
        "release": "2025-07-31"
      },
      {
        "id": "command-a-03-2025",
        "name": "Command A",
        "ctx": 256000,
        "out": 8000,
        "reasoning": false,
        "vision": false,
        "cost": [
          2.5,
          10
        ],
        "release": "2025-03-13"
      },
      {
        "id": "c4ai-aya-vision-8b",
        "name": "Aya Vision 8B",
        "ctx": 16000,
        "out": 4000,
        "reasoning": false,
        "vision": true,
        "release": "2025-03-04"
      },
      {
        "id": "c4ai-aya-vision-32b",
        "name": "Aya Vision 32B",
        "ctx": 16000,
        "out": 4000,
        "reasoning": false,
        "vision": true,
        "release": "2025-03-04"
      },
      {
        "id": "command-r7b-arabic-02-2025",
        "name": "Command R7B Arabic",
        "ctx": 128000,
        "out": 4000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.0375,
          0.15
        ],
        "release": "2025-02-27"
      },
      {
        "id": "c4ai-aya-expanse-32b",
        "name": "Aya Expanse 32B",
        "ctx": 128000,
        "out": 4000,
        "reasoning": false,
        "vision": false,
        "release": "2024-10-24"
      },
      {
        "id": "c4ai-aya-expanse-8b",
        "name": "Aya Expanse 8B",
        "ctx": 8000,
        "out": 4000,
        "reasoning": false,
        "vision": false,
        "release": "2024-10-24"
      },
      {
        "id": "command-r-08-2024",
        "name": "Command R",
        "ctx": 128000,
        "out": 4000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2024-08-30"
      },
      {
        "id": "command-r-plus-08-2024",
        "name": "Command R+",
        "ctx": 128000,
        "out": 4000,
        "reasoning": false,
        "vision": false,
        "cost": [
          2.5,
          10
        ],
        "release": "2024-08-30"
      },
      {
        "id": "command-r7b-12-2024",
        "name": "Command R7B",
        "ctx": 128000,
        "out": 4000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.0375,
          0.15
        ],
        "release": "2024-02-27"
      }
    ]
  },
  {
    "id": "deepseek",
    "name": "DeepSeek",
    "kind": "openai",
    "base_url": "https://api.deepseek.com",
    "models": [
      {
        "id": "deepseek-chat",
        "name": "DeepSeek Chat",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.28,
          0.42
        ],
        "release": "2025-12-01"
      },
      {
        "id": "deepseek-reasoner",
        "name": "DeepSeek Reasoner",
        "ctx": 128000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.28,
          0.42
        ],
        "release": "2025-12-01"
      }
    ]
  },
  {
    "id": "fireworks-ai",
    "name": "Fireworks AI",
    "kind": "openai",
    "base_url": "https://api.fireworks.ai/inference/v1",
    "models": [
      {
        "id": "accounts/fireworks/models/minimax-m2p5",
        "name": "MiniMax-M2.5",
        "ctx": 196608,
        "out": 196608,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2026-02-12"
      },
      {
        "id": "accounts/fireworks/models/glm-5",
        "name": "GLM 5",
        "ctx": 202752,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          1,
          3.2
        ],
        "release": "2026-02-11"
      },
      {
        "id": "accounts/fireworks/routers/kimi-k2p5-turbo",
        "name": "Kimi K2.5 Turbo (firepass)",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-27"
      },
      {
        "id": "accounts/fireworks/models/kimi-k2p5",
        "name": "Kimi K2.5",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          3
        ],
        "release": "2026-01-27"
      },
      {
        "id": "accounts/fireworks/models/minimax-m2p1",
        "name": "MiniMax-M2.1",
        "ctx": 200000,
        "out": 200000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2025-12-23"
      },
      {
        "id": "accounts/fireworks/models/glm-4p7",
        "name": "GLM 4.7",
        "ctx": 198000,
        "out": 198000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.2
        ],
        "release": "2025-12-22"
      },
      {
        "id": "accounts/fireworks/models/deepseek-v3p2",
        "name": "DeepSeek V3.2",
        "ctx": 160000,
        "out": 160000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.56,
          1.68
        ],
        "release": "2025-12-01"
      },
      {
        "id": "accounts/fireworks/models/kimi-k2-thinking",
        "name": "Kimi K2 Thinking",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-11-06"
      },
      {
        "id": "accounts/fireworks/models/deepseek-v3p1",
        "name": "DeepSeek V3.1",
        "ctx": 163840,
        "out": 163840,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.56,
          1.68
        ],
        "release": "2025-08-21"
      },
      {
        "id": "accounts/fireworks/models/gpt-oss-120b",
        "name": "GPT OSS 120B",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2025-08-05"
      },
      {
        "id": "accounts/fireworks/models/gpt-oss-20b",
        "name": "GPT OSS 20B",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.05,
          0.2
        ],
        "release": "2025-08-05"
      },
      {
        "id": "accounts/fireworks/models/glm-4p5-air",
        "name": "GLM 4.5 Air",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.22,
          0.88
        ],
        "release": "2025-08-01"
      },
      {
        "id": "accounts/fireworks/models/glm-4p5",
        "name": "GLM 4.5",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.55,
          2.19
        ],
        "release": "2025-07-29"
      },
      {
        "id": "accounts/fireworks/models/kimi-k2-instruct",
        "name": "Kimi K2 Instruct",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          1,
          3
        ],
        "release": "2025-07-11"
      }
    ]
  },
  {
    "id": "google",
    "name": "Google",
    "kind": "google",
    "base_url": "https://generativelanguage.googleapis.com/v1beta",
    "models": [
      {
        "id": "gemma-4-26b-it",
        "name": "Gemma 4 26B",
        "ctx": 256000,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "release": "2026-04-02"
      },
      {
        "id": "gemma-4-31b-it",
        "name": "Gemma 4 31B",
        "ctx": 256000,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "release": "2026-04-02"
      },
      {
        "id": "gemini-3.1-flash-lite-preview",
        "name": "Gemini 3.1 Flash Lite Preview",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          1.5
        ],
        "release": "2026-03-03"
      },
      {
        "id": "gemini-3.1-flash-image-preview",
        "name": "Gemini 3.1 Flash Image (Preview)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          60
        ],
        "release": "2026-02-26"
      },
      {
        "id": "gemini-3.1-pro-preview",
        "name": "Gemini 3.1 Pro Preview",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          12
        ],
        "release": "2026-02-19"
      },
      {
        "id": "gemini-3.1-pro-preview-customtools",
        "name": "Gemini 3.1 Pro Preview Custom Tools",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          12
        ],
        "release": "2026-02-19"
      },
      {
        "id": "gemini-3-flash-preview",
        "name": "Gemini 3 Flash Preview",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.5,
          3
        ],
        "release": "2025-12-17"
      },
      {
        "id": "gemini-3-pro-preview",
        "name": "Gemini 3 Pro Preview",
        "ctx": 1000000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          12
        ],
        "release": "2025-11-18"
      },
      {
        "id": "gemini-2.5-flash-lite-preview-09-2025",
        "name": "Gemini 2.5 Flash Lite Preview 09-25",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-09-25"
      },
      {
        "id": "gemini-2.5-flash-preview-09-2025",
        "name": "Gemini 2.5 Flash Preview 09-25",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          2.5
        ],
        "release": "2025-09-25"
      },
      {
        "id": "gemini-flash-lite-latest",
        "name": "Gemini Flash-Lite Latest",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-09-25"
      },
      {
        "id": "gemini-flash-latest",
        "name": "Gemini Flash Latest",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          2.5
        ],
        "release": "2025-09-25"
      },
      {
        "id": "gemini-live-2.5-flash",
        "name": "Gemini Live 2.5 Flash",
        "ctx": 128000,
        "out": 8000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.5,
          2
        ],
        "release": "2025-09-01"
      },
      {
        "id": "gemini-2.5-flash-image",
        "name": "Gemini 2.5 Flash Image",
        "ctx": 32768,
        "out": 32768,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          30
        ],
        "release": "2025-08-26"
      },
      {
        "id": "gemini-2.5-flash-image-preview",
        "name": "Gemini 2.5 Flash Image (Preview)",
        "ctx": 32768,
        "out": 32768,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          30
        ],
        "release": "2025-08-26"
      },
      {
        "id": "gemma-3n-e2b-it",
        "name": "Gemma 3n 2B",
        "ctx": 8192,
        "out": 2000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-07-09"
      },
      {
        "id": "gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash Lite",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-06-17"
      },
      {
        "id": "gemini-2.5-flash-lite-preview-06-17",
        "name": "Gemini 2.5 Flash Lite Preview 06-17",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-06-17"
      },
      {
        "id": "gemini-live-2.5-flash-preview-native-audio",
        "name": "Gemini Live 2.5 Flash Preview Native Audio",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.5,
          2
        ],
        "release": "2025-06-17"
      },
      {
        "id": "gemini-2.5-pro-preview-06-05",
        "name": "Gemini 2.5 Pro Preview 06-05",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-06-05"
      },
      {
        "id": "gemini-2.5-flash-preview-05-20",
        "name": "Gemini 2.5 Flash Preview 05-20",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2025-05-20"
      },
      {
        "id": "gemma-3n-e4b-it",
        "name": "Gemma 3n 4B",
        "ctx": 8192,
        "out": 2000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-05-20"
      },
      {
        "id": "gemini-embedding-001",
        "name": "Gemini Embedding 001",
        "ctx": 2048,
        "out": 3072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.15,
          0
        ],
        "release": "2025-05-20"
      },
      {
        "id": "gemini-2.5-pro-preview-05-06",
        "name": "Gemini 2.5 Pro Preview 05-06",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-05-06"
      },
      {
        "id": "gemini-2.5-pro-preview-tts",
        "name": "Gemini 2.5 Pro Preview TTS",
        "ctx": 8000,
        "out": 16000,
        "reasoning": false,
        "vision": false,
        "cost": [
          1,
          20
        ],
        "release": "2025-05-01"
      },
      {
        "id": "gemini-2.5-flash-preview-tts",
        "name": "Gemini 2.5 Flash Preview TTS",
        "ctx": 8000,
        "out": 16000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.5,
          10
        ],
        "release": "2025-05-01"
      },
      {
        "id": "gemini-2.5-flash-preview-04-17",
        "name": "Gemini 2.5 Flash Preview 04-17",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2025-04-17"
      },
      {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-03-20"
      },
      {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          2.5
        ],
        "release": "2025-03-20"
      },
      {
        "id": "gemma-3-4b-it",
        "name": "Gemma 3 4B",
        "ctx": 32768,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-13"
      },
      {
        "id": "gemma-3-12b-it",
        "name": "Gemma 3 12B",
        "ctx": 32768,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-13"
      },
      {
        "id": "gemma-3-27b-it",
        "name": "Gemma 3 27B",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-12"
      },
      {
        "id": "gemini-2.0-flash-lite",
        "name": "Gemini 2.0 Flash Lite",
        "ctx": 1048576,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.075,
          0.3
        ],
        "release": "2024-12-11"
      },
      {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "ctx": 1048576,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2024-12-11"
      },
      {
        "id": "gemini-1.5-flash-8b",
        "name": "Gemini 1.5 Flash-8B",
        "ctx": 1000000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.0375,
          0.15
        ],
        "release": "2024-10-03"
      },
      {
        "id": "gemini-1.5-flash",
        "name": "Gemini 1.5 Flash",
        "ctx": 1000000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.075,
          0.3
        ],
        "release": "2024-05-14"
      },
      {
        "id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "ctx": 1000000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          1.25,
          5
        ],
        "release": "2024-02-15"
      }
    ],
    "key_header": "x-goog-api-key"
  },
  {
    "id": "groq",
    "name": "Groq",
    "kind": "openai",
    "base_url": "https://api.groq.com/openai/v1",
    "models": [
      {
        "id": "canopylabs/orpheus-v1-english",
        "name": "Orpheus V1 English",
        "ctx": 4000,
        "out": 50000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-19"
      },
      {
        "id": "canopylabs/orpheus-arabic-saudi",
        "name": "Orpheus Arabic Saudi",
        "ctx": 4000,
        "out": 50000,
        "reasoning": false,
        "vision": false,
        "cost": [
          40,
          0
        ],
        "release": "2025-12-16"
      },
      {
        "id": "moonshotai/kimi-k2-instruct-0905",
        "name": "Kimi K2 Instruct 0905",
        "ctx": 262144,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          1,
          3
        ],
        "release": "2025-09-05"
      },
      {
        "id": "groq/compound-mini",
        "name": "Compound Mini",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-09-04"
      },
      {
        "id": "groq/compound",
        "name": "Compound",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-09-04"
      },
      {
        "id": "openai/gpt-oss-120b",
        "name": "GPT OSS 120B",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2025-08-05"
      },
      {
        "id": "openai/gpt-oss-20b",
        "name": "GPT OSS 20B",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.075,
          0.3
        ],
        "release": "2025-08-05"
      },
      {
        "id": "moonshotai/kimi-k2-instruct",
        "name": "Kimi K2 Instruct",
        "ctx": 131072,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          1,
          3
        ],
        "release": "2025-07-14"
      },
      {
        "id": "meta-llama/llama-guard-4-12b",
        "name": "Llama Guard 4 12B",
        "ctx": 131072,
        "out": 1024,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.2,
          0.2
        ],
        "release": "2025-04-05"
      },
      {
        "id": "meta-llama/llama-4-scout-17b-16e-instruct",
        "name": "Llama 4 Scout 17B",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.11,
          0.34
        ],
        "release": "2025-04-05"
      },
      {
        "id": "meta-llama/llama-4-maverick-17b-128e-instruct",
        "name": "Llama 4 Maverick 17B",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.2,
          0.6
        ],
        "release": "2025-04-05"
      },
      {
        "id": "openai/gpt-oss-safeguard-20b",
        "name": "Safety GPT OSS 20B",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.075,
          0.3
        ],
        "release": "2025-03-05"
      },
      {
        "id": "mistral-saba-24b",
        "name": "Mistral Saba 24B",
        "ctx": 32768,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.79,
          0.79
        ],
        "release": "2025-02-06"
      },
      {
        "id": "deepseek-r1-distill-llama-70b",
        "name": "DeepSeek R1 Distill Llama 70B",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.75,
          0.99
        ],
        "release": "2025-01-20"
      },
      {
        "id": "qwen/qwen3-32b",
        "name": "Qwen3 32B",
        "ctx": 131072,
        "out": 40960,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.29,
          0.59
        ],
        "release": "2024-12-23"
      },
      {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B Versatile",
        "ctx": 131072,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.59,
          0.79
        ],
        "release": "2024-12-06"
      },
      {
        "id": "qwen-qwq-32b",
        "name": "Qwen QwQ 32B",
        "ctx": 131072,
        "out": 16384,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.29,
          0.39
        ],
        "release": "2024-11-27"
      },
      {
        "id": "whisper-large-v3-turbo",
        "name": "Whisper Large v3 Turbo",
        "ctx": 448,
        "out": 448,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2024-10-01"
      },
      {
        "id": "meta-llama/llama-prompt-guard-2-22m",
        "name": "Llama Prompt Guard 2 22M",
        "ctx": 512,
        "out": 512,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.03,
          0.03
        ],
        "release": "2024-10-01"
      },
      {
        "id": "meta-llama/llama-prompt-guard-2-86m",
        "name": "Llama Prompt Guard 2 86M",
        "ctx": 512,
        "out": 512,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.04,
          0.04
        ],
        "release": "2024-10-01"
      },
      {
        "id": "allam-2-7b",
        "name": "ALLaM-2-7b",
        "ctx": 4096,
        "out": 4096,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2024-09"
      },
      {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B Instant",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.05,
          0.08
        ],
        "release": "2024-07-23"
      },
      {
        "id": "llama-guard-3-8b",
        "name": "Llama Guard 3 8B",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.2,
          0.2
        ],
        "release": "2024-07-23"
      },
      {
        "id": "gemma2-9b-it",
        "name": "Gemma 2 9B",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.2,
          0.2
        ],
        "release": "2024-06-27"
      },
      {
        "id": "llama3-70b-8192",
        "name": "Llama 3 70B",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.59,
          0.79
        ],
        "release": "2024-04-18"
      },
      {
        "id": "llama3-8b-8192",
        "name": "Llama 3 8B",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.05,
          0.08
        ],
        "release": "2024-04-18"
      },
      {
        "id": "whisper-large-v3",
        "name": "Whisper Large V3",
        "ctx": 448,
        "out": 448,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2023-09-01"
      }
    ]
  },
  {
    "id": "mistral",
    "name": "Mistral",
    "kind": "openai",
    "base_url": "https://api.mistral.ai/v1",
    "models": [
      {
        "id": "mistral-small-2603",
        "name": "Mistral Small 4",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2026-03-16"
      },
      {
        "id": "mistral-small-latest",
        "name": "Mistral Small (latest)",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2026-03-16"
      },
      {
        "id": "devstral-2512",
        "name": "Devstral 2",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-12-09"
      },
      {
        "id": "labs-devstral-small-2512",
        "name": "Devstral Small 2",
        "ctx": 256000,
        "out": 256000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-09"
      },
      {
        "id": "devstral-medium-latest",
        "name": "Devstral 2 (latest)",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-12-02"
      },
      {
        "id": "mistral-medium-2508",
        "name": "Mistral Medium 3.1",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-08-12"
      },
      {
        "id": "devstral-medium-2507",
        "name": "Devstral Medium",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-07-10"
      },
      {
        "id": "devstral-small-2507",
        "name": "Devstral Small",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0.3
        ],
        "release": "2025-07-10"
      },
      {
        "id": "mistral-small-2506",
        "name": "Mistral Small 3.2",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0.3
        ],
        "release": "2025-06-20"
      },
      {
        "id": "devstral-small-2505",
        "name": "Devstral Small 2505",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0.3
        ],
        "release": "2025-05-07"
      },
      {
        "id": "mistral-medium-latest",
        "name": "Mistral Medium (latest)",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-05-07"
      },
      {
        "id": "mistral-medium-2505",
        "name": "Mistral Medium 3",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-05-07"
      },
      {
        "id": "magistral-small",
        "name": "Magistral Small",
        "ctx": 128000,
        "out": 128000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.5,
          1.5
        ],
        "release": "2025-03-17"
      },
      {
        "id": "magistral-medium-latest",
        "name": "Magistral Medium (latest)",
        "ctx": 128000,
        "out": 16384,
        "reasoning": true,
        "vision": false,
        "cost": [
          2,
          5
        ],
        "release": "2025-03-17"
      },
      {
        "id": "pixtral-large-latest",
        "name": "Pixtral Large (latest)",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          6
        ],
        "release": "2024-11-01"
      },
      {
        "id": "mistral-large-latest",
        "name": "Mistral Large (latest)",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.5,
          1.5
        ],
        "release": "2024-11-01"
      },
      {
        "id": "mistral-large-2411",
        "name": "Mistral Large 2.1",
        "ctx": 131072,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          2,
          6
        ],
        "release": "2024-11-01"
      },
      {
        "id": "mistral-large-2512",
        "name": "Mistral Large 3",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.5,
          1.5
        ],
        "release": "2024-11-01"
      },
      {
        "id": "ministral-3b-latest",
        "name": "Ministral 3B (latest)",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.04,
          0.04
        ],
        "release": "2024-10-01"
      },
      {
        "id": "ministral-8b-latest",
        "name": "Ministral 8B (latest)",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0.1
        ],
        "release": "2024-10-01"
      },
      {
        "id": "pixtral-12b",
        "name": "Pixtral 12B",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.15,
          0.15
        ],
        "release": "2024-09-01"
      },
      {
        "id": "mistral-nemo",
        "name": "Mistral Nemo",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.15,
          0.15
        ],
        "release": "2024-07-01"
      },
      {
        "id": "codestral-latest",
        "name": "Codestral (latest)",
        "ctx": 256000,
        "out": 4096,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.3,
          0.9
        ],
        "release": "2024-05-29"
      },
      {
        "id": "open-mixtral-8x22b",
        "name": "Mixtral 8x22B",
        "ctx": 64000,
        "out": 64000,
        "reasoning": false,
        "vision": false,
        "cost": [
          2,
          6
        ],
        "release": "2024-04-17"
      },
      {
        "id": "mistral-embed",
        "name": "Mistral Embed",
        "ctx": 8000,
        "out": 3072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0
        ],
        "release": "2023-12-11"
      },
      {
        "id": "open-mixtral-8x7b",
        "name": "Mixtral 8x7B",
        "ctx": 32000,
        "out": 32000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.7,
          0.7
        ],
        "release": "2023-12-11"
      },
      {
        "id": "open-mistral-7b",
        "name": "Mistral 7B",
        "ctx": 8000,
        "out": 8000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.25,
          0.25
        ],
        "release": "2023-09-27"
      }
    ]
  },
  {
    "id": "moonshotai",
    "name": "Moonshot AI",
    "kind": "openai",
    "base_url": "https://api.moonshot.ai/v1",
    "models": [
      {
        "id": "kimi-k2.5",
        "name": "Kimi K2.5",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          3
        ],
        "release": "2026-01"
      },
      {
        "id": "kimi-k2-thinking",
        "name": "Kimi K2 Thinking",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-11-06"
      },
      {
        "id": "kimi-k2-thinking-turbo",
        "name": "Kimi K2 Thinking Turbo",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.15,
          8
        ],
        "release": "2025-11-06"
      },
      {
        "id": "kimi-k2-0905-preview",
        "name": "Kimi K2 0905",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-09-05"
      },
      {
        "id": "kimi-k2-turbo-preview",
        "name": "Kimi K2 Turbo",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          2.4,
          10
        ],
        "release": "2025-09-05"
      },
      {
        "id": "kimi-k2-0711-preview",
        "name": "Kimi K2 0711",
        "ctx": 131072,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-07-14"
      }
    ]
  },
  {
    "id": "openai",
    "name": "OpenAI",
    "kind": "openai",
    "base_url": "https://api.openai.com/v1",
    "models": [
      {
        "id": "gpt-5.4-mini",
        "name": "GPT-5.4 mini",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.75,
          4.5
        ],
        "release": "2026-03-17"
      },
      {
        "id": "gpt-5.4-nano",
        "name": "GPT-5.4 nano",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.2,
          1.25
        ],
        "release": "2026-03-17"
      },
      {
        "id": "gpt-5.4-pro",
        "name": "GPT-5.4 Pro",
        "ctx": 1050000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          30,
          180
        ],
        "release": "2026-03-05"
      },
      {
        "id": "gpt-5.4",
        "name": "GPT-5.4",
        "ctx": 1050000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2.5,
          15
        ],
        "release": "2026-03-05"
      },
      {
        "id": "gpt-5.3-chat-latest",
        "name": "GPT-5.3 Chat (latest)",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2026-03-03"
      },
      {
        "id": "gpt-5.3-codex",
        "name": "GPT-5.3 Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2026-02-05"
      },
      {
        "id": "gpt-5.3-codex-spark",
        "name": "GPT-5.3 Codex Spark",
        "ctx": 128000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2026-02-05"
      },
      {
        "id": "chatgpt-image-latest",
        "name": "chatgpt-image-latest",
        "ctx": 0,
        "out": 0,
        "reasoning": false,
        "vision": true,
        "release": "2025-12-16"
      },
      {
        "id": "gpt-5.2-codex",
        "name": "GPT-5.2 Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2025-12-11"
      },
      {
        "id": "gpt-5.2-chat-latest",
        "name": "GPT-5.2 Chat",
        "ctx": 128000,
        "out": 16384,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2025-12-11"
      },
      {
        "id": "gpt-5.2",
        "name": "GPT-5.2",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2025-12-11"
      },
      {
        "id": "gpt-5.2-pro",
        "name": "GPT-5.2 Pro",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          21,
          168
        ],
        "release": "2025-12-11"
      },
      {
        "id": "gpt-image-1.5",
        "name": "gpt-image-1.5",
        "ctx": 0,
        "out": 0,
        "reasoning": false,
        "vision": true,
        "release": "2025-11-25"
      },
      {
        "id": "gpt-5.1-codex-mini",
        "name": "GPT-5.1 Codex mini",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          2
        ],
        "release": "2025-11-13"
      },
      {
        "id": "gpt-5.1-codex-max",
        "name": "GPT-5.1 Codex Max",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "gpt-5.1-chat-latest",
        "name": "GPT-5.1 Chat",
        "ctx": 128000,
        "out": 16384,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "gpt-5.1",
        "name": "GPT-5.1",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "gpt-5.1-codex",
        "name": "GPT-5.1 Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "gpt-5-pro",
        "name": "GPT-5 Pro",
        "ctx": 400000,
        "out": 272000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          120
        ],
        "release": "2025-10-06"
      },
      {
        "id": "gpt-image-1-mini",
        "name": "gpt-image-1-mini",
        "ctx": 0,
        "out": 0,
        "reasoning": false,
        "vision": true,
        "release": "2025-09-26"
      },
      {
        "id": "gpt-5-codex",
        "name": "GPT-5-Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-09-15"
      },
      {
        "id": "gpt-5",
        "name": "GPT-5",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-08-07"
      },
      {
        "id": "gpt-5-mini",
        "name": "GPT-5 Mini",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          2
        ],
        "release": "2025-08-07"
      },
      {
        "id": "gpt-5-chat-latest",
        "name": "GPT-5 Chat (latest)",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-08-07"
      },
      {
        "id": "gpt-5-nano",
        "name": "GPT-5 Nano",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.05,
          0.4
        ],
        "release": "2025-08-07"
      },
      {
        "id": "o3-pro",
        "name": "o3-pro",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          20,
          80
        ],
        "release": "2025-06-10"
      },
      {
        "id": "codex-mini-latest",
        "name": "Codex Mini",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.5,
          6
        ],
        "release": "2025-05-16"
      },
      {
        "id": "gpt-image-1",
        "name": "gpt-image-1",
        "ctx": 0,
        "out": 0,
        "reasoning": false,
        "vision": true,
        "release": "2025-04-24"
      },
      {
        "id": "o3",
        "name": "o3",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          8
        ],
        "release": "2025-04-16"
      },
      {
        "id": "o4-mini",
        "name": "o4-mini",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.1,
          4.4
        ],
        "release": "2025-04-16"
      },
      {
        "id": "gpt-4.1",
        "name": "GPT-4.1",
        "ctx": 1047576,
        "out": 32768,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          8
        ],
        "release": "2025-04-14"
      },
      {
        "id": "gpt-4.1-mini",
        "name": "GPT-4.1 mini",
        "ctx": 1047576,
        "out": 32768,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.4,
          1.6
        ],
        "release": "2025-04-14"
      },
      {
        "id": "gpt-4.1-nano",
        "name": "GPT-4.1 nano",
        "ctx": 1047576,
        "out": 32768,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-04-14"
      },
      {
        "id": "o1-pro",
        "name": "o1-pro",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          150,
          600
        ],
        "release": "2025-03-19"
      },
      {
        "id": "o3-mini",
        "name": "o3-mini",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.1,
          4.4
        ],
        "release": "2024-12-20"
      },
      {
        "id": "o1",
        "name": "o1",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          60
        ],
        "release": "2024-12-05"
      },
      {
        "id": "gpt-4o-2024-11-20",
        "name": "GPT-4o (2024-11-20)",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": true,
        "cost": [
          2.5,
          10
        ],
        "release": "2024-11-20"
      },
      {
        "id": "o1-preview",
        "name": "o1-preview",
        "ctx": 128000,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          15,
          60
        ],
        "release": "2024-09-12"
      },
      {
        "id": "o1-mini",
        "name": "o1-mini",
        "ctx": 128000,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.1,
          4.4
        ],
        "release": "2024-09-12"
      },
      {
        "id": "gpt-4o-2024-08-06",
        "name": "GPT-4o (2024-08-06)",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": true,
        "cost": [
          2.5,
          10
        ],
        "release": "2024-08-06"
      },
      {
        "id": "gpt-4o-mini",
        "name": "GPT-4o mini",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2024-07-18"
      },
      {
        "id": "o4-mini-deep-research",
        "name": "o4-mini-deep-research",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          8
        ],
        "release": "2024-06-26"
      },
      {
        "id": "o3-deep-research",
        "name": "o3-deep-research",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          10,
          40
        ],
        "release": "2024-06-26"
      },
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": true,
        "cost": [
          2.5,
          10
        ],
        "release": "2024-05-13"
      },
      {
        "id": "gpt-4o-2024-05-13",
        "name": "GPT-4o (2024-05-13)",
        "ctx": 128000,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          5,
          15
        ],
        "release": "2024-05-13"
      },
      {
        "id": "text-embedding-3-large",
        "name": "text-embedding-3-large",
        "ctx": 8191,
        "out": 3072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.13,
          0
        ],
        "release": "2024-01-25"
      },
      {
        "id": "text-embedding-3-small",
        "name": "text-embedding-3-small",
        "ctx": 8191,
        "out": 1536,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.02,
          0
        ],
        "release": "2024-01-25"
      },
      {
        "id": "gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "ctx": 128000,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          10,
          30
        ],
        "release": "2023-11-06"
      },
      {
        "id": "gpt-4",
        "name": "GPT-4",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          30,
          60
        ],
        "release": "2023-11-06"
      },
      {
        "id": "gpt-3.5-turbo",
        "name": "GPT-3.5-turbo",
        "ctx": 16385,
        "out": 4096,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.5,
          1.5
        ],
        "release": "2023-03-01"
      },
      {
        "id": "text-embedding-ada-002",
        "name": "text-embedding-ada-002",
        "ctx": 8192,
        "out": 1536,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0
        ],
        "release": "2022-12-15"
      }
    ]
  },
  {
    "id": "openrouter",
    "name": "OpenRouter",
    "kind": "openai",
    "base_url": "https://openrouter.ai/api/v1",
    "models": [
      {
        "id": "z-ai/glm-5.1",
        "name": "GLM-5.1",
        "ctx": 202752,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.4,
          4.4
        ],
        "release": "2026-04-07"
      },
      {
        "id": "google/gemma-4-26b-a4b-it",
        "name": "Gemma 4 26B A4B",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.13,
          0.4
        ],
        "release": "2026-04-03"
      },
      {
        "id": "google/gemma-4-31b-it",
        "name": "Gemma 4 31B",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.14,
          0.4
        ],
        "release": "2026-04-02"
      },
      {
        "id": "qwen/qwen3.6-plus:free",
        "name": "Qwen3.6 Plus (free)",
        "ctx": 1000000,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2026-04-02"
      },
      {
        "id": "arcee-ai/trinity-large-thinking",
        "name": "Trinity Large Thinking",
        "ctx": 262144,
        "out": 80000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.22,
          0.85
        ],
        "release": "2026-04-01"
      },
      {
        "id": "minimax/minimax-m2.7",
        "name": "MiniMax M2.7",
        "ctx": 204800,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2026-03-18"
      },
      {
        "id": "xiaomi/mimo-v2-pro",
        "name": "MiMo-V2-Pro",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          1,
          3
        ],
        "release": "2026-03-18"
      },
      {
        "id": "xiaomi/mimo-v2-omni",
        "name": "MiMo-V2-Omni",
        "ctx": 262144,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.4,
          2
        ],
        "release": "2026-03-18"
      },
      {
        "id": "openai/gpt-5.4-mini",
        "name": "GPT-5.4 Mini",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          7.5e-7,
          0.0000045
        ],
        "release": "2026-03-17"
      },
      {
        "id": "openai/gpt-5.4-nano",
        "name": "GPT-5.4 Nano",
        "ctx": 400000,
        "out": 128000,
        "reasoning": false,
        "vision": true,
        "cost": [
          2e-7,
          0.00000125
        ],
        "release": "2026-03-17"
      },
      {
        "id": "z-ai/glm-5-turbo",
        "name": "GLM-5-Turbo",
        "ctx": 202752,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.96,
          3.2
        ],
        "release": "2026-03-16"
      },
      {
        "id": "mistralai/mistral-small-2603",
        "name": "Mistral Small 4",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2026-03-16"
      },
      {
        "id": "x-ai/grok-4.20-beta",
        "name": "Grok 4.20 Beta",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          6
        ],
        "release": "2026-03-12"
      },
      {
        "id": "x-ai/grok-4.20-multi-agent-beta",
        "name": "Grok 4.20 Multi - Agent Beta",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          6
        ],
        "release": "2026-03-12"
      },
      {
        "id": "nvidia/nemotron-3-super-120b-a12b",
        "name": "Nemotron 3 Super",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.1,
          0.5
        ],
        "release": "2026-03-11"
      },
      {
        "id": "nvidia/nemotron-3-super-120b-a12b:free",
        "name": "Nemotron 3 Super (free)",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-03-11"
      },
      {
        "id": "openai/gpt-5.4-pro",
        "name": "GPT-5.4 Pro",
        "ctx": 1050000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          30,
          180
        ],
        "release": "2026-03-05"
      },
      {
        "id": "openai/gpt-5.4",
        "name": "GPT-5.4",
        "ctx": 1050000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2.5,
          15
        ],
        "release": "2026-03-05"
      },
      {
        "id": "inception/mercury-2",
        "name": "Mercury 2",
        "ctx": 128000,
        "out": 50000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.25,
          0.75
        ],
        "release": "2026-03-04"
      },
      {
        "id": "google/gemini-3.1-flash-lite-preview",
        "name": "Gemini 3.1 Flash Lite Preview",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          1.5
        ],
        "release": "2026-03-03"
      },
      {
        "id": "openai/gpt-5.3-codex",
        "name": "GPT-5.3-Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2026-02-24"
      },
      {
        "id": "google/gemini-3.1-pro-preview",
        "name": "Gemini 3.1 Pro Preview",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          12
        ],
        "release": "2026-02-19"
      },
      {
        "id": "google/gemini-3.1-pro-preview-customtools",
        "name": "Gemini 3.1 Pro Preview Custom Tools",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          12
        ],
        "release": "2026-02-19"
      },
      {
        "id": "anthropic/claude-sonnet-4.6",
        "name": "Claude Sonnet 4.6",
        "ctx": 1000000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2026-02-17"
      },
      {
        "id": "qwen/qwen3.5-plus-02-15",
        "name": "Qwen3.5 Plus 2026-02-15",
        "ctx": 1000000,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.4,
          2.4
        ],
        "release": "2026-02-16"
      },
      {
        "id": "qwen/qwen3.5-397b-a17b",
        "name": "Qwen3.5 397B A17B",
        "ctx": 262144,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.6,
          3.6
        ],
        "release": "2026-02-16"
      },
      {
        "id": "z-ai/glm-5",
        "name": "GLM-5",
        "ctx": 202752,
        "out": 131000,
        "reasoning": true,
        "vision": false,
        "cost": [
          1,
          3.2
        ],
        "release": "2026-02-12"
      },
      {
        "id": "minimax/minimax-m2.5",
        "name": "MiniMax M2.5",
        "ctx": 204800,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2026-02-12"
      },
      {
        "id": "anthropic/claude-opus-4.6",
        "name": "Claude Opus 4.6",
        "ctx": 1000000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          5,
          25
        ],
        "release": "2026-02-05"
      },
      {
        "id": "openrouter/free",
        "name": "Free Models Router",
        "ctx": 200000,
        "out": 8000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2026-02-01"
      },
      {
        "id": "stepfun/step-3.5-flash",
        "name": "Step 3.5 Flash",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.1,
          0.3
        ],
        "release": "2026-01-29"
      },
      {
        "id": "stepfun/step-3.5-flash:free",
        "name": "Step 3.5 Flash (free)",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-29"
      },
      {
        "id": "arcee-ai/trinity-mini:free",
        "name": "Trinity Mini",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-28"
      },
      {
        "id": "arcee-ai/trinity-large-preview:free",
        "name": "Trinity Large Preview",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-28"
      },
      {
        "id": "moonshotai/kimi-k2.5",
        "name": "Kimi K2.5",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.6,
          3
        ],
        "release": "2026-01-27"
      },
      {
        "id": "liquid/lfm-2.5-1.2b-instruct:free",
        "name": "LFM2.5-1.2B-Instruct (free)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-20"
      },
      {
        "id": "liquid/lfm-2.5-1.2b-thinking:free",
        "name": "LFM2.5-1.2B-Thinking (free)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-20"
      },
      {
        "id": "z-ai/glm-4.7-flash",
        "name": "GLM-4.7-Flash",
        "ctx": 200000,
        "out": 65535,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.07,
          0.4
        ],
        "release": "2026-01-19"
      },
      {
        "id": "openai/gpt-5.2-codex",
        "name": "GPT-5.2-Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2026-01-14"
      },
      {
        "id": "black-forest-labs/flux.2-klein-4b",
        "name": "FLUX.2 Klein 4B",
        "ctx": 40960,
        "out": 40960,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2026-01-14"
      },
      {
        "id": "minimax/minimax-m2.1",
        "name": "MiniMax M2.1",
        "ctx": 204800,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2025-12-23"
      },
      {
        "id": "bytedance-seed/seedream-4.5",
        "name": "Seedream 4.5",
        "ctx": 4096,
        "out": 4096,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-23"
      },
      {
        "id": "z-ai/glm-4.7",
        "name": "GLM-4.7",
        "ctx": 204800,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.2
        ],
        "release": "2025-12-22"
      },
      {
        "id": "google/gemini-3-flash-preview",
        "name": "Gemini 3 Flash Preview",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.5,
          3
        ],
        "release": "2025-12-17"
      },
      {
        "id": "black-forest-labs/flux.2-max",
        "name": "FLUX.2 Max",
        "ctx": 46864,
        "out": 46864,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-16"
      },
      {
        "id": "nvidia/nemotron-3-nano-30b-a3b:free",
        "name": "Nemotron 3 Nano 30B A3B (free)",
        "ctx": 256000,
        "out": 256000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-14"
      },
      {
        "id": "xiaomi/mimo-v2-flash",
        "name": "MiMo-V2-Flash",
        "ctx": 262144,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.1,
          0.3
        ],
        "release": "2025-12-14"
      },
      {
        "id": "openai/gpt-5.2-chat",
        "name": "GPT-5.2 Chat",
        "ctx": 128000,
        "out": 16384,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2025-12-11"
      },
      {
        "id": "openai/gpt-5.2",
        "name": "GPT-5.2",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.75,
          14
        ],
        "release": "2025-12-11"
      },
      {
        "id": "openai/gpt-5.2-pro",
        "name": "GPT-5.2 Pro",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          21,
          168
        ],
        "release": "2025-12-11"
      },
      {
        "id": "sourceful/riverflow-v2-standard-preview",
        "name": "Riverflow V2 Standard Preview",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-08"
      },
      {
        "id": "sourceful/riverflow-v2-fast-preview",
        "name": "Riverflow V2 Fast Preview",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-08"
      },
      {
        "id": "sourceful/riverflow-v2-max-preview",
        "name": "Riverflow V2 Max Preview",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-12-08"
      },
      {
        "id": "deepseek/deepseek-v3.2-speciale",
        "name": "DeepSeek V3.2 Speciale",
        "ctx": 163840,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.27,
          0.41
        ],
        "release": "2025-12-01"
      },
      {
        "id": "deepseek/deepseek-v3.2",
        "name": "DeepSeek V3.2",
        "ctx": 163840,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.28,
          0.4
        ],
        "release": "2025-12-01"
      },
      {
        "id": "black-forest-labs/flux.2-pro",
        "name": "FLUX.2 Pro",
        "ctx": 46864,
        "out": 46864,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-11-25"
      },
      {
        "id": "black-forest-labs/flux.2-flex",
        "name": "FLUX.2 Flex",
        "ctx": 67344,
        "out": 67344,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-11-25"
      },
      {
        "id": "anthropic/claude-opus-4.5",
        "name": "Claude Opus 4.5",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          5,
          25
        ],
        "release": "2025-11-24"
      },
      {
        "id": "x-ai/grok-4.1-fast",
        "name": "Grok 4.1 Fast",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          0.5
        ],
        "release": "2025-11-19"
      },
      {
        "id": "google/gemini-3-pro-preview",
        "name": "Gemini 3 Pro Preview",
        "ctx": 1050000,
        "out": 66000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          12
        ],
        "release": "2025-11-18"
      },
      {
        "id": "openai/gpt-5.1-codex-mini",
        "name": "GPT-5.1-Codex-Mini",
        "ctx": 400000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          2
        ],
        "release": "2025-11-13"
      },
      {
        "id": "openai/gpt-5.1-codex-max",
        "name": "GPT-5.1-Codex-Max",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.1,
          9
        ],
        "release": "2025-11-13"
      },
      {
        "id": "openai/gpt-5.1-chat",
        "name": "GPT-5.1 Chat",
        "ctx": 128000,
        "out": 16384,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "openai/gpt-5.1",
        "name": "GPT-5.1",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "openai/gpt-5.1-codex",
        "name": "GPT-5.1-Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-11-13"
      },
      {
        "id": "moonshotai/kimi-k2-thinking",
        "name": "Kimi K2 Thinking",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-11-06"
      },
      {
        "id": "openai/gpt-oss-safeguard-20b",
        "name": "GPT OSS Safeguard 20B",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.075,
          0.3
        ],
        "release": "2025-10-29"
      },
      {
        "id": "nvidia/nemotron-nano-12b-v2-vl:free",
        "name": "Nemotron Nano 12B 2 VL (free)",
        "ctx": 128000,
        "out": 128000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-10-28"
      },
      {
        "id": "minimax/minimax-m2",
        "name": "MiniMax M2",
        "ctx": 196600,
        "out": 118000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.28,
          1.15
        ],
        "release": "2025-10-23"
      },
      {
        "id": "anthropic/claude-haiku-4.5",
        "name": "Claude Haiku 4.5",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1,
          5
        ],
        "release": "2025-10-15"
      },
      {
        "id": "openai/gpt-5-image",
        "name": "GPT-5 Image",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          5,
          10
        ],
        "release": "2025-10-14"
      },
      {
        "id": "openai/gpt-5-pro",
        "name": "GPT-5 Pro",
        "ctx": 400000,
        "out": 272000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          120
        ],
        "release": "2025-10-06"
      },
      {
        "id": "z-ai/glm-4.6",
        "name": "GLM 4.6",
        "ctx": 200000,
        "out": 128000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.2
        ],
        "release": "2025-09-30"
      },
      {
        "id": "z-ai/glm-4.6:exacto",
        "name": "GLM 4.6 (exacto)",
        "ctx": 200000,
        "out": 128000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          1.9
        ],
        "release": "2025-09-30"
      },
      {
        "id": "anthropic/claude-sonnet-4.5",
        "name": "Claude Sonnet 4.5",
        "ctx": 1000000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-09-29"
      },
      {
        "id": "google/gemini-2.5-flash-lite-preview-09-2025",
        "name": "Gemini 2.5 Flash Lite Preview 09-25",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-09-25"
      },
      {
        "id": "google/gemini-2.5-flash-preview-09-2025",
        "name": "Gemini 2.5 Flash Preview 09-25",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          2.5
        ],
        "release": "2025-09-25"
      },
      {
        "id": "deepseek/deepseek-v3.1-terminus",
        "name": "DeepSeek V3.1 Terminus",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.27,
          1
        ],
        "release": "2025-09-22"
      },
      {
        "id": "deepseek/deepseek-v3.1-terminus:exacto",
        "name": "DeepSeek V3.1 Terminus (exacto)",
        "ctx": 131072,
        "out": 65536,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.27,
          1
        ],
        "release": "2025-09-22"
      },
      {
        "id": "openai/gpt-5-codex",
        "name": "GPT-5 Codex",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-09-15"
      },
      {
        "id": "mistralai/devstral-2512",
        "name": "Devstral 2 2512",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2025-09-12"
      },
      {
        "id": "qwen/qwen3-next-80b-a3b-thinking",
        "name": "Qwen3 Next 80B A3B Thinking",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.14,
          1.4
        ],
        "release": "2025-09-11"
      },
      {
        "id": "qwen/qwen3-next-80b-a3b-instruct:free",
        "name": "Qwen3 Next 80B A3B Instruct (free)",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-09-11"
      },
      {
        "id": "qwen/qwen3-next-80b-a3b-instruct",
        "name": "Qwen3 Next 80B A3B Instruct",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.14,
          1.4
        ],
        "release": "2025-09-11"
      },
      {
        "id": "nvidia/nemotron-nano-9b-v2:free",
        "name": "Nemotron Nano 9B V2 (free)",
        "ctx": 128000,
        "out": 128000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-09-05"
      },
      {
        "id": "qwen/qwen3-max",
        "name": "Qwen3 Max",
        "ctx": 262144,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.2,
          6
        ],
        "release": "2025-09-05"
      },
      {
        "id": "moonshotai/kimi-k2-0905",
        "name": "Kimi K2 Instruct 0905",
        "ctx": 262144,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-09-05"
      },
      {
        "id": "moonshotai/kimi-k2-0905:exacto",
        "name": "Kimi K2 Instruct 0905 (exacto)",
        "ctx": 262144,
        "out": 16384,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.6,
          2.5
        ],
        "release": "2025-09-05"
      },
      {
        "id": "x-ai/grok-code-fast-1",
        "name": "Grok Code Fast 1",
        "ctx": 256000,
        "out": 10000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          1.5
        ],
        "release": "2025-08-26"
      },
      {
        "id": "nousresearch/hermes-4-70b",
        "name": "Hermes 4 70B",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.13,
          0.4
        ],
        "release": "2025-08-25"
      },
      {
        "id": "nousresearch/hermes-4-405b",
        "name": "Hermes 4 405B",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          1,
          3
        ],
        "release": "2025-08-25"
      },
      {
        "id": "deepseek/deepseek-chat-v3.1",
        "name": "DeepSeek-V3.1",
        "ctx": 163840,
        "out": 163840,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          0.8
        ],
        "release": "2025-08-21"
      },
      {
        "id": "x-ai/grok-4-fast",
        "name": "Grok 4 Fast",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          0.5
        ],
        "release": "2025-08-19"
      },
      {
        "id": "nvidia/nemotron-nano-9b-v2",
        "name": "nvidia-nemotron-nano-9b-v2",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.04,
          0.16
        ],
        "release": "2025-08-18"
      },
      {
        "id": "mistralai/mistral-medium-3.1",
        "name": "Mistral Medium 3.1",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-08-12"
      },
      {
        "id": "z-ai/glm-4.5v",
        "name": "GLM 4.5V",
        "ctx": 64000,
        "out": 16384,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.6,
          1.8
        ],
        "release": "2025-08-11"
      },
      {
        "id": "openai/gpt-5",
        "name": "GPT-5",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-08-07"
      },
      {
        "id": "openai/gpt-5-mini",
        "name": "GPT-5 Mini",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.25,
          2
        ],
        "release": "2025-08-07"
      },
      {
        "id": "openai/gpt-5-chat",
        "name": "GPT-5 Chat (latest)",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-08-07"
      },
      {
        "id": "openai/gpt-5-nano",
        "name": "GPT-5 Nano",
        "ctx": 400000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.05,
          0.4
        ],
        "release": "2025-08-07"
      },
      {
        "id": "openai/gpt-oss-120b:free",
        "name": "gpt-oss-120b (free)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-08-05"
      },
      {
        "id": "openai/gpt-oss-120b:exacto",
        "name": "GPT OSS 120B (exacto)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.05,
          0.24
        ],
        "release": "2025-08-05"
      },
      {
        "id": "openai/gpt-oss-120b",
        "name": "GPT OSS 120B",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.072,
          0.28
        ],
        "release": "2025-08-05"
      },
      {
        "id": "openai/gpt-oss-20b:free",
        "name": "gpt-oss-20b (free)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-08-05"
      },
      {
        "id": "openai/gpt-oss-20b",
        "name": "GPT OSS 20B",
        "ctx": 131072,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.05,
          0.2
        ],
        "release": "2025-08-05"
      },
      {
        "id": "anthropic/claude-opus-4.1",
        "name": "Claude Opus 4.1",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-08-05"
      },
      {
        "id": "mistralai/codestral-2508",
        "name": "Codestral 2508",
        "ctx": 256000,
        "out": 256000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.3,
          0.9
        ],
        "release": "2025-08-01"
      },
      {
        "id": "qwen/qwen3-coder-30b-a3b-instruct",
        "name": "Qwen3 Coder 30B A3B Instruct",
        "ctx": 160000,
        "out": 65536,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.07,
          0.27
        ],
        "release": "2025-07-31"
      },
      {
        "id": "qwen/qwen3-30b-a3b-thinking-2507",
        "name": "Qwen3 30B A3B Thinking 2507",
        "ctx": 262000,
        "out": 262000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          0.8
        ],
        "release": "2025-07-29"
      },
      {
        "id": "qwen/qwen3-30b-a3b-instruct-2507",
        "name": "Qwen3 30B A3B Instruct 2507",
        "ctx": 262000,
        "out": 262000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.2,
          0.8
        ],
        "release": "2025-07-29"
      },
      {
        "id": "z-ai/glm-4.5",
        "name": "GLM 4.5",
        "ctx": 128000,
        "out": 96000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          2.2
        ],
        "release": "2025-07-28"
      },
      {
        "id": "z-ai/glm-4.5-air:free",
        "name": "GLM 4.5 Air (free)",
        "ctx": 128000,
        "out": 96000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-07-28"
      },
      {
        "id": "z-ai/glm-4.5-air",
        "name": "GLM 4.5 Air",
        "ctx": 128000,
        "out": 96000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          1.1
        ],
        "release": "2025-07-28"
      },
      {
        "id": "qwen/qwen3-235b-a22b-thinking-2507",
        "name": "Qwen3 235B A22B Thinking 2507",
        "ctx": 262144,
        "out": 81920,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.078,
          0.312
        ],
        "release": "2025-07-25"
      },
      {
        "id": "qwen/qwen3-coder",
        "name": "Qwen3 Coder",
        "ctx": 262144,
        "out": 66536,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2025-07-23"
      },
      {
        "id": "qwen/qwen3-coder:free",
        "name": "Qwen3 Coder 480B A35B Instruct (free)",
        "ctx": 262144,
        "out": 66536,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-07-23"
      },
      {
        "id": "qwen/qwen3-coder:exacto",
        "name": "Qwen3 Coder (exacto)",
        "ctx": 131072,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.38,
          1.53
        ],
        "release": "2025-07-23"
      },
      {
        "id": "qwen/qwen3-coder-flash",
        "name": "Qwen3 Coder Flash",
        "ctx": 128000,
        "out": 66536,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.3,
          1.5
        ],
        "release": "2025-07-23"
      },
      {
        "id": "google/gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.3,
          2.5
        ],
        "release": "2025-07-17"
      },
      {
        "id": "moonshotai/kimi-k2",
        "name": "Kimi K2",
        "ctx": 131072,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.55,
          2.2
        ],
        "release": "2025-07-11"
      },
      {
        "id": "moonshotai/kimi-k2:free",
        "name": "Kimi K2 (free)",
        "ctx": 32800,
        "out": 32800,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-07-11"
      },
      {
        "id": "mistralai/devstral-medium-2507",
        "name": "Devstral Medium",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-07-10"
      },
      {
        "id": "mistralai/devstral-small-2507",
        "name": "Devstral Small 1.1",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.1,
          0.3
        ],
        "release": "2025-07-10"
      },
      {
        "id": "x-ai/grok-4",
        "name": "Grok 4",
        "ctx": 256000,
        "out": 64000,
        "reasoning": true,
        "vision": false,
        "cost": [
          3,
          15
        ],
        "release": "2025-07-09"
      },
      {
        "id": "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        "name": "Uncensored (free)",
        "ctx": 32768,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-07-09"
      },
      {
        "id": "google/gemma-3n-e2b-it:free",
        "name": "Gemma 3n 2B (free)",
        "ctx": 8192,
        "out": 2000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-07-09"
      },
      {
        "id": "inception/mercury",
        "name": "Mercury",
        "ctx": 128000,
        "out": 32000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.25,
          0.75
        ],
        "release": "2025-06-26"
      },
      {
        "id": "mistralai/mistral-small-3.2-24b-instruct",
        "name": "Mistral Small 3.2 24B Instruct",
        "ctx": 96000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-06-20"
      },
      {
        "id": "google/gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash Lite",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2025-06-17"
      },
      {
        "id": "minimax/minimax-m1",
        "name": "MiniMax M1",
        "ctx": 1000000,
        "out": 40000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.4,
          2.2
        ],
        "release": "2025-06-17"
      },
      {
        "id": "google/gemini-2.5-pro-preview-06-05",
        "name": "Gemini 2.5 Pro Preview 06-05",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-06-05"
      },
      {
        "id": "anthropic/claude-sonnet-4",
        "name": "Claude Sonnet 4",
        "ctx": 200000,
        "out": 64000,
        "reasoning": true,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2025-05-22"
      },
      {
        "id": "anthropic/claude-opus-4",
        "name": "Claude Opus 4",
        "ctx": 200000,
        "out": 32000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-05-22"
      },
      {
        "id": "google/gemma-3n-e4b-it",
        "name": "Gemma 3n 4B",
        "ctx": 32768,
        "out": 32768,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.02,
          0.04
        ],
        "release": "2025-05-20"
      },
      {
        "id": "google/gemma-3n-e4b-it:free",
        "name": "Gemma 3n 4B (free)",
        "ctx": 8192,
        "out": 2000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-05-20"
      },
      {
        "id": "mistralai/devstral-small-2505",
        "name": "Devstral Small",
        "ctx": 128000,
        "out": 128000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.06,
          0.12
        ],
        "release": "2025-05-07"
      },
      {
        "id": "mistralai/mistral-medium-3",
        "name": "Mistral Medium 3",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.4,
          2
        ],
        "release": "2025-05-07"
      },
      {
        "id": "google/gemini-2.5-pro-preview-05-06",
        "name": "Gemini 2.5 Pro Preview 05-06",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-05-06"
      },
      {
        "id": "qwen/qwen3-4b:free",
        "name": "Qwen3 4B (free)",
        "ctx": 40960,
        "out": 40960,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-04-30"
      },
      {
        "id": "inception/mercury-coder",
        "name": "Mercury Coder",
        "ctx": 128000,
        "out": 32000,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.25,
          0.75
        ],
        "release": "2025-04-30"
      },
      {
        "id": "qwen/qwen3-235b-a22b-07-25",
        "name": "Qwen3 235B A22B Instruct 2507",
        "ctx": 262144,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.15,
          0.85
        ],
        "release": "2025-04-28"
      },
      {
        "id": "openai/o4-mini",
        "name": "o4 Mini",
        "ctx": 200000,
        "out": 100000,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.1,
          4.4
        ],
        "release": "2025-04-16"
      },
      {
        "id": "openai/gpt-4.1",
        "name": "GPT-4.1",
        "ctx": 1047576,
        "out": 32768,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          8
        ],
        "release": "2025-04-14"
      },
      {
        "id": "openai/gpt-4.1-mini",
        "name": "GPT-4.1 Mini",
        "ctx": 1047576,
        "out": 32768,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.4,
          1.6
        ],
        "release": "2025-04-14"
      },
      {
        "id": "deepseek/deepseek-chat-v3-0324",
        "name": "DeepSeek V3 0324",
        "ctx": 16384,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-24"
      },
      {
        "id": "google/gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "ctx": 1048576,
        "out": 65536,
        "reasoning": true,
        "vision": true,
        "cost": [
          1.25,
          10
        ],
        "release": "2025-03-20"
      },
      {
        "id": "mistralai/mistral-small-3.1-24b-instruct",
        "name": "Mistral Small 3.1 24B Instruct",
        "ctx": 128000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-17"
      },
      {
        "id": "google/gemma-3-12b-it:free",
        "name": "Gemma 3 12B (free)",
        "ctx": 32768,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-13"
      },
      {
        "id": "google/gemma-3-4b-it",
        "name": "Gemma 3 4B",
        "ctx": 96000,
        "out": 96000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.01703,
          0.06815
        ],
        "release": "2025-03-13"
      },
      {
        "id": "google/gemma-3-4b-it:free",
        "name": "Gemma 3 4B (free)",
        "ctx": 32768,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-13"
      },
      {
        "id": "google/gemma-3-12b-it",
        "name": "Gemma 3 12B",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.03,
          0.1
        ],
        "release": "2025-03-13"
      },
      {
        "id": "google/gemma-3-27b-it",
        "name": "Gemma 3 27B",
        "ctx": 96000,
        "out": 96000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.04,
          0.15
        ],
        "release": "2025-03-12"
      },
      {
        "id": "google/gemma-3-27b-it:free",
        "name": "Gemma 3 27B (free)",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-03-12"
      },
      {
        "id": "anthropic/claude-3.7-sonnet",
        "name": "Claude Sonnet 3.7",
        "ctx": 200000,
        "out": 128000,
        "reasoning": true,
        "vision": true,
        "cost": [
          15,
          75
        ],
        "release": "2025-02-19"
      },
      {
        "id": "x-ai/grok-3-mini",
        "name": "Grok 3 Mini",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          0.5
        ],
        "release": "2025-02-17"
      },
      {
        "id": "x-ai/grok-3-beta",
        "name": "Grok 3 Beta",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          3,
          15
        ],
        "release": "2025-02-17"
      },
      {
        "id": "x-ai/grok-3",
        "name": "Grok 3",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          3,
          15
        ],
        "release": "2025-02-17"
      },
      {
        "id": "x-ai/grok-3-mini-beta",
        "name": "Grok 3 Mini Beta",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          0.5
        ],
        "release": "2025-02-17"
      },
      {
        "id": "qwen/qwen2.5-vl-72b-instruct",
        "name": "Qwen2.5 VL 72B Instruct",
        "ctx": 32768,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2025-02-01"
      },
      {
        "id": "deepseek/deepseek-r1-distill-llama-70b",
        "name": "DeepSeek R1 Distill Llama 70B",
        "ctx": 8192,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2025-01-23"
      },
      {
        "id": "prime-intellect/intellect-3",
        "name": "Intellect 3",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          1.1
        ],
        "release": "2025-01-15"
      },
      {
        "id": "minimax/minimax-01",
        "name": "MiniMax-01",
        "ctx": 1000000,
        "out": 1000000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.2,
          1.1
        ],
        "release": "2025-01-15"
      },
      {
        "id": "google/gemini-2.0-flash-001",
        "name": "Gemini 2.0 Flash",
        "ctx": 1048576,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.1,
          0.4
        ],
        "release": "2024-12-11"
      },
      {
        "id": "meta-llama/llama-3.3-70b-instruct:free",
        "name": "Llama 3.3 70B Instruct (free)",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2024-12-06"
      },
      {
        "id": "qwen/qwen-2.5-coder-32b-instruct",
        "name": "Qwen2.5 Coder 32B Instruct",
        "ctx": 32768,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2024-11-11"
      },
      {
        "id": "anthropic/claude-3.5-haiku",
        "name": "Claude Haiku 3.5",
        "ctx": 200000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.8,
          4
        ],
        "release": "2024-10-22"
      },
      {
        "id": "meta-llama/llama-3.2-11b-vision-instruct",
        "name": "Llama 3.2 11B Vision Instruct",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2024-09-25"
      },
      {
        "id": "meta-llama/llama-3.2-3b-instruct:free",
        "name": "Llama 3.2 3B Instruct (free)",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": true,
        "cost": [
          0,
          0
        ],
        "release": "2024-09-25"
      },
      {
        "id": "nousresearch/hermes-3-llama-3.1-405b:free",
        "name": "Hermes 3 405B Instruct (free)",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0,
          0
        ],
        "release": "2024-08-16"
      },
      {
        "id": "openai/gpt-4o-mini",
        "name": "GPT-4o-mini",
        "ctx": 128000,
        "out": 16384,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2024-07-18"
      },
      {
        "id": "google/gemma-2-9b-it",
        "name": "Gemma 2 9B",
        "ctx": 8192,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.03,
          0.09
        ],
        "release": "2024-06-28"
      }
    ]
  },
  {
    "id": "perplexity",
    "name": "Perplexity",
    "kind": "openai",
    "base_url": "https://api.perplexity.ai",
    "models": [
      {
        "id": "sonar-deep-research",
        "name": "Perplexity Sonar Deep Research",
        "ctx": 128000,
        "out": 32768,
        "reasoning": true,
        "vision": false,
        "cost": [
          2,
          8
        ],
        "release": "2025-02-01"
      },
      {
        "id": "sonar",
        "name": "Sonar",
        "ctx": 128000,
        "out": 4096,
        "reasoning": false,
        "vision": false,
        "cost": [
          1,
          1
        ],
        "release": "2024-01-01"
      },
      {
        "id": "sonar-reasoning-pro",
        "name": "Sonar Reasoning Pro",
        "ctx": 128000,
        "out": 4096,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          8
        ],
        "release": "2024-01-01"
      },
      {
        "id": "sonar-pro",
        "name": "Sonar Pro",
        "ctx": 200000,
        "out": 8192,
        "reasoning": false,
        "vision": true,
        "cost": [
          3,
          15
        ],
        "release": "2024-01-01"
      }
    ]
  },
  {
    "id": "togetherai",
    "name": "Together AI",
    "kind": "openai",
    "base_url": "https://api.together.xyz/v1",
    "models": [
      {
        "id": "Qwen/Qwen3.5-397B-A17B",
        "name": "Qwen3.5 397B A17B",
        "ctx": 262144,
        "out": 130000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          3.6
        ],
        "release": "2026-02-16"
      },
      {
        "id": "MiniMaxAI/MiniMax-M2.5",
        "name": "MiniMax-M2.5",
        "ctx": 204800,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          1.2
        ],
        "release": "2026-02-12"
      },
      {
        "id": "zai-org/GLM-5",
        "name": "GLM-5",
        "ctx": 202752,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          1,
          3.2
        ],
        "release": "2026-02-11"
      },
      {
        "id": "Qwen/Qwen3-Coder-Next-FP8",
        "name": "Qwen3 Coder Next FP8",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.5,
          1.2
        ],
        "release": "2026-02-03"
      },
      {
        "id": "moonshotai/Kimi-K2.5",
        "name": "Kimi K2.5",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.5,
          2.8
        ],
        "release": "2026-01-27"
      },
      {
        "id": "essentialai/Rnj-1-Instruct",
        "name": "Rnj-1 Instruct",
        "ctx": 32768,
        "out": 32768,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.15,
          0.15
        ],
        "release": "2025-12-05"
      },
      {
        "id": "deepseek-ai/DeepSeek-V3-1",
        "name": "DeepSeek V3.1",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          1.7
        ],
        "release": "2025-08-21"
      },
      {
        "id": "openai/gpt-oss-120b",
        "name": "GPT OSS 120B",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.15,
          0.6
        ],
        "release": "2025-08-05"
      },
      {
        "id": "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        "name": "Qwen3 235B A22B Instruct 2507 FP8",
        "ctx": 262144,
        "out": 262144,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          0.6
        ],
        "release": "2025-07-25"
      },
      {
        "id": "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
        "name": "Qwen3 Coder 480B A35B Instruct",
        "ctx": 262144,
        "out": 262144,
        "reasoning": false,
        "vision": false,
        "cost": [
          2,
          2
        ],
        "release": "2025-07-23"
      },
      {
        "id": "deepseek-ai/DeepSeek-V3",
        "name": "DeepSeek V3",
        "ctx": 131072,
        "out": 131072,
        "reasoning": true,
        "vision": false,
        "cost": [
          1.25,
          1.25
        ],
        "release": "2025-01-20"
      },
      {
        "id": "deepseek-ai/DeepSeek-R1",
        "name": "DeepSeek R1",
        "ctx": 163839,
        "out": 163839,
        "reasoning": true,
        "vision": false,
        "cost": [
          3,
          7
        ],
        "release": "2024-12-26"
      },
      {
        "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "name": "Llama 3.3 70B",
        "ctx": 131072,
        "out": 131072,
        "reasoning": false,
        "vision": false,
        "cost": [
          0.88,
          0.88
        ],
        "release": "2024-12-06"
      }
    ]
  },
  {
    "id": "xai",
    "name": "xAI",
    "kind": "openai",
    "base_url": "https://api.x.ai/v1",
    "models": [
      {
        "id": "grok-4.20-multi-agent-0309",
        "name": "Grok 4.20 Multi-Agent",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          6
        ],
        "release": "2026-03-09"
      },
      {
        "id": "grok-4.20-0309-reasoning",
        "name": "Grok 4.20 (Reasoning)",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": true,
        "cost": [
          2,
          6
        ],
        "release": "2026-03-09"
      },
      {
        "id": "grok-4.20-0309-non-reasoning",
        "name": "Grok 4.20 (Non-Reasoning)",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          6
        ],
        "release": "2026-03-09"
      },
      {
        "id": "grok-4-1-fast-non-reasoning",
        "name": "Grok 4.1 Fast (Non-Reasoning)",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.2,
          0.5
        ],
        "release": "2025-11-19"
      },
      {
        "id": "grok-4-1-fast",
        "name": "Grok 4.1 Fast",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.2,
          0.5
        ],
        "release": "2025-11-19"
      },
      {
        "id": "grok-4-fast",
        "name": "Grok 4 Fast",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": true,
        "vision": true,
        "cost": [
          0.2,
          0.5
        ],
        "release": "2025-09-19"
      },
      {
        "id": "grok-4-fast-non-reasoning",
        "name": "Grok 4 Fast (Non-Reasoning)",
        "ctx": 2000000,
        "out": 30000,
        "reasoning": false,
        "vision": true,
        "cost": [
          0.2,
          0.5
        ],
        "release": "2025-09-19"
      },
      {
        "id": "grok-code-fast-1",
        "name": "Grok Code Fast 1",
        "ctx": 256000,
        "out": 10000,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.2,
          1.5
        ],
        "release": "2025-08-28"
      },
      {
        "id": "grok-4",
        "name": "Grok 4",
        "ctx": 256000,
        "out": 64000,
        "reasoning": true,
        "vision": false,
        "cost": [
          3,
          15
        ],
        "release": "2025-07-09"
      },
      {
        "id": "grok-3-mini-fast",
        "name": "Grok 3 Mini Fast",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          4
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3-fast-latest",
        "name": "Grok 3 Fast Latest",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          5,
          25
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3-mini",
        "name": "Grok 3 Mini",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          0.5
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3-latest",
        "name": "Grok 3 Latest",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          3,
          15
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3-fast",
        "name": "Grok 3 Fast",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          5,
          25
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3-mini-fast-latest",
        "name": "Grok 3 Mini Fast Latest",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.6,
          4
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3",
        "name": "Grok 3",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          3,
          15
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-3-mini-latest",
        "name": "Grok 3 Mini Latest",
        "ctx": 131072,
        "out": 8192,
        "reasoning": true,
        "vision": false,
        "cost": [
          0.3,
          0.5
        ],
        "release": "2025-02-17"
      },
      {
        "id": "grok-2-1212",
        "name": "Grok 2 (1212)",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          2,
          10
        ],
        "release": "2024-12-12"
      },
      {
        "id": "grok-beta",
        "name": "Grok Beta",
        "ctx": 131072,
        "out": 4096,
        "reasoning": false,
        "vision": false,
        "cost": [
          5,
          15
        ],
        "release": "2024-11-01"
      },
      {
        "id": "grok-vision-beta",
        "name": "Grok Vision Beta",
        "ctx": 8192,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          5,
          15
        ],
        "release": "2024-11-01"
      },
      {
        "id": "grok-2-vision-1212",
        "name": "Grok 2 Vision (1212)",
        "ctx": 8192,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          10
        ],
        "release": "2024-08-20"
      },
      {
        "id": "grok-2-latest",
        "name": "Grok 2 Latest",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          2,
          10
        ],
        "release": "2024-08-20"
      },
      {
        "id": "grok-2-vision-latest",
        "name": "Grok 2 Vision Latest",
        "ctx": 8192,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          10
        ],
        "release": "2024-08-20"
      },
      {
        "id": "grok-2",
        "name": "Grok 2",
        "ctx": 131072,
        "out": 8192,
        "reasoning": false,
        "vision": false,
        "cost": [
          2,
          10
        ],
        "release": "2024-08-20"
      },
      {
        "id": "grok-2-vision",
        "name": "Grok 2 Vision",
        "ctx": 8192,
        "out": 4096,
        "reasoning": false,
        "vision": true,
        "cost": [
          2,
          10
        ],
        "release": "2024-08-20"
      }
    ]
  },
  {
    "id": "llamacpp",
    "name": "llama.cpp",
    "kind": "openai",
    "base_url": "http://127.0.0.1:8080/v1",
    "models": []
  },
  {
    "id": "ollama",
    "name": "Ollama",
    "kind": "openai",
    "base_url": "http://127.0.0.1:11434/v1",
    "models": []
  },
  {
    "id": "koboldcpp",
    "name": "KoboldCpp",
    "kind": "openai",
    "base_url": "http://127.0.0.1:5001/v1",
    "models": []
  }
];
