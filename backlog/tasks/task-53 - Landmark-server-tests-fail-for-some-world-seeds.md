---
id: TASK-53
title: Landmark server tests fail for some world seeds
status: To Do
assignee: []
created_date: '2026-09-26 01:56'
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
- [ ] #1 The landmarks tests in play.test.ts pass for every world seed, for example by pinning the seed or choosing the stand tile from the server's own rule
<!-- AC:END -->
