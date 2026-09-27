---
id: TASK-77
title: 'Graves store their name, so a longer name list never renames them'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:51'
updated_date: '2026-09-27 16:47'
labels:
  - core
  - server
dependencies: []
references:
  - packages/core/src/traces/kinds/epitaph.ts
  - apps/server/src/epitaphs.ts
  - apps/server/src/epitaph-admin.ts
  - apps/server/src/db.ts
  - apps/server/src/traces.ts
documentation:
  - backlog/docs/doc-2 - Decision-log.md
priority: high
type: feature
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A grave's name is not stored. `graveName()` in `packages/core/src/traces/kinds/epitaph.ts` recomputes it every time as `NAMES[hash % NAMES.length]`, so any change to `NAMES` renames existing graves. The epitaph trace row (JSON in the world `traces` table) holds only `{ kind, tx, ty, text, source }`.

Commit 9079fda grew `NAMES` from 32 to 110 and `PHRASES` from 16 to 50. Every grave in existing worlds was named from the old 32-name list (`git show 9079fda^:packages/core/src/traces/kinds/epitaph.ts`), and model-written epitaphs carry those old names in their text. At the time of writing, 9079fda had not been pushed or deployed. This task should land before or with it, so players never see a grave renamed.

Store the name on the grave as its own field, separate from the epitaph text. The name list is then used only to pick a name when a grave is first created. This also lays groundwork for a planned night-time feature where ghosts are named after the actual graves on a screen or in a world.

Constraints found while scoping:
- Existing rows need a one-time backfill of `name`. A SQL migration cannot compute it, because the name comes from `tileHash` in code, so the backfill belongs where a world opens (`openWorldDatabase` in `apps/server/src/db.ts`, alongside `upgradeScreenRecords`).
- The backfill must run before any trace is read. `parseRow` in `apps/server/src/traces.ts` skips rows that fail the schema (D22), and the epitaph kind's `settle` would then put a second epitaph on that grave.
- The backfill must use a frozen copy of the old 32-name list, so stored names match the names carved in existing text. It must leave existing `text` and `source` unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An epitaph trace stores the buried person's name as a field separate from the epitaph text
- [x] #2 A newly created grave picks its name from the name list once and stores it; its seed epitaph uses that stored name
- [x] #3 Changing the name list or the phrase list does not change the name or text of any existing grave
- [x] #4 Opening a world whose graves predate this change backfills each grave's name from the pre-9079fda 32-name list, leaving text and source unchanged
- [x] #5 After the backfill, no grave has two epitaph traces and none is skipped as unparseable
- [x] #6 The language model prompt for a pending grave uses the stored name
- [x] #7 Restoring a seed epitaph through the admin CLI (`pnpm epitaphs --clear`) uses the stored name, and the CLI listing shows the name
- [x] #8 Tests cover the backfill on a pre-change world, name stability across a list change, and new-grave creation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a required name field to the epitaph trace; settle picks it once via graveName and seeds text from it.
2. Every reader (LLM prompt in epitaphs.ts, admin CLI clear + listing) uses the stored name.
3. One-time backfill in openWorldDatabase before any trace read: rows missing name get it from a frozen copy of the pre-2b9cffd 32-name list; text and source untouched.
4. Tests: backfill on a pre-change world (no duplicate epitaphs, none skipped), name stability across a list change, new-grave creation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Old list taken from 2b9cffd^ (same content as 9079fda^; 2b9cffd is the pushed form). Backfill fixture is real pre-2b9cffd settle output (seed 1234567, overworld 6,1). Backfill sits under the upgradeRecords flag so world:wipe skips it like the record lift. Mutation-checked: mod-110 backfill, no backfill, overwriting names, prompt/--clear ignoring stored name each fail a test. Validation: pnpm typecheck, lint, format:check, test all pass. Decision recorded as D27. PR https://github.com/geekitycom/explore/pull/10
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Epitaph traces store the buried person's name. settle picks it once from NAMES and seeds the text from it; the model prompt and the epitaphs admin CLI (list, --clear) read the stored name. openWorldDatabase backfills unnamed rows from a frozen copy of the original 32-name list before any trace is read, leaving text and source untouched. Verified with new core and server tests (pre-change world fixture, stable names across list changes, new-grave creation) plus typecheck, lint, format and the full suite. PR #10.
<!-- SECTION:FINAL_SUMMARY:END -->
