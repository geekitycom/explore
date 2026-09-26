---
id: TASK-53
title: Landmark server tests fail for some world seeds
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 01:56'
updated_date: '2026-09-26 02:07'
labels: []
dependencies: []
priority: low
type: bug
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
apps/server/src/play.test.ts landmarks tests (atLandmark) fail about 1 run in 6 on main, because each run rolls a random world seed. Seen: 'expected refused to be traces' with reason 'Stand in the ruin to name it.' The stand tile beside the signpost is checked with isWalkable and inArea, but the player's centre tile at poseOn(stand) apparently can fall outside the area or be moved. Reproduce with: for i in $(seq 12); do npx vitest run apps/server/src/play.test.ts -t landmarks; done. Found while doing TASK-52; reproduced on origin/main at e5c7cf9 without TASK-52's changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The landmarks tests in play.test.ts pass for every world seed, for example by pinning the seed or choosing the stand tile from the server's own rule
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce per seed with a temporary world-seed override in atLandmark.
2. Instrument the pose the server sends back on reconnect to find why the naming is refused.
3. Fix at the root (game rule or test) and prove it over 60 seeds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: a race in the test, not a game bug. atLandmark scouted the screen as Alice, closed the scout socket, then wrote Alice's stand pose with savePlayerState. The client close resolves on the close handshake, but the server's onClose -> game.disconnect -> save(player) can run after that write and put Alice back at the scout pose (GARDEN_SPAWN, tile 10,12). The name is then refused whenever tile 10,12 lies outside the landmark area, which is seed dependent. Evidence: with a temporary SEED override, seeds 7, 17, 18, 23, 26 of 1..30 failed and the reconnect 'you' pose was 160,202 (GARDEN_SPAWN) instead of poseOn(stand); passing seeds got poseOn(stand). A 200 ms wait after scout.close made all five pass. The stand tile itself is fine: centreTile(poseOn(stand)) is the stand tile, the same rule the server's landmark apply uses (TASK-50.1). The server saving a leaving player's pose is correct game behavior.
Fix: scout with a third account (user 3), so the late disconnect save only touches the scout. Validation: seeds 1..60 with the override, 0 failures (landmarks: 3 passed each); pnpm lint, typecheck, format:check, test (674 passed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The landmark tests' setup raced the server: the scout socket's server-side disconnect saved Alice's scout pose over the stand pose the test had just written, so she reconnected at the garden spawn tile and naming was refused whenever that tile fell outside the landmark area. atLandmark now scouts with a third account. Verified 0 failures over world seeds 1..60 (previously 5 of 30), plus lint, typecheck, format and the full test suite.
<!-- SECTION:FINAL_SUMMARY:END -->
