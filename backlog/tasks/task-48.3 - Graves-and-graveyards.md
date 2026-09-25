---
id: TASK-48.3
title: Graves and graveyards
status: To Do
assignee: []
created_date: '2026-09-25 19:18'
updated_date: '2026-09-25 19:18'
labels: []
milestone: m-4
dependencies:
  - TASK-48.1
parent_task_id: TASK-48
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Grave markers (headstones, wooden crosses, cairns, open or sunken graves) and a graveyard point of interest: a fenced plot of graves, sometimes overgrown or with a broken fence, registered in POI_KINDS so roads can reach it. Lone graves may also appear by roadsides or ruins. Generator output changes follow decision D23 (bump GENERATOR_VERSION; stored screens keep their look).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Grave marker variants exist as recipes, passing pnpm lint:art
- [ ] #2 A graveyard POI kind generates a fenced plot of graves that a road reaches
- [ ] #3 Graveyards and lone graves never block a road or trap a player
- [ ] #4 Stored screens are unchanged (D23)
- [ ] #5 The art gallery shows graves; an in-game screenshot shows a graveyard
<!-- AC:END -->
