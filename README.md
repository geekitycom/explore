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

Data lives under `DATA_DIR` (default `apps/server/data`): `main.db` holds accounts and sessions, and `worlds/<id>.db` holds one world each, its seed, screens, traces, positions, and inventories. Every account owns a world, created at signup, and a connection names the world it joins (`/ws/worlds/<id>`); a world with nobody in it for five minutes is closed and reopens on the next visit (D25 in the decision log).

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

| Script                                     | What it does                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                 | Server with watch mode, plus the Vite dev server                                                                                                                                                                |
| `pnpm build`                               | Build every package that has a build step                                                                                                                                                                       |
| `pnpm start`                               | Start the server                                                                                                                                                                                                |
| `pnpm lint`                                | ESLint with type-aware rules                                                                                                                                                                                    |
| `pnpm format` / `pnpm format:check`        | Prettier write or check                                                                                                                                                                                         |
| `pnpm typecheck`                           | `tsc` in every package                                                                                                                                                                                          |
| `pnpm test`                                | Vitest across all packages                                                                                                                                                                                      |
| `pnpm e2e`                                 | Playwright end-to-end tests against a fresh server, in the installed Chrome                                                                                                                                     |
| `pnpm docker:build-push [TAG]`             | Run the quality gates, then build the Docker image for amd64 and arm64 and push it to ghcr.io. See [Deploying with Docker](#deploying-with-docker)                                                              |
| `pnpm docker:dry-run [TAG]`                | Print the image, version, and tags `docker:build-push` would push, and do nothing else                                                                                                                          |
| `pnpm docker:smoke [IMAGE]`                | Build the image for amd64 (or take `IMAGE`), boot it, sign up, play, restart it, and log in again                                                                                                               |
| `pnpm world:wipe --yes --owner <username>` | Delete one world's generated screens, traces, saved positions, and inventories (accounts stay), roll it a new seed, and restore its garden. Stop the server first. `--world <id>` names the world file directly |
| `pnpm epitaphs`                            | List every grave's epitaph in one world, named with `--owner <username>` or `--world <id>`. `--set sx,sy tx,ty "words"` replaces one, `--clear sx,sy tx,ty` puts back its built-in epitaph for good             |
| `pnpm names`                               | List every named landmark in one world (`--owner` or `--world`) with its reports. `--clear sx,sy` takes the name off a landmark                                                                                 |
| `pnpm --filter @explore/core preview`      | Render a large area of the world to a PNG for tuning generation                                                                                                                                                 |

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

The UI font is [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) under the SIL Open Font License 1.1, bundled from `@fontsource/pixelify-sans` so the game needs no connection to Google Fonts.

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

## Deploying with Docker

The image `ghcr.io/geekitycom/explore` runs the production server: one Node process that serves the built web client, the API, and the world WebSockets on port 3000. It keeps every account and world under `/data` (`main.db` and `worlds/<id>.db`) and runs as uid 1000. [`deploy/compose.yaml`](deploy/compose.yaml) runs it as a [dockge](https://github.com/louislam/dockge) stack, and plain `docker compose` reads the file the same way. Nothing else from this repository goes on the server.

### Publishing the image

The image is built from the `Dockerfile` at the repository root for `linux/amd64` and `linux/arm64`. CI never pushes it. A maintainer publishes it from a workstation after a release, once the release PR is merged:

```sh
git checkout main
git pull
pnpm docker:dry-run          # check the version and tags first
pnpm docker:build-push       # pushes <version> and latest
pnpm docker:build-push beta  # the same, plus a custom tag
```

The script reads the version tag from the root `package.json`. release-please bumps it in the release PR, which is why the pull comes first.

The script refuses to run from anywhere but the repository root. It checks that Docker is running and that you are logged in to ghcr.io. If the Docker config has no entry for ghcr.io, it runs `docker login ghcr.io`, and the password is a GitHub personal access token with `write:packages`. It then runs the quality gates `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test`, and a failing gate stops it before anything is built. It builds both platforms with `--pull --no-cache` on a buildx builder called `multiplatform`, which it creates with the `docker-container` driver the first time, and pushes every tag as one manifest list. `--dry-run` prints the image, the version, and the tags, and does nothing else.

Confirm the push carried both platforms:

```sh
docker buildx imagetools inspect ghcr.io/geekitycom/explore:<version>
```

The first push creates the package as private. Either make it public under the package's settings on GitHub, or run `docker login ghcr.io` on the server with a token that has `read:packages`.

CI builds the amd64 image on every pull request and runs `scripts/docker-smoke.sh` against it (the `docker-smoke` job). `pnpm docker:smoke` runs the same check locally. It boots the image on an empty volume, checks the web client is served, signs up, opens the home world over the WebSocket, and takes a step. Then it stops the container, checks the server exited 0 and left no SQLite `-wal` file, starts a new container on the same volume, logs in, and checks the player is in the same world where the step left them.

### First-time stack setup

These steps assume a Linux server with Docker, dockge's stack directory `/opt/stacks`, and Caddy on the same machine.

1. In dockge, create a stack called `explore` and paste in `deploy/compose.yaml`. With plain compose, copy the file to `/opt/stacks/explore/compose.yaml`.

2. In the stack directory, create `data/` and give it to uid 1000 before the first start:

   ```sh
   cd /opt/stacks/explore
   mkdir -p data
   sudo chown 1000:1000 data
   ```

   The container runs as uid 1000 and writes to this directory. If it is missing, Docker creates it owned by root and the server fails to start with `EACCES`. To move existing data in, copy `main.db` and `worlds/` here and `chown -R 1000:1000 data`.

3. Write the `.env` beside `compose.yaml` (dockge edits it on the stack page). Compose reads it for the image tag and passes every line in it to the container:

   ```sh
   # The image tag to run. Required: the stack never picks a version by itself.
   EXPLORE_TAG=0.1.0

   # The port on 127.0.0.1 that Caddy connects to. Defaults to 3000.
   # EXPLORE_HOST_PORT=3000

   # A player with no connection for this long wakes up in the garden next time.
   # SESSION_TIMEOUT_MS=600000

   # Optional epitaph text generation. See "Text generation" above.
   # LLM_BASE_URL=https://openrouter.ai/api/v1
   # LLM_MODEL=google/gemini-3.8-flash
   # LLM_API_KEY=sk-or-...
   # LLM_TIMEOUT_MS=15000
   ```

   The compose file sets `NODE_ENV=production` (Secure session cookies), `TRUST_PROXY=true` (rate limits key on the address Caddy reports), `PORT=3000`, and `DATA_DIR=/data`. Its values win over the `.env`, so leave those four out of it.

4. Deploy the stack in dockge, or run `docker compose up -d`. `docker compose ps` shows `(healthy)` once `GET /` answers 200.

The port is published on `127.0.0.1` only. Docker writes its own firewall rules ahead of ufw and firewalld, so a port published on every interface is reachable from the internet even with the firewall closed. A client connecting to it directly could then put any address in `X-Forwarded-For`. Do not change the mapping to `3000:3000`.

### Caddy

Point a DNS `A` (and `AAAA`) record for `explore.geekity.com` at the server, then add this site block to the Caddyfile and reload Caddy:

```caddyfile
explore.geekity.com {
	reverse_proxy 127.0.0.1:3000
}
```

Caddy gets the TLS certificate itself. `reverse_proxy` passes WebSocket upgrades through with no extra settings, so `/ws/worlds/<id>` works through this block as it is. Caddy also sets `X-Forwarded-For` to the client's address, which is the entry the server reads with `TRUST_PROXY=true`. If `EXPLORE_HOST_PORT` is not 3000, use that port here. If Caddy itself runs in a container, `127.0.0.1` is that container, so put both on one Docker network and proxy to `explore:3000` instead.

### Upgrading and rolling back

Every published version is a tag. To upgrade, set `EXPLORE_TAG` in the `.env` to the new version and redeploy. In dockge that is Save, then Deploy. With plain compose:

```sh
docker compose pull
docker compose up -d
```

To roll back, set `EXPLORE_TAG` to the version you came from and redeploy the same way. `data/` stays where it is either way. A newer version may migrate the database files, so back up `data/` before an upgrade. Stop the stack first so the copy is of one moment:

```sh
docker compose stop
tar -C /opt/stacks/explore -czf explore-data-$(date +%F).tar.gz data
docker compose start
```

`EXPLORE_TAG=latest` also works, and then an upgrade is `pull` and `up -d` with nothing to edit. The cost is that the stack no longer says which version it runs, so a rollback starts with finding that out.

### Admin scripts in the container

The image carries the server source, so the admin scripts run with `node` in the stack directory. `epitaphs` and `names` can run beside the server:

```sh
docker compose exec explore node apps/server/src/epitaph-admin.ts --owner <username>
docker compose exec explore node apps/server/src/landmark-names.ts --owner <username>
```

`world:wipe` needs the server stopped, so it runs in a one-off container with the same image, `.env`, and mount:

```sh
docker compose stop
docker compose run --rm explore node apps/server/src/wipe-world.ts --yes --owner <username>
docker compose start
```
