---
id: TASK-68
title: Publish a Docker image and deploy it with dockge
status: To Do
assignee: []
created_date: '2026-09-26 17:16'
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
- [ ] #1 `pnpm docker:build-push [TAG]` builds a linux/amd64 and linux/arm64 image and pushes it to `ghcr.io/geekitycom/explore` tagged with the version in the root package.json, `latest`, and the optional tag; `pnpm docker:dry-run` prints what it would do without building or pushing
- [ ] #2 The script runs the quality gates (lint, format check, typecheck, tests) before building and refuses to run outside the repository root
- [ ] #3 The image runs the production server serving the built web client, as a non-root user, with Node pinned to the version the repo develops on, and shuts down cleanly on SIGTERM so no world data is lost
- [ ] #4 All world and account data lives under a mounted `DATA_DIR`; recreating the container from a new image keeps every account and world
- [ ] #5 A `deploy/compose.yaml` for dockge runs the image at a tag set in `.env`, mounts the data directory, documents every env var the server reads (including the optional LLM settings), and exposes a port for Caddy
- [ ] #6 A smoke check (script and/or CI job) starts the built image, signs up, and opens a world over the WebSocket
- [ ] #7 The README has a "Deploying with Docker" section: publishing an image after a release, first-time dockge stack setup (data directory ownership included), the Caddy site block for explore.geekity.com (WebSockets included), and how to upgrade or roll back by changing the tag
<!-- AC:END -->
