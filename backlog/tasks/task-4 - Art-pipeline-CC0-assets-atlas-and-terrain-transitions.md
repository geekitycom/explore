---
id: TASK-4
title: 'Art pipeline: CC0 assets, atlas, and terrain transitions'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:43'
labels: []
milestone: m-0
dependencies:
  - TASK-1
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Import CC0 terrain, feature, and character art with its license, define the sprite atlas, and produce the corner-mask transitions so terrain blends coherently. See decision-1, decision-4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All shipped art is CC0 with license files and sources recorded in the repo
- [ ] #2 Every corner combination of every terrain pair renders a coherent transition
- [ ] #3 Avatar layers can be recolored per the avatar palette and animate in 4 directions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delegated to a subagent in an isolated worktree; brief follows D15-D17. Asset research (Ninja Adventure, CC0) done beforehand by a research subagent; report summarized in decision log D15.
<!-- SECTION:NOTES:END -->
