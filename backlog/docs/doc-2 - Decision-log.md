---
id: doc-2
title: Decision log
type: other
created_date: '2026-09-24 21:28'
updated_date: '2026-09-25 02:38'
---
# Decision log

One entry per decision. Product calls came from Andrew on 2026-09-24. Technical calls were made by Claude and can be revisited. Backlog decision records only take a title from the CLI, so the rationale is kept here.

## D1. Art comes from CC0 packs (product, 2026-09-24)
Use openly licensed CC0 pixel art for terrain, features, and characters. License files are kept in the repo next to the assets. Transition tiles are generated from base textures with corner masks when a pack lacks them.

## D2. SQLite on a single node (product, 2026-09-24)
One Node process with a SQLite file. Presence is in memory. Screen creation needs no locking because SQLite access is synchronous in one process.

## D3. Username and password accounts (product, 2026-09-24)
Unique case-insensitive username, scrypt-hashed password, cookie session. No email.

## D4. Avatars built from parts and colors (product, 2026-09-24)
Signup includes choosing skin, hair style, hair color, shirt color, and pants color. The sprite is composited from layers with a 4-direction walk animation.

## D5. Hand-built secret garden at (0,0) with openings on all four sides (product, 2026-09-24)

## D6. Returning players resume at their last position (product, 2026-09-24)

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
