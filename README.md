# Geekity Explore

A shared top-down pixel-art world. Sign up, design an avatar, and start in the secret garden. The world is a grid of screens that do not exist until someone walks onto them. Every screen is a pure function of the world's seed and its position, so it matches its neighbours whatever order they appear in, and it is saved for everyone once generated. Players on the same screen see each other move.

![Two players in the secret garden](docs/screenshots/garden-two-players.png)

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 12 (`corepack enable`)

## Setup

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs the server on port 3000 and the Vite dev server, which proxies `/api` and `/ws` to it. Open the URL Vite prints. Vite also listens on your local network, so another device can play at the Network URL it prints, such as `http://192.168.4.33:5173/`.

For a production-style run, build the client and start the server, which serves the built client:

```sh
pnpm build
pnpm start
```

The server and its admin scripts read settings from environment variables, and also from a `.env` file in the repository root when one exists. Variables already set in the shell take precedence. Copy `.env.example` to `.env` to start; it lists every setting with its default.

Behind a reverse proxy, set `TRUST_PROXY=true` so login and signup rate limits key on the client address the proxy reports in `X-Forwarded-For` (the rightmost entry, the one the proxy itself appended) instead of the proxy's own address. Leave it unset when the server is reachable directly.

## Text generation

The server can write short game text, such as epitaphs, with a language model through any OpenAI-compatible chat completions API. It is optional. With no provider set, the game uses its built-in text. Each grave shows a built-in epitaph from the world seed until the model has written its own, once, when a player first opens its screen; a failed try is retried after a restart. The server prints which model it uses at startup and never logs or sends the API key to clients.

| Variable         | What it sets                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `LLM_BASE_URL`   | API base URL, without `/chat/completions`                                                                      |
| `LLM_MODEL`      | Model id                                                                                                       |
| `LLM_API_KEY`    | Bearer token. Leave unset for Ollama                                                                           |
| `LLM_TIMEOUT_MS` | Time before a request gives up, default `15000`. A local model that is not loaded yet can take several seconds |

For local development with [Ollama](https://ollama.com):

```sh
ollama pull gemma3:12b
LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=gemma3:12b pnpm dev
```

In production with [OpenRouter](https://openrouter.ai), use a fast, low-cost model such as `google/gemini-3.8-flash` or `qwen/qwen3.8-flash`:

```sh
LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=google/gemini-3.8-flash LLM_API_KEY=sk-or-... pnpm start
```

## Scripts

| Script                                | What it does                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | Server with watch mode, plus the Vite dev server                                                                                                                                            |
| `pnpm build`                          | Build every package that has a build step                                                                                                                                                   |
| `pnpm start`                          | Start the server                                                                                                                                                                            |
| `pnpm lint`                           | ESLint with type-aware rules                                                                                                                                                                |
| `pnpm format` / `pnpm format:check`   | Prettier write or check                                                                                                                                                                     |
| `pnpm typecheck`                      | `tsc` in every package                                                                                                                                                                      |
| `pnpm test`                           | Vitest across all packages                                                                                                                                                                  |
| `pnpm e2e`                            | Playwright end-to-end tests against a fresh server, in the installed Chrome                                                                                                                 |
| `pnpm world:wipe --yes`               | Delete the generated world and saved positions (accounts stay), roll a new world seed, and restore the garden. Stop the server first. Uses `DB_PATH`, default `apps/server/data/explore.db` |
| `pnpm epitaphs`                       | List every grave's epitaph. `--set sx,sy tx,ty "words"` replaces one, `--clear sx,sy tx,ty` puts back its built-in epitaph for good. Uses `DB_PATH`                                         |
| `pnpm --filter @explore/core preview` | Render a large area of the world to a PNG for tuning generation                                                                                                                             |

## Testing

`pnpm test` runs the unit tests, then the timing tests in `*.perf.test.ts` on their own.

Every unit test has a budget of 1000 ms. A test that takes longer fails with a message that names it, locally and in CI; `vitest.setup.ts` enforces this. Aim for under 300 ms, so a test stays inside the budget on a slower CI runner or a busy laptop. When a test is slow, make its work cheaper instead of raising its timeout:

- Pass a lower scrypt cost to `createApp` (`scryptCost`) instead of hashing at the production cost.
- Share an expensive fixture between cases, or sample seeds deterministically instead of looping over all of them.
- Split a long loop into `test.each` cases, so each test does a small part of the work.
- Collect the failures of a pixel or tile loop into an array and assert on it once, instead of calling `expect` for each item.
- Poll with `vi.waitFor(check, { interval: 1 })`. The default interval is 50 ms.

Only a test that measures time belongs in `*.perf.test.ts`.

## Layout

- `packages/core` holds the pure game logic shared by server and client: world model, generation, collision, avatar model, and protocol schemas.
- `apps/server` is the Hono server with SQLite storage and WebSocket presence. It runs TypeScript directly through Node's type stripping.
- `apps/web` is the Vite and Canvas 2D client.

The art is the CC0 [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) pack by pixel-boy. See `apps/web/public/assets/ninja-adventure/SOURCES.md`. With the dev server running, `/art.html` shows every terrain transition, feature, and avatar combination.

## Tuning world generation

The preview renders a large area of the world straight from a seed as a PNG, without a server or database. Use it to check generation changes by eye before you play them.

```sh
pnpm --filter @explore/core preview -- --seed 1 --area -16,-16,32,32 --out world.png
```

| Option                  | Default             | What it sets                                                    |
| ----------------------- | ------------------- | --------------------------------------------------------------- |
| `--seed <n>`            | `1`                 | World seed                                                      |
| `--area <x0,y0,w,h>`    | `-16,-16,32,32`     | North-west screen and size in screens; the garden is at `0,0`   |
| `--mode terrain\|biome` | `terrain`           | Colour tiles by terrain or by biome                             |
| `--overlay roads,pois`  | none                | Draw roads and points of interest on top                        |
| `--scale <px>`          | `1`                 | Pixels per tile; features show as marks from 4                  |
| `--grid`                | off                 | Faint lines on screen borders                                   |
| `--out <file.png>`      | `world-preview.png` | Output path, relative to the directory you ran the command from |

The same arguments always produce the same file, so you can compare two renders before and after a change. The command prints the colour legend and the area it drew. Biome mode colours each tile by the biome at its centre, with the garden in pink. The tool renders from a `WorldSource` in `packages/core/scripts/world-source.ts`. The current source generates each screen straight from the world seed, so any area renders the same screens the game would.

Design notes and decisions live in `backlog/docs`. Tasks live in `backlog/tasks`.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org). release-please opens a release PR from them on every push to `main`.
