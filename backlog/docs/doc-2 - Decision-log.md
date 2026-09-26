---
id: doc-2
title: Decision log
type: other
created_date: '2026-09-24 21:28'
updated_date: '2026-09-26 20:26'
---
# Decision log

One entry per decision. Product calls came from Andrew on 2026-09-24. Technical calls were made by Claude and can be revisited. Backlog decision records only take a title from the CLI, so the rationale is kept here.

## D1. Art comes from CC0 packs (product, 2026-09-24)
Use openly licensed CC0 pixel art for terrain, features, and characters. License files are kept in the repo next to the assets. Transition tiles are generated from base textures with corner masks when a pack lacks them.

## D2. SQLite on a single node (product, 2026-09-24, amended by D25 on 2026-09-26)
One Node process with SQLite storage, which since D25 is a main database and one file per world. Presence is in memory. Screen creation needs no locking because SQLite access is synchronous in one process.

## D3. Username and password accounts (product, 2026-09-24)
Unique case-insensitive username, scrypt-hashed password, cookie session. No email.

Since TASK-66 a player also has a display name, 1 to 20 characters and not unique, and it is the only name other players see. The username is for logging in only, and the web client never shows it. Credits, such as who named a landmark, keep the display name the player had at the time.

## D4. Avatars built from parts and colors (product, 2026-09-24)
Players choose skin, hair style, hair color, shirt color, and pants color in an avatar step right after creating their account (TASK-59; it was part of the sign-up form before). The sprite is composited from layers with a 4-direction walk animation.

## D5. Hand-built secret garden at (0,0) with openings on all four sides (product, 2026-09-24)
Since task-58 its dirt paths run out of the east and west sides only; the north and south hedge gaps open onto grass, so roads leave the garden east and west (`GENERATOR_VERSION` 9).

## D6. Returning players resume at their last position (product, 2026-09-24, replaced by D24 on 2026-09-26)

## D7. The world is unbounded (product, 2026-09-24)

## D8. pnpm monorepo with core, server, and web packages (technical)
`@explore/core` holds all pure game logic so server validation and client prediction share one collision and world model. Server runs TypeScript directly on Node 24 type stripping (`erasableSyntaxOnly`), so it has no build step. The web client builds with Vite.

## D9. Terrain on the corner lattice (technical)
Storing terrain per corner instead of per tile makes seam matching exact: neighbors share lattice points. It also makes transition tiles a pure function of four corners, which is the standard layered autotile technique. Rejected: per-tile terrain with stored transition tiles, which needs a separate edge-matching rule and a transition solver.

## D10. Constraint-conditioned generation instead of a global noise field (technical, superseded by D19 on 2026-09-24)
A single global noise function would match seams for free, but it cannot honor the hand-built garden or future hand-built screens, and it isn't what "each screen designed mostly randomly" describes. Each screen gets a random seed, and existing neighbors constrain it.

## D11. Connectivity repair guarantees no screen traps a player (technical, restated 2026-09-24)
Original: all walkable edge tiles of a generated screen join one component. Restated with D19: every seam has crossing tiles both screens agree on, every crossing leads on through the screen, and arrivals only land on tiles a crossing leads to. Lakes are disjoint blobs so land is connected by construction and repair never carves water.

## D12. Server-authoritative screens, client-predicted movement (technical)
The client moves locally for responsiveness and streams positions. The server checks each against core collision and a speed cap and sends a correction on failure. Only the server decides screen transitions.

## D13. Canvas 2D without a game engine (technical)
One screen at a time with a few dozen sprites does not need Phaser or Pixi. Plain Canvas 2D keeps the bundle small and the render path readable.

## D14. Tooling (technical)
ESLint flat config with typescript-eslint type-checked rules, Prettier, Vitest, GitHub Actions CI (lint, format check, typecheck, test, build), and release-please in manifest mode with one root release for the app. Conventional commits drive versioning.

## D15. Ninja Adventure by pixel-boy is the art source (technical, within D1)
CC0 1.0 (license text ships in the pack; itch page states CC0). Native 16x16, one artist and palette, and it covers grass, dirt, sand, water, trees, bushes, rocks, flowers, and about 95 characters with 4-direction, 4-frame walks. Rejected: Kenney Tiny Town (no water or sand), Kenney Roguelike Characters (no walk frames), LPC (CC-BY-SA/GPL), Edited 24x32 pack (CC-BY). Puny World is CC0 but a subset of what Ninja Adventure offers.

## D16. Avatar "parts" are base characters, colors are palette swaps (technical, refines D4)
Ninja Adventure characters are not split into layers. The avatar's hair style picks one of a few base characters with distinct hair silhouettes, and skin, hair, shirt, and pants colors are applied by replacing each base's color roles (with derived shade colors). A true layered set exists (OpenGameArt 24x32 bases) but clashes in style and has a CC-BY provenance question.

## D17. Terrain transitions are built at runtime from fills and corner masks (technical, refines D9)
The pack's blob autotiles cover only some terrain pairs (no grass and sand) and bake both terrains into one opaque tile, so they cannot stack three terrains in one tile. The client builds 16 corner-mask overlays per terrain from the pack's fill tiles and draws terrains in layer order, with a shore layer for water edges.

