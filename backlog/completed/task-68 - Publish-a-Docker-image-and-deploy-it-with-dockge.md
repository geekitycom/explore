---
id: TASK-68
title: Publish a Docker image and deploy it with dockge
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 17:16'
updated_date: '2026-09-26 18:05'
labels: []
dependencies:
  - TASK-64
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run Geekity Explore in production at explore.geekity.com. `pnpm docker:build-push` builds the image and pushes it to ghcr.io; on the server, a dockge stack runs that image with env vars and a data volume, and Caddy reverse-proxies explore.geekity.com to it. Minting a versioned release (release-please) and running the script again ships a new image; updating the stack's tag rolls production forward (or back).

Follow the Geekity CMS setup as the reference: /Users/andrewshell/code/geekity/cms (`Dockerfile`, `scripts/docker-build-push.sh`, `scripts/docker-smoke.sh`, `deploy/compose.yaml`, README "Deploying with Docker"). Differences to account for here: one Node server serves both the API/WebSocket and the built web client; storage is `DATA_DIR` with `main.db` and `worlds/<id>.db` (D25), which must live on a mounted volume; there is no native module like sharp; behind Caddy the server needs `TRUST_PROXY=true` and secure cookies (`NODE_ENV=production`), and WebSockets (`/ws/worlds/:id`) must pass through the proxy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `pnpm docker:build-push [TAG]` builds a linux/amd64 and linux/arm64 image and pushes it to `ghcr.io/geekitycom/explore` tagged with the version in the root package.json, `latest`, and the optional tag; `pnpm docker:dry-run` prints what it would do without building or pushing
- [x] #2 The script runs the quality gates (lint, format check, typecheck, tests) before building and refuses to run outside the repository root
- [x] #3 The image runs the production server serving the built web client, as a non-root user, with Node pinned to the version the repo develops on, and shuts down cleanly on SIGTERM so no world data is lost
- [x] #4 All world and account data lives under a mounted `DATA_DIR`; recreating the container from a new image keeps every account and world
- [x] #5 A `deploy/compose.yaml` for dockge runs the image at a tag set in `.env`, mounts the data directory, documents every env var the server reads (including the optional LLM settings), and exposes a port for Caddy
- [x] #6 A smoke check (script and/or CI job) starts the built image, signs up, and opens a world over the WebSocket
- [x] #7 The README has a "Deploying with Docker" section: publishing an image after a release, first-time dockge stack setup (data directory ownership included), the Caddy site block for explore.geekity.com (WebSockets included), and how to upgrade or roll back by changing the tag
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Dockerfile mirroring the CMS image: pinned node:24.18.0-trixie-slim, pnpm fetch layer, frozen offline install, Vite build of apps/web; a prod-deps stage installing only @explore/server's production dependency closure; runtime keeps the workspace layout (apps/server/src, packages/core/src, apps/web/dist) because node strips types but refuses .ts under node_modules, so pnpm deploy is out. Non-root uid 1000, DATA_DIR=/data, PORT=3000, healthcheck on GET /.
2. .dockerignore.
3. scripts/docker-build-push.sh (dry-run, root check, gates, buildx multiplatform, tags from root package.json + latest + custom) and pnpm docker:* scripts.
4. scripts/docker-smoke.sh: boot on an empty volume, check the web client is served, sign up, open the home world over the WebSocket, move, docker stop (exit 0, no -wal left), start a new container on the same volume, log in, same world and saved pose.
5. deploy/compose.yaml for dockge with EXPLORE_TAG required, ./data bind mount (uid 1000), every server env var documented, TRUST_PROXY/NODE_ENV fixed, 127.0.0.1 port for Caddy.
6. CI docker-smoke job (amd64 build, no push).
7. README Deploying with Docker section and commands table rows.
8. Verify: gates, dry-run, local build + smoke, host-dir persistence, multiplatform build without push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Image layout: stages deps (pinned node:24.18.0-trixie-slim, corepack pnpm, pnpm fetch, workspace manifests), build (frozen offline install, vite build of apps/web), prod-deps (empty node_modules, then --prod --filter @explore/server...: hono, @hono/node-server, @hono/node-ws, ws, zod), runtime (workspace layout: node_modules 12M, apps/server/src and packages/core/src without *.test.ts, apps/web/dist 9.4M; /data owned by node; USER node; HEALTHCHECK GET /; CMD node apps/server/src/main.ts). 382MB on disk, 91MB content. pnpm deploy is not used because node refuses to strip types under node_modules and @explore/core ships .ts source. pnpm fetch leaves the whole lockfile in node_modules/.pnpm (144 entries), so prod-deps removes it first (7 entries after).
Smoke script proven to catch defects: an image with the SIGTERM handler removed fails with exit 143; an image with DATA_DIR off the volume fails at the data check.
No app source change was needed: GET / serves as the health check.
Validation: pnpm lint, format:check, typecheck, test (991 + 1 passed). pnpm docker:dry-run prints version 0.0.0 and tags; refuses outside the root and bad tags. pnpm docker:smoke passed for linux/amd64 (emulated) and linux/arm64. deploy/compose.yaml run with a host ./data bind mount: signup, compose stop (exit 0, no -wal), up --force-recreate (new container id), login saw the same world and position; uid 1000. Admin scripts (epitaph-admin, landmark-names, wipe-world via one-off container) run in the image. docker buildx build --platform linux/amd64,linux/arm64 --no-cache without push succeeded. Nothing pushed, no docker login.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a Dockerfile (pinned Node 24.18.0, pnpm fetch layer, production deps only, workspace layout so node can run the TypeScript, uid 1000, data under /data, healthcheck), .dockerignore, scripts/docker-build-push.sh (pnpm docker:build-push / docker:dry-run: root check, quality gates, buildx amd64+arm64, tags from package.json + latest + custom), scripts/docker-smoke.sh (pnpm docker:smoke: web client, signup, WebSocket, SIGTERM exit 0 with no -wal, restart keeps account, world and position), a docker-smoke CI job, deploy/compose.yaml for dockge, and the README section Deploying with Docker. Verified with the gates, the dry run, the smoke on amd64 and arm64, a compose run on a host data dir across a recreated container, and a no-push multi-platform build. The real publish (docker login, push, package visibility) is left to the maintainer.
<!-- SECTION:FINAL_SUMMARY:END -->
