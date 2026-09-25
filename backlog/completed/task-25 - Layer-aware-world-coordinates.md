---
id: TASK-25
title: Layer-aware world coordinates
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 01:47'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Houses, caves, and towns will be separate layers the player travels into (decision-20). Give screen coordinates a layer now, with overworld the only one, so later phases add layers without migrating every table and message.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Screen coordinates, stored screens, player positions, and protocol messages carry a layer, defaulting to overworld
- [x] #2 Two screens at the same sx, sy on different layers are distinct everywhere (storage, presence, travel)
- [x] #3 Players on different layers never see each other
- [x] #4 Existing tests pass and new tests cover layer separation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent in an isolated worktree; reviewed and cherry-picked. Branded LayerId with OVERWORLD; ScreenCoord { layer, sx, sy }; screenKey and neighborCoord keep the layer; codec v2 with a layer field; migration 3 rebuilds screens (PK layer, sx, sy) and player_state with a layer and rewrites stored JSON in SQL; presence separation falls out of layered screenKey.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions: screen records moved to v2 and the decoder accepts only v2; stored records are upgraded in the migration with json_set so the migration stays fixed if the codec changes. Rebuilt tables have no default layer, so code that forgets a layer fails loudly. Music regions and art tile hashes still ignore the layer (harmless until interiors exist). The layer id grammar (place:<poi>, cave:<poi>:<n>) is not enforced yet.
Verified: 5 new tests (codec layer round trip and rejects; neighbour lookup stays in layer; separate rows per layer; player state resumes the layer; old-schema DB upgrades) plus a play test with bob on a cellar copy of the garden and alice on the overworld garden, neither seeing the other (sentinel), both travelling within their layer, bob resuming on cellar after reconnect. Mutation: keying presence on sx,sy alone fails the new play test. The migration was run on a copy of the real dev DB (144 screens, one saved player) and everything decoded as overworld. After cherry-picking onto main with the wipe command and preview tool: 208 unit tests and 7 e2e tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Screen coordinates, stored screens, player positions, presence, and the screen message now carry a layer (overworld for now), with a migration that upgrades existing databases. Verified with layer-separation tests, a mutation check, a real-DB migration run, and the full unit and e2e suites.
<!-- SECTION:FINAL_SUMMARY:END -->
