---
id: doc-1
title: Architecture
type: specification
created_date: '2026-09-24 21:28'
updated_date: '2026-09-25 01:18'
---
# Architecture

Geekity Explore is a shared, lazily generated, top-down pixel-art world. Players sign up with a username and password, design an avatar, and spawn in a hand-built secret garden. The world is a grid of fixed-size screens. A screen does not exist until the first player walks onto it. It is then generated to match its existing neighbors and saved for everyone.

## Repository layout

pnpm workspace, TypeScript everywhere, Node 24.

| Package | Role |
| --- | --- |
| `packages/core` (`@explore/core`) | Pure TypeScript with no DOM or Node APIs. World constants and types, screen codec, walkability and collision, world generation, the secret garden, avatar model, and the WebSocket protocol schemas. Shared by server and client. |
| `apps/server` (`@explore/server`) | Hono on `@hono/node-server`. SQLite through `node:sqlite`. Auth, sessions, screen persistence, WebSocket presence. Serves the built web client. |
| `apps/web` (`@explore/web`) | Vite + TypeScript + Canvas 2D client. Auth and avatar screens, the game renderer, input, and networking. |

## World model

- A screen is `SCREEN_W = 20` by `SCREEN_H = 15` tiles of `TILE = 16` px (320x240 logical pixels, drawn at an integer scale).
- Screens are addressed by integer `ScreenCoord { sx, sy }`. The world is unbounded. `(0, 0)` is the secret garden. `sy` grows southward.
- Terrain is stored on the corner lattice, not on tiles. Each screen stores `(SCREEN_W + 1) * (SCREEN_H + 1)` corners, each one of `water | sand | grass | dirt`. A tile's look comes from its four corners. Two adjacent screens share their boundary lattice line, and diagonal screens share one corner point. Seams therefore match by construction: the generator copies every shared lattice point from any existing neighbor (including diagonals) before generating the rest.
- Features sit on tiles: `none | tree | bush | rock | flowers | tallgrass`. `tree`, `bush`, and `rock` block movement. When a neighbor exists, the generator copies the neighbor's facing edge column or row of features onto its own edge, so a tree line or open meadow continues across the seam.
- A tile is walkable when it has no blocking feature and fewer than 3 of its corners are water.
- Persisted screen record: `{ v: 1, sx, sy, seed, corners: string, features: string }` where `corners` and `features` are compact one-character-per-cell strings. The codec lives in core and is versioned by `v`.

## Generation

`generateScreen(coord, neighbors, rng)` is a pure function.

1. Fixed lattice points and edge features come from existing neighbors (8-neighborhood).
2. A per-screen height field (value noise) is blended toward the heights implied by fixed boundary terrain, then thresholded into water, sand, grass, and dirt bands. Fixed points are then written back exactly.
3. A density field, also blended toward neighbor edge density, places trees, bushes, rocks, flowers, and tall grass.
4. A connectivity repair joins every walkable edge tile into one component by carving the cheapest interior path (clear a feature, or raise water to sand). Fixed edge cells are never modified. Unconstrained edges get openings so the world stays explorable.

Property tests over many seeds and random neighbor layouts assert seam equality, edge feature continuity, single-component connectivity of edge tiles, and determinism for a given seed.

## Rendering

Transition tiles are derived at render time from the corner lattice, not stored. Terrains draw in layer order (water, sand, dirt, grass). For each tile, the lowest terrain fills the tile and each higher terrain is drawn through one of 16 corner masks. Each screen's terrain is baked once into an offscreen canvas. Features and players are then drawn y-sorted so tall trees overlap correctly.

### Animation

`art/scene.ts` builds a scene once per screen (baked terrain, feature sprites, twinkling water tiles, butterflies, fish runs, petal sources) and draws it every frame. All motion is a pure function of the screen, world position, and wall-clock time, so players on one screen see roughly the same thing and every path is unit-testable. Wind shifts horizontal slices of trees, bushes, flowers, and grass by at most one pixel; the gust wave is keyed to world x so it rolls across seams, and trunks and stems never move. Only open water (a tile whose whole neighbourhood is water) twinkles, so shorelines are never redrawn. A live `prefers-reduced-motion` check freezes all of it.

## Server

- SQLite tables: `users`, `sessions`, `screens`, `player_state`, with migrations keyed on `PRAGMA user_version`.
- Passwords hashed with `node:crypto` scrypt and a per-user salt. Sessions use a random token in an httpOnly SameSite=Lax cookie; only its SHA-256 hash is stored.
- `getOrCreateScreen` is synchronous (single process, synchronous SQLite): select, else generate from neighbors and `INSERT OR IGNORE`, then select. Two players arriving at a new screen together get the same screen.
- Presence lives in memory: a map from screen key to connected players. Movement and join/leave events are broadcast only to sockets on the same screen. Last position is saved on disconnect and periodically, and a returning player resumes there.

## Protocol

JSON over one WebSocket (`/ws`), authenticated by the session cookie on upgrade, validated with zod at the server boundary.

- Client to server: `move { x, y, dir, moving }` about 10 times a second, and `travel { dir }` when the player walks off an edge.
- Server to client: `screen { screen, you, others }` on connect and after every travel, `join`, `leave`, `moved`, and `correct` when the server rejects a position or a travel.
- The server validates moves against core's collision function and a speed cap. On `travel` it resolves or creates the target screen and places the player at the matching edge position, nudged along the edge to the nearest walkable tile if needed.
