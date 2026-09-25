---
id: TASK-49
title: Share the replaced-session close code and the clamp helper
status: To Do
assignee: []
created_date: '2026-09-25 20:18'
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
- [ ] #1 The replaced-session close code is defined once in @explore/core and used by both server and client
- [ ] #2 apps/web uses one clamp helper instead of a private copy
- [ ] #3 All unit and e2e tests pass unchanged
<!-- AC:END -->
