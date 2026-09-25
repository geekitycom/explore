---
id: TASK-50.5
title: Footpaths worn by walking
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
parent_task_id: TASK-50
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Where many players walk the same tiles, grass slowly wears into a faint path, and paths grow back if nobody uses them. Wear counts distinct players per tile over time, not steps, so one player walking in circles cannot carve a path. This trace needs no allowance because it comes from walking. It is drawn over the generated terrain and never changes stored screen records (D23).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tiles that many distinct players cross within a time window show visible wear in stages, up to a worn path
- [ ] #2 One player repeatedly crossing the same tile does not wear it past the first stage
- [ ] #3 Unused wear fades back to the base terrain over time
- [ ] #4 Wear is drawn over grass-like terrains only, keeps screen seams consistent, and does not change stored screens
<!-- AC:END -->
