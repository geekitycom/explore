---
id: TASK-65
title: 'Bring the README, screenshots, and Backlog docs up to date'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:51'
updated_date: '2026-09-26 20:30'
labels: []
dependencies:
  - TASK-64
  - TASK-68
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The README, its screenshots, and the Backlog docs have fallen behind the game. `docs/screenshots/garden-two-players.png` shows an older garden (it now has only the two paths, north and south). `resumed-after-restart.png` shows resuming in place, which D24 replaced with waking in the garden at the start of every session. The README intro still describes one shared world, which TASK-64 changes to a world per player with visitors by invitation (D25).

Wait for TASK-64 so the docs describe per-player worlds and are written once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The README hero screenshot shows the current secret garden (two paths), ideally the wake-up screen reading "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start."
- [x] #2 Screenshots that show behaviour the game no longer has (such as resuming after a restart) are replaced or removed, and nothing references a missing image
- [x] #3 The README describes the game as it plays now: your own world, opening it for visitors with a code, waking in the garden
- [x] #4 README commands and settings match package.json scripts and the environment variables the server reads (including the database paths)
- [x] #5 doc-1 (Architecture) matches the code, including the main database, world files, and how a connection picks its world
- [x] #6 Other Backlog docs (world generation, visual language, style guide) are checked, and stale statements are fixed or marked as history
- [x] #7 Screenshots are taken from the running app, the same way every time (for example a Playwright script), so they can be retaken after later changes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add pnpm screenshots: a Playwright config and spec outside the e2e run (own port 4320, own tmp DATA_DIR, installed clock paused at fixed times, muted audio, 960x720) that signs up Wren and Juniper on the built app and writes wake-up (hero), portal-arrival, friends-in-the-garden, and beyond-the-garden to docs/screenshots.
2. Delete the old shots (garden-two-players, discovered-screen, resumed-after-restart).
3. Rewrite the README intro and add sections for waking, the world, and playing with friends; bring the scripts table and settings in line with package.json and main.ts.
4. doc-2: D2, D3 (display name), D23 (what guards the rule now that legacy.test.ts is gone), D24 (arrival and click to start), D25 (as built: portals, depart, in-memory admission state).
5. doc-1: intro, record upgrade function name, protocol message lists; verify the rest against the code.
6. doc-3/4/5: fix stale current-behaviour statements, mark design-record statements as history (audit by a read-only subagent, each finding checked).
7. Verify: typecheck, lint, format:check, test; run screenshots twice and compare; check README links and images resolve.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
pnpm screenshots (playwright.screenshots.config.ts + screenshots/readme.spec.ts, port 4320, own tmp DATA_DIR, not in the e2e run: playwright test --list shows 35 e2e tests, none from screenshots/) writes wake-up.png (hero), beyond-the-garden.png, portal-arrival.png, friends-in-the-garden.png. Each page runs on an installed clock paused at fixed times after 2026-06-21T10:00Z; Wren's world seed is set to 7 before first entry. Across five runs wake-up and beyond-the-garden were pixel-identical (checked with a canvas pixel diff); the two visitor shots differ only where the visitor and portal stand, because arrival.ts picks a random free garden tile.
The wake text is now 'Click to start.' (TASK-62), not 'Press [space] to start.'; the hero shows the current text. The garden's dirt paths run east and west and the north and south hedge gaps open onto grass (garden.ts, D5), so the shots show that.
Old shots deleted: garden-two-players, discovered-screen, resumed-after-restart. Completed task-9 still names them as its evidence; left as history.
Docs: doc-1 intro, Chunks replaces getOrCreateScreen, features, walkability, client messages, arrival; doc-2 D2, D3, D22, D23, D24, D25 as built; doc-3/doc-4 status lines mark them as history with the differences named; doc-5 flora table, rose ramp row, SHADOW, gallery sentence, plant sheet sentence removed. Audit of doc-3/4/5 by a read-only subagent, findings spot-checked against palette.ts, sprite.ts, gallery.ts, flora.ts.
Validation: pnpm typecheck, lint, format:check, test (1006 + 1 perf) pass; root tsc passes; README link and image check: 7 targets, 0 missing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
README, screenshots, and Backlog docs describe the game as it plays now. The README intro and a new How it plays section cover your own world, waking in the garden each session, display names, and opening your world to friends with a code they arrive through by portal; a settings table lists every variable main.ts and paths.ts read (PORT, DATA_DIR, SESSION_TIMEOUT_MS, TRUST_PROXY, NODE_ENV, LLM_*), and the scripts table matches package.json. New pnpm screenshots (a Playwright project outside the e2e run, own port and data directory, paused clocks) retakes wake-up.png (hero), beyond-the-garden.png, portal-arrival.png, and friends-in-the-garden.png from the built app; the three old shots are gone. doc-1 and doc-2 match the code (Chunks, features, protocol, display names, D23's guarding tests, D24 click to start, D25 as built); doc-3 and doc-4 are marked as history with the differences named; doc-5 matches BIOME_RAMPS, SHADOW, and the shipped art. Verified with typecheck, lint, format:check, 1006 unit tests, repeated screenshot runs compared pixel by pixel (static shots identical, visitor shots differ only at the random arrival tile), each shot inspected, and a README link and image check.
<!-- SECTION:FINAL_SUMMARY:END -->
