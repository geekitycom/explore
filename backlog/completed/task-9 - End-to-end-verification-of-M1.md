---
id: TASK-9
title: End-to-end verification of M1
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 22:11'
labels: []
milestone: m-0
dependencies:
  - TASK-8
references:
  - docs/screenshots/garden-two-players.png
  - docs/screenshots/discovered-screen.png
  - docs/screenshots/resumed-after-restart.png
priority: medium
type: task
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Drive the real app in a browser as two users and confirm the M1 experience end to end, then record the evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Two users sign up, meet in the garden, and see each other walk
- [x] #2 A newly discovered screen persists across a server restart and matches its neighbors' edges
- [x] #3 Evidence (screenshots or GIF) is attached to this task
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build and start the production server (pnpm build, pnpm start) on a file DB.
2. Scripted Playwright session (scratch script, real Chrome): two users sign up, meet in the garden, one walks; screenshots from both views.
3. One user walks south into an undiscovered screen; record the screen record and pose.
4. Stop and restart the server on the same DB; log back in; confirm the same screen record and resumed pose.
5. Check seam equality between the garden's bottom lattice row and the new screen's top row from the stored records.
6. Save screenshots under docs/screenshots and reference them from this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scripted run on the production build (pnpm build, pnpm start, file DB, Playwright in system Chrome):
- ivy and oak signed up with different avatars; each saw the other at (160,202) in the garden.
- ivy walked left and up; oak's view of ivy moved from (160,202) to (123,180).
- oak walked south off the garden and discovered (0,1), arriving at (160,14) facing s; ivy's garden view then showed no one.
- Server stopped (SIGTERM) and restarted on the same DB. oak logged in and resumed at (0,1) (160,14). The stored (0,1) record was byte-identical before and after restart, created_by = oak.
- Seam check from stored records: garden bottom lattice row and (0,1) top lattice row both gggggggggdddggggggggg; bottom and top feature rows both TBBBBBBBB..BBBBBBBBT.
Evidence: docs/screenshots/garden-two-players.png, docs/screenshots/discovered-screen.png, docs/screenshots/resumed-after-restart.png. The automated equivalents live in e2e/world.spec.ts and apps/server/src/play.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified M1 end to end on the production build: two users met and watched each other walk in the garden, a newly discovered screen persisted byte-for-byte across a server restart with its seam matching the garden, and the player resumed where they left off. Screenshots saved in docs/screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
