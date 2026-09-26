---
id: TASK-52
title: Epitaphs on graves
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 22:40'
updated_date: '2026-09-26 01:57'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
  - TASK-50.2
  - TASK-51
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Each grave gets a short epitaph (for example "Here lies Dingus") written once and saved with it, so every player reads the same words forever. Walking up to a grave shows the epitaph in a bubble, the same way signs show their notes, and players can still leave flowers there. Epitaphs come from the language-model text generation when a provider is configured, with a prompt that uses the grave's biome and kind of burial ground, a strict length limit and a filter on the output. Screen generation stays pure and fast, so the epitaph is written after the grave is generated and stored apart from the screen record; until one exists, or when no provider is configured, the grave uses a deterministic fallback epitaph from the world seed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every grave shows an epitaph when a player walks up to it, in the same bubble style as signs
- [x] #2 An epitaph is generated at most once per grave, stored with it, and identical for every player and after restarts
- [x] #3 Generation happens outside screen generation, which stays within its time budget and byte-identical
- [x] #4 Without a provider, or when generation fails, graves show a deterministic fallback epitaph from the world seed
- [x] #5 Generated epitaphs are length-limited and filtered, and an admin command can replace or clear one
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core kind traces/kinds/epitaph.ts: trace on each grave tile {text, source: pending|seed|model|admin}; settle puts a pending trace with a deterministic seed epitaph (name + phrase table hashed from world seed, screen and tile) on every grave that has none; bubble shows the text; no recipe, not solid. landmarks.ts gains burialGroundAt(world, coord, tile).
2. Core bubblesAt merges traces on one tile into one bubble: the first kind's words, the others' as its second line, so a grave reads epitaph then 'Cornflower, left by X'.
3. Server epitaphs.ts: writer queue fed when a room opens; one serial promise chain, a per-process tried set per grave so two arrivals never fire twice; prompt from biome, burial ground kind and the seed name; cleanEpitaph filter (first line, strip quotes, collapse space, length limit, blocklist); on ok re-reads the stored trace and commits only if still pending, through TraceStore.commit so rooms update live. Failure keeps it pending (seed text shows) and retries after a restart.
4. main.ts wires createTextGenerator when configured. Admin: pnpm epitaphs lists; --set sx,sy tx,ty text replaces; --clear sx,sy tx,ty restores the seed epitaph for good.
5. Tests: core kind (settle, determinism, merge), server with a fake generator (one call per grave for two players, same text live to both, persisted across restart without a second call, failure/not-configured fallback, admin set/clear, filter).
6. Verify: lint, typecheck, test, format:check, e2e; real run against local Ollama gemma3:12b with a bubble screenshot; land on main; CI green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Defaults chosen: an epitaph is its own trace kind (packages/core/src/traces/kinds/epitaph.ts) keyed on the grave tile, {text <= 60 chars, source: pending|seed|model|admin}. The kind's settle puts a pending seed epitaph (a name and phrase table hashed from world seed, screen and tile) on every grave when its screen's room opens; screen records are untouched. The server's epitaph writer (apps/server/src/epitaphs.ts) takes the pending graves of each room that opens, writes them one at a time off the request path, and commits through TraceStore.commit only if the stored trace is still pending, so rooms update live and an admin edit made meanwhile wins. Each grave is tried once per server run (a per-process set keyed by screen and tile), so players arriving together or a room reopening never start a second call; a failed or filtered try keeps the seed epitaph and is retried after a restart. With no provider configured nothing is called and graves keep their seed epitaph, which a provider configured later still replaces. The prompt carries the seed name, the biome and the landmark around the grave (graveyard, burial ground or ruin, from landmarkAround in landmarks.ts). The filter keeps the first line, strips quotes, markdown and an 'Epitaph:' prefix, folds whitespace, and rejects empty, over 60 characters, control characters or markup, and a small blocklist including model refusals. One bubble per tile: bubblesAt now merges a tile's traces into one bubble in registry order, so a grave reads its epitaph with 'Cornflower, left by X' as the second line. Admin: pnpm epitaphs lists; --set sx,sy tx,ty "words" replaces (source admin); --clear sx,sy tx,ty restores the seed epitaph for good (source seed). The teleport e2e helper moved from landmarks.spec.ts to e2e/helpers.ts.

Verification: pnpm lint, typecheck, format:check, test (674 tests: core epitaph.test for settle, determinism per seed, length, the merged grave bubble and landmarkAround over real graveyards; server epitaphs.test with a fake model and injected clock: one call per grave for two players and a reopened room, both players get the same live traces, the screen row unchanged, persisted across a restart without a second call, failure keeps the seed text and retries after restart, no provider asks nothing, admin set and clear and a late model answer never overwriting an admin edit, filter cases; mutation-checked by disabling the tried set), pnpm e2e 16 passed including e2e/epitaphs.spec.ts (seed epitaph bubble, e2e/.results/epitaph-bubble.png). Live against local Ollama gemma3:12b on a scratch DB: taiga burial ground at -1,-7 wrote 'Tobias, who found peace among the pines.', 'Ada, who gathered moss and told stories.', 'Ned, a quiet hand with wood and song.', 'Percy, a quiet heart for feathered friends.', 'Dingus, a friend to every wandering bird.'; the bubble switched live from the seed text 'Here lies Tobias, fond of naps.' Screenshots in /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/5fcbf254-9b57-47b2-a2bf-c0a00fadf132/scratchpad/task-52: 1-pending.png, 2-generated.png, 3-with-flowers.png. A first prompt wrote samey landscape lines that guessed he or she; the prompt now asks for the name and something about the person. The landmarks tests in play.test.ts are flaky on main for some seeds (about 1 run in 6, reproduced without this change); filed TASK-53.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Graves now carry epitaphs. Core: an epitaph trace kind (kinds/epitaph.ts) settles a pending seed epitaph (name and phrase tables hashed from the world seed) on every grave when its screen opens; bubblesAt shows one bubble per tile, so a grave reads its epitaph with who left flowers as the second line. Server: epitaphs.ts writes pending graves one at a time with the configured model (prompt from the seed name, biome and graveyard, burial ground or ruin), filters the output (first line, quotes stripped, 60-character limit, blocklist), and commits only if the grave is still pending, so every player on the screen sees it live and it persists; each grave is tried once per run and retried after a restart if it failed. main.ts wires createTextGenerator. pnpm epitaphs lists, --set replaces and --clear restores the seed epitaph. Screen records are untouched. Verified with lint, typecheck, format:check, 674 unit tests (fake model, injected clock), 16 e2e specs including e2e/epitaphs.spec.ts, and a live run against local Ollama gemma3:12b with screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
