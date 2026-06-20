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

Tavern runs on stock **Node.js (≥ 22.5)** — no Bun, and no native modules to
compile. SQLite comes from Node's built-in `node:sqlite`; TypeScript runs
directly via [`tsx`](https://github.com/privatenumber/tsx) (no build step).

```sh
npm install
npm start                      # http://127.0.0.1:8000
npm start -- --port 3000 --host 0.0.0.0   # public — auto-generates a bearer token
```

API docs at `/docs`. DB and blobs land in `./data/`.

## Run on a phone (Termux)

Tavern runs on Android via [Termux](https://termux.dev) — no native image
library and no native SQLite addon are required (avatars are stored as-is;
SQLite is built into Node), so there's no build-toolchain pain. Two scripts
live in the repo: `req.sh` sets things up, `start.sh` runs it.

First time:

```sh
pkg install -y git
git clone https://github.com/G0MERUS/tavern.git
cd tavern
./req.sh      # installs node + deps, builds the web UI (run again after a git pull)
./start.sh    # then open http://127.0.0.1:8000 in your browser
```

> Got `permission denied` running `./req.sh`? The executable bit didn't survive
> the clone — run `chmod +x req.sh start.sh` once, or just use `bash req.sh`.
>
> `req.sh` installs Node from the core Termux repo (`pkg install nodejs`). If
> your Node is older than 22.5, run `pkg upgrade nodejs`.




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
npm test
```


Fixtures are real-world: `seraphina.png` (canonical PNG card with embedded character_book) and `lucid-loom.json` (445KB preset, 326 prompts, regex scripts).

## What's gone

Multi-user accounts, group chats, server-side image processing (`sharp`/libvips — avatars are now stored as-is so the backend runs on Termux), all non-OAI LLM adapters (everyone has an OAI-compat shim now), text-completions, local ML, image-gen proxy, RAG, translation, web search, TTS/STT, sprites, the git extension installer, asset packs, stats, data-maid (a DB has FK cascade), backups (sqlite has `.backup`), webpack-at-startup, the 35-route tokenizer, the 60-key SECRET_KEYS enum, the 8 preset directories, the 200-line config.yaml.


See `.rewrite/backend/` for the full audit.
