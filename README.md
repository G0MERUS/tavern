# Tavern

A from-scratch rewrite of the SillyTavern backend. **Single-user, local-first** roleplay chat server: stores characters/chats/lorebooks in SQLite, reads/writes V2/V3 PNG character cards, proxies one OAI-compatible upstream at a time.

|                | Original ST | This |
| -------------- | ----------- | ---- |
| Backend LOC    | ~28,000     | ~4,700 |
| npm deps       | ~90         | 12 |
| Route prefixes | 47          | 10 |
| Storage        | 30+ dirs    | 1 sqlite + 1 blob dir |
| Startup        | seconds     | <100ms |

## Run

```sh
bun install
bun start                      # http://127.0.0.1:8000
bun start --port 3000 --host 0.0.0.0   # public — auto-generates a bearer token
```

API docs at `/docs` (Swagger). DB and blobs land in `./data/`.

## Run on a phone (Termux)

Tavern runs on Android via [Termux](https://termux.dev) — no native image
library is required (avatars are stored as-is), so there's no build-toolchain
pain. Two scripts live in the repo: `req.sh` sets things up, `start.sh` runs it.

First time:

```sh
pkg install -y git
git clone https://github.com/G0MERUS/tavern.git
cd tavern
./req.sh      # installs bun + deps, builds the web UI (run again after a git pull)
./start.sh    # then open http://127.0.0.1:8000 in your browser
```

After that, every time you just want to run it:

```sh
cd tavern
./start.sh
```


To reach it from another device on your Wi-Fi (a bearer token is
auto-generated and printed on first run):

```sh
./start.sh --host 0.0.0.0
```



## Test

```sh
bun test
```

Fixtures are real-world: `seraphina.png` (canonical PNG card with embedded character_book) and `lucid-loom.json` (445KB preset, 326 prompts, regex scripts).

## What's gone

Multi-user accounts, group chats, server-side image processing (`sharp`/libvips — avatars are now stored as-is so the backend runs on Termux), all non-OAI LLM adapters (everyone has an OAI-compat shim now), text-completions, local ML, image-gen proxy, RAG, translation, web search, TTS/STT, sprites, the git extension installer, asset packs, stats, data-maid (a DB has FK cascade), backups (sqlite has `.backup`), webpack-at-startup, the 35-route tokenizer, the 60-key SECRET_KEYS enum, the 8 preset directories, the 200-line config.yaml.


See `.rewrite/backend/` for the full audit.
