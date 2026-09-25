---
id: TASK-50.2
title: Signs with short notes at landmarks
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 22:53'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
parent_task_id: TASK-50
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A player can plant a sign with a short note (for example up to 80 characters) near a landmark or road. Other players read it by walking up to it, with the author's name shown. Signs are the rarest trace (for example one a day), so each one is worth writing. Because this is free text from players, the author can remove their own sign, an admin can remove any sign, and players can report a sign.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A player can place a sign with a note up to the length limit on a walkable tile near a landmark or road, within their allowance
- [ ] #2 Walking up to a sign shows its note and author
- [ ] #3 Authors can remove their own signs; an admin command removes any sign; players can report a sign and reports are recorded
- [ ] #4 Signs never block a road or trap a player
- [ ] #5 A sign sprite exists as a recipe and passes pnpm lint:art
- [ ] #6 Players start with one sign in inventory slot 1 and get one more each day up to the allowance; using it on open ground within two tiles of a road opens a note dialog with a live character count
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Reading: the note shows in a bubble with the author's name when the player stands next to the sign, no key press.
<!-- SECTION:NOTES:END -->
