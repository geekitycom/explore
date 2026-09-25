---
id: TASK-49
title: Share the replaced-session close code and the clamp helper
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 20:18'
updated_date: '2026-09-25 20:26'
labels:
  - chore
dependencies: []
priority: low
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-16 found two small duplications that cross package boundaries. The WebSocket close code 4000 (a newer session replaced this one) is hard-coded in apps/web/src/game/net.ts and apps/server/src/play.ts; a constant in @explore/core would keep client and server in step. apps/web/src/art/life.ts defines its own clamp, identical to the one in packages/core/src/recipes/draw.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The replaced-session close code is defined once in @explore/core and used by both server and client
- [x] #2 apps/web uses one clamp helper instead of a private copy
- [x] #3 All unit and e2e tests pass unchanged
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add REPLACED_CLOSE_CODE=4000 to packages/core/src/protocol.ts. 2. Use it in apps/web/src/game/net.ts and apps/server/src/play.ts instead of the hard-coded 4000. 3. Export core's existing clamp (packages/core/src/recipes/draw.ts) from packages/core/src/recipes/index.ts and import it in apps/web/src/art/life.ts, deleting the local copy. 4. Verify with pnpm lint/typecheck/test/format:check/e2e.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified: pnpm lint (clean), pnpm typecheck (all 3 packages pass), pnpm format:check (clean), pnpm test (461/461 unit tests pass), pnpm e2e (11/11 pass). No behavior change: both clamp implementations were mathematically equivalent (Math.max(lo,Math.min(hi,v)) vs Math.min(Math.max(v,lo),hi)); close code 4000 kept its numeric value, only moved to a shared named constant.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added REPLACED_CLOSE_CODE (=4000) to packages/core/src/protocol.ts and used it in apps/web/src/game/net.ts and apps/server/src/play.ts, replacing the hard-coded 4000 on both sides. Exported core's existing clamp helper (packages/core/src/recipes/draw.ts) via packages/core/src/recipes/index.ts and switched apps/web/src/art/life.ts to import it, deleting its private copy. No behavior change. Verified with pnpm lint, typecheck, format:check, test (461/461), and e2e (11/11).
<!-- SECTION:FINAL_SUMMARY:END -->
