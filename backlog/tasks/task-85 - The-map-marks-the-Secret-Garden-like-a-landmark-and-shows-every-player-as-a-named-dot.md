---
id: TASK-85
title: >-
  The map marks the Secret Garden like a landmark and shows every player as a
  named dot
status: Done
assignee:
  - '@claude'
created_date: '2026-09-28 02:01'
updated_date: '2026-09-28 02:16'
labels:
  - client
  - server
dependencies: []
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The world map frames the garden screen in yellow under a "Garden" label, and frames your own screen in pink under "You". Landmarks read better: a small marker with the name above it. Players on the map should look alike, host and visitors, so you find yourself by your own display name. Requested by Andrew on 2026-09-27 with screenshots of the current garden and landmark labels.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The garden is marked and labelled "Secret Garden" the way a landmark is, with no border around its screen
- [x] #2 No player screen has a border and no "You" label is drawn
- [x] #3 Every player on the map, including the viewer, is a dot labelled with their display name
- [x] #4 Each dot is filled with that player's shirt colour, so visitors and the host look alike apart from colour
- [x] #5 Labels still never overlap, with players placed before the garden and landmarks
- [x] #6 Server and web unit tests cover the map data (shirt colour per player) and the label list
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. MapPlayer carries the player's shirt colour key (Roster gains the avatar shirt); drop the now-unused you flag if nothing reads it.
2. map-view draws no frames; the garden gets a landmark marker at its screen centre and a 'Secret Garden' label in landmark style; every player is an ink-outlined dot in CLOTH_COLORS[shirt] with a display-name label.
3. mapLabels orders players, then the garden, then landmarks.
4. Update server map tests and map-view.test; verify on the real map page in a browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Screenshots of host (charcoal) and visitor (white) show the garden marker under 'Secret Garden' with no frames, names beside dots. Added: labels avoid dots and markers; a crowded player's name drops just below the dot before rising (unit test + mutation). Names use PAPER; shirt colour lives in the dot. PR https://github.com/geekitycom/explore/pull/19
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map marks the garden as 'Secret Garden' like a landmark and draws every player, the viewer included, as a shirt-coloured dot with their display name; no frames or 'You'. Verified with server and web tests over five layouts, six mutations, and screenshots of a host and a visitor. PR #19.
<!-- SECTION:FINAL_SUMMARY:END -->
