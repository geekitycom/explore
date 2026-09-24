# Geekity Explore

A shared top-down pixel-art world. Sign up, design an avatar, and start in the secret garden. The world is a grid of screens that do not exist until someone walks onto them. Each new screen is generated to match the edges of its neighbors and saved for everyone. Players on the same screen see each other move.

![Two players in the secret garden](docs/screenshots/garden-two-players.png)

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 12 (`corepack enable`)

## Setup

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs the server on port 3000 and the Vite dev server, which proxies `/api` and `/ws` to it. Open the URL Vite prints.

For a production-style run, build the client and start the server, which serves the built client:

```sh
pnpm build
pnpm start
```

## Scripts

| Script                              | What it does                                     |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | Server with watch mode, plus the Vite dev server |
| `pnpm build`                        | Build every package that has a build step        |
| `pnpm start`                        | Start the server                                 |
| `pnpm lint`                         | ESLint with type-aware rules                     |
| `pnpm format` / `pnpm format:check` | Prettier write or check                          |
| `pnpm typecheck`                    | `tsc` in every package                           |
| `pnpm test`                         | Vitest across all packages                       |

## Layout

- `packages/core` holds the pure game logic shared by server and client: world model, generation, collision, avatar model, and protocol schemas.
- `apps/server` is the Hono server with SQLite storage and WebSocket presence. It runs TypeScript directly through Node's type stripping.
- `apps/web` is the Vite and Canvas 2D client.

The art is the CC0 [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) pack by pixel-boy. See `apps/web/public/assets/ninja-adventure/SOURCES.md`. With the dev server running, `/art.html` shows every terrain transition, feature, and avatar combination.

Design notes and decisions live in `backlog/docs`. Tasks live in `backlog/tasks`.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org). release-please opens a release PR from them on every push to `main`.