## D18. Music is generated chiptune (product, 2026-09-24)
Andrew listened to the prototype (task-17) and chose generated music over the Ninja Adventure tracks. A seeded composer picks scale, tempo, progression, motif, and an A A' B A'' form from a mood, and plays through NES-style voices (two pulse, stepped triangle, LFSR noise) on Web Audio. The pack's tracks stay available as a fallback. No audio files ship for music.

## D19. World generation from world-seeded global fields (technical, accepted 2026-09-24)
Replace D10's neighbour-constrained generator with pure functions of the world seed and global coordinates, generated and stored in 4x4-screen chunks, with biomes, roads between points of interest, and the garden as a stamp. Needed because per-screen generation cannot be coherent beyond one screen. D10's objection (a global field cannot honour the garden) is answered by the stamp registry. Details and sources in the "World generation v2 design" doc. Accepted when task-26 landed.

## D20. Coordinates carry a layer (product direction from Andrew, 2026-09-24)
Houses, caves, and towns will come later as separate layers the player travels into. Screen and chunk coordinates gain a layer (only `overworld` for now), and entrances will be features linking an overworld tile to a place in another layer. Towns and cave mouths are points of interest the road network already connects to.

## D21. Our own visual language, with scenery generated from code recipes (accepted with adjustment 2026-09-24)
Andrew wants a visual language of our own and generated assets, possibly grounded in the real world. Proposal: a written style guide (one ramped master palette seeded from Ninja Adventure, top-left light, selective outline, per-sprite limits) enforced by a lint in CI; scenery generated by deterministic code recipes modelled on real species per biome, with biome palettes drawn from public-domain reference photos; characters stay on the pack for now. Becomes accepted if the recipe spike (see "Visual language and asset generation" doc) convinces Andrew that generated scenery can match hand-made art.

Verdict after the spike (task-33), from Andrew on 2026-09-24: adjust as recommended. Large scenery (trees, conifers, cacti, rocks) is generated by recipes that copy the pack's drawing method (banded canopies with drips, lit top planes on rocks, stepped cylinders). Small props (bushes, flowers) use a hand-drawn base shape that recipes recolour and vary, or are drawn by hand. Objects keep the pack's full dark outline.

## D22. Stored screens live on through updates; resetting is the admin's choice (product, from Andrew, 2026-09-25)
Once the world is live, stored screens are places people have visited or are standing in. Future updates must keep them: migrations may upgrade their data in place (new record versions, new fields), but never delete them, and the server must start and serve them without a reset. A fresh world is something the admin chooses with `pnpm world:wipe --yes`, which since D25 names the one world it resets (`--owner <username>` or `--world <id>`); it is never a requirement for running the server.

Consequence for generator changes: new screens generated next to stored ones must fit them. Where a new screen borders a stored screen whose edge differs from what the current generator would produce, the stored edge wins and the new screen blends into it (the stitching the old neighbour-constrained generator did, applied only at the frontier between old and new).

Superseded state: migration 4 once cleared screens, and the server used to refuse to start on screens with an older record version. Task-39 replaced both with in-place record upgrades and stitching (D23).

## D23. Generator changes bump a version and stitch; record changes ship an upgrade step (technical, task-39, 2026-09-25)
The rule every change to world generation or the stored screen format follows, so that a running world is never reset by an update:

1. **Output changes bump `GENERATOR_VERSION`** (core `generate.ts`) and nothing else. Stored screens keep the terrain and features players saw, with the `gen_version` that made them. A new screen is generated with `generateScreen(world, coord, older)`, where `older` finds stored neighbours whose `gen_version` is lower. At every lattice point such a neighbour holds, the new screen copies its value; within `STITCH_REACH` (6) points of that edge it dithers between the held value and the fields, with sand standing in for water so the band adds no water. Crossings onto an older neighbour are the walkable tiles of its main land whose facing tile is open by terrain, so the new screen opens onto all of the old edge and its repair joins every pocket to those crossings. Same-generation neighbours are never stitched: their seams already agree by construction. Two new screens sharing a seam compute identical stitched values because a point's value depends only on the older screens within reach, which are fewer than a screen away and so visible to both.
2. **Format changes bump `SCREEN_RECORD_VERSION`** (core `codec.ts`) and add one step to `UPGRADES` in core `upgrade.ts`, lifting a record from the previous version to the new one. The tuple's type is tied to the version constant, so a bump without a step fails `pnpm typecheck`. `openWorldDatabase` (`openDatabase` before D25) rewrites every stored record of the world below the current version in place, in one transaction, on every open (a no-op once current). A new field that is a pure function of the world and position (like `biome`) is filled from the current generator; a field that depends on stored cells is derived from them. Cells are never regenerated.
3. **Migrations never delete screens, visits, or positions** (D22). `pnpm world:wipe --yes` stays the only reset, and it is an admin's choice.
4. **Arrivals read the two stored screens**: travel lands a player on a tile open on both sides of the seam (`seamOpenings`), never on tiles the current fields predict, so crossing into an older screen always works or is refused, never crashes.

