---
id: doc-1
title: Architecture
type: specification
created_date: '2026-09-24 21:28'
updated_date: '2026-09-25 16:46'
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
- Screens are addressed by `ScreenCoord { layer, sx, sy }`. `overworld` is the only layer today; houses, caves, and towns will be layers of their own (decision-20). The world is unbounded. `(0, 0)` is the secret garden. `sy` grows southward.
- Terrain is stored on the corner lattice, not on tiles. Each screen stores `(SCREEN_W + 1) * (SCREEN_H + 1)` corners, each one of `water | sand | dirt | path | grass | darkgrass | snow`. Roads are laid as `path`, a worn soil track, so they read apart from dirt patches; where a road fords water it is sand. A tile's look comes from its four corners. Two adjacent screens share their boundary lattice line, and diagonal screens share one corner point. Seams therefore match by construction: the generator copies every shared lattice point from any existing neighbor (including diagonals) before generating the rest.
- Features sit on tiles: `none | tree | bush | rock | flowers | tallgrass`. `tree`, `bush`, and `rock` block movement. When a neighbor exists, the generator copies the neighbor's facing edge column or row of features onto its own edge, so a tree line or open meadow continues across the seam.
- A tile is walkable when it has no blocking feature and fewer than 3 of its corners are water.
- Persisted screen record: `{ v: 4, layer, sx, sy, biome, corners: string, features: string }` where `corners` and `features` are compact one-character-per-cell strings. The codec lives in core and is versioned by `v`. `upgradeScreenRecord` (core `upgrade.ts`) lifts a record of any past version, one step per version, and `openDatabase` rewrites older records in place; a version bump without an upgrade step does not compile (decision D23).

## Generation

Every tile is a pure function of the world seed, the layer, and its global position (decision-19). The seed lives in a one-row `world` table and a wipe rolls a new one. `generateScreen(world, coord, older)` assembles a screen from per-point functions, so shared lattice points agree whatever order screens are generated in. `older` finds stored neighbours an earlier generator made (`screens.gen_version` below `GENERATOR_VERSION`); the new screen copies every lattice point such a neighbour holds and blends into it (step 7).

1. **Biomes.** `biomeField` in `biome.ts` puts one jittered site in each cell of a grid eight screens square. A site's biome comes from temperature, moisture, and elevation sampled there (meadow, forest, lakeland, scrubland, desert, highlands, taiga, tundra). A hot site with a cold site within two cells turns temperate, so snow never meets desert. A point belongs to the site nearest its domain-warped position, and its `BiomeParams` blend every site almost as near, so borders wander and blend over about a screen. The garden's cell is pinned to a meadow site. `biomeAt(world, layer, gx, gy)` returns the biome, its patch (cell), and the blended params; each screen records the biome at its centre.
2. **Stamps.** Inside a stamp's footprint (the secret garden at overworld 0,0, boundary included) the functions return the hand-built cells. A clearing weight fades from the footprint to 1.5 screens out, thinning blocking features and suppressing dirt, and dirt trails continue the garden's exits into the meadow.
3. **Terrain.** Lakes are disjoint star-shaped blobs, at most one per cell of the lake grid, sized so no screen is all water and never touching each other or the garden clearing, so land stays connected by construction. Lake chance and size follow the biome params. The ground takes sand, dirt, snow, then darkgrass by comparing a noise field per terrain against the blended share, so blended borders dither; the rest is grass. All noise is hash-based fBm seeded per purpose, never a shared random stream.
4. **Features.** A low-frequency forest field and the biome's woods share set tree chance, clumped by a finer field so forests have glades; bushes ring tree stands, rocks favour dirt, flowers and tall grass grow on grass and darkgrass. Densities come from the blended biome params.
5. **Crossings.** Each seam's crossing tiles are a pure function of the seam, so both screens agree. Both sides clear blocking features on them.
6. **Repair.** Per screen, the components holding crossings are joined by the cheapest feature-clearing path. Repair never raises water and never touches a shared lattice point.
7. **Stitching.** Next to a stored screen from an older generator, the shared edge is that screen's, and within `STITCH_REACH` (6) points of it the fields' terrain is dithered with the held edge value, sand standing in for water so the band adds no water. The crossing onto that neighbour is every walkable tile of its main land whose facing tile is open by terrain, so the new screen opens onto all of the old edge. Same-generation neighbours are not stitched. Decision D23 states the rule for future generator changes.

Guarantee (replacing the old decision-11 wording): every crossing leads on, and a traveller only ever arrives on a tile open on both sides of the seam (`seamOpenings`, read from the two stored screens); the arrival nudge searches only tiles reachable from those, and a seam with no opening refuses the travel. Property tests grow 12x12 regions over several seeds and check seam equality in shuffled orders, crossings on every land seam, and that a BFS from the garden reaches every screen.

## Rendering

Transition tiles are derived at render time from the corner lattice, not stored. Terrains draw in layer order (water, sand, dirt, path, grass, darkgrass, snow). Each higher terrain covers the pixels where a field is positive: the bilinear blend of its tile's four corner values, where a corner counts firmer the more its neighbours agree, plus a per-terrain fringe (tufts for grass, gentle waves elsewhere). Edges therefore run smoothly across tiles, like marching squares, instead of stair-stepping. Pixels on a screen's outer edge sample the border line itself, so neighbouring screens draw the seam identically. Each screen's terrain is baked once into an offscreen canvas. Features and players are then drawn y-sorted so tall trees overlap correctly.

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