The garden is the one exception to "stored screens keep their cells": it is hand-built, so `ensureGarden` rewrites the stored garden with the current stamp (and the current `gen_version`) on every start, and a garden layout change needs nothing more. Its stored neighbours keep their edges, which stays walkable because a crossing needs only the two facing tiles open (rule 4). Task-58 did this when the north and south paths became grass.

Tests that guard this: `upgrade.test.ts` lifts records from every past version; `generate.test.ts` stitches a block of another world's screens (standing in for an older generator) over six seeds and checks seam equality, the blend band, reachability from the garden, and pocket repair; in the server, `db.test.ts` stores a v3 record in a world file and checks that opening the file lifts it to the current version, and that a record it cannot lift stops the open unless a wipe skips the lift; `chunks.test.ts` builds a chunk around a screen stored by an older generator and keeps that screen as it was; `travel.test.ts` checks that `seamOpenings` lists every tile open on both sides of a seam.

Until TASK-64.1, `legacy.test.ts` and `play.test.ts` also opened a real v3 database dumped from the dev world (`apps/server/fixtures/world-v3.sql`) and walked a player from an old screen into a new one. The one-time reset in D25 left no database in the old single-file layout, so that test and its fixture were deleted.

## D24. Every session starts by waking in the secret garden (product, from Andrew, task-58, 2026-09-26)
Replaces D6. A play session is a run of connections with no gap as long as `SESSION_TIMEOUT_MS` (10 minutes, one setting in `apps/server/src/play.ts`, overridable through the `SESSION_TIMEOUT_MS` environment variable, which the e2e server sets to 4 seconds). The server keeps no session table: `player_state.updated_at` is when the player was last known connected. It is written on every disconnect, every travel, every flush (every 5 seconds, for everyone online, idle or not), and on shutdown, so a player whose window stays open never falls asleep, and the rule gives the same answer after a restart or a crash.

On connect, a saved position younger than the timeout resumes where the player stood, with no wake-up (a page reload, a dropped connection, a second tab). Anything older, or no saved position, starts a new session: the player is placed at the garden spawn whatever their last position, and the screen message says so (`arrival: { kind: 'wake' }` since TASK-67, `wake: true` before). The client holds the world still (no movement, no ambient motion, no music) behind a black cover that opens like eyes from a seam across the middle in about a second (a short fade with reduced motion), then shows exactly "You wake up in a secret garden. You feel the grass between your toes. Click to start." A click anywhere on the cover, or Space, starts the session and the music, and is the audio unlock. The message said "Press [space] to start." and only Space started the session until TASK-62 added the click for touch play. There is no separate fell-asleep message; the player stays logged in.

## D25. A main database for accounts, one SQLite file per world (product, from Andrew, 2026-09-26)
Amends D2. Single player is the default: creating an account creates that player's own world. The server keeps one main SQLite database for deployment-wide data (users, sessions, the world registry, and who may enter which world) and one SQLite file per world for everything in it (seed, screens, visits, traces, reports, positions, inventories). A world has its own id, separate from its owner's user id. The registry records its owner and the host that serves it, which today is always this one.

Why: a world is a single file, so later it can be moved to another API server when one is overloaded, and the client asks the main API where a world lives before connecting. None of that routing is built now. The rule for now is that nothing on the server assumes there is only one world, and the client always says which world it is joining.

Playing together is by invitation only, and the server never matches strangers. A world is closed to visitors by default. Its owner can open it for visitors, which shows a short code; anyone logged in with the code can join while it stays open, so a kid can share it with a friend beside them or in a group chat. Visitors can only be in a world while its host is there and it is open. It closes to visitors when the owner closes it, logs out, their session ends (D24), or they go to visit another world; every visitor is then sent back to their own world, and opening it again gives a new code. Visitors arrive in the host's secret garden, on a tile no other player is standing on. A visitor is stored in the host's world file: their position, traces, and inventory there belong to that world, and they go home without its items.

Consequences:
- No foreign keys cross files. World files hold user ids as plain integers, and `users.id` is never reused (AUTOINCREMENT), so an id in any world file always means the same person.
- Two migration lists: one for the main database, one for world files. A world file migrates when it is opened, as the single database does today.
- The switch is a one-time reset, chosen by Andrew: the only copy is the local dev world, so its accounts and world are wiped rather than migrated. D22 and D23 apply to each world file from then on.
- Admin scripts (`world:wipe`, epitaph admin, names) name the world they act on.

As built (TASK-64 and TASK-67): the main database holds users, sessions, and the world registry. Which worlds are open to visitors, and their codes, live in memory in the world host, so a restart closes every world to visitors. A visitor arrives through a portal on a random free garden tile and steps out onto the free tile in front of it. Every visitor leaves through a portal, either by choosing Go home or when the world closes to visitors, and the server tells them with a `depart` message (`sentHome` before TASK-67). Besides the triggers above, a world closes to visitors when its owner has had no connection anywhere for the session timeout (their D24 session has ended), and when the world itself closes after five minutes with nobody in it.
