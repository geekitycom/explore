---
id: TASK-22
title: World map page at /map
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:27'
updated_date: '2026-09-25 02:26'
labels: []
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A page that shows the entire discovered world at once, so players can see how far it has grown and where they are. Draws every stored screen as a small rendering of its terrain and features, laid out by coordinate, with undiscovered space left dark.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Visiting /map while logged in shows every discovered screen at its world position, drawn from stored screen data
- [x] #2 Undiscovered coordinates are clearly empty, and the secret garden and the viewer's current screen are marked
- [x] #3 The map can be panned and zoomed and stays responsive with a few thousand screens
- [x] #4 Logged-out visitors are sent to log in
- [x] #5 The game view links to the map and back
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server: GET /api/map (logged in) returns every stored screen record on the viewer's layer plus the viewer's current screen and the garden coordinate; lives in its own module registered in app.ts.
2. Web: /map route in the SPA (the server already falls back to index.html). Logged-out visitors get the login form and land on the map after logging in.
3. Pure mapImage(records): one pixel per tile coloured by terrain with feature tints over the discovered bounding box; undiscovered space stays dark. Unit tested.
4. Map view: canvas with drag and wheel pan/zoom plus keyboard (+/-, arrows, 0 to recentre), markers for the garden and your screen, coordinate readout on hover, links between game and map.
5. Verify: server route test, unit tests, Playwright (map shows a newly walked screen; logged-out redirect), and a timing check with a few thousand screens.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed with Andrew on 2026-09-24: any logged-in player can see the map.

Server: GET /api/map (requireUser) in map.ts returns the viewer's layer, current screen (last saved), the garden, and every stored screen record on that layer, spliced as stored JSON; the client decodes each through the codec. Client: /map route in the SPA, logged-out visitors get the login form and land on the map afterwards; each screen is pre-rendered once at one pixel per tile (majority terrain, features tinted) and only visible screens are drawn; opens fitted to the discovered area; drag, wheel, +/-, arrows, 0 to recentre; hover readout; garden and you outlined and labelled; links both ways.
Bugs found and fixed during verification: pan/zoom maths mixed device and CSS pixels (wrong at 2x density), and the canvas sized itself from its own box under a ResizeObserver, which grew without bound when CSS did not constrain it; it now sizes from its container.
Verified: server integration test (map lists both discovered screens and the viewer's screen after travel; 401 when logged out); 3 colour unit tests; e2e/map.spec.ts (walk south, open the map, both screens listed, keyboard pan/zoom, back to the game, logged-out /map redirects through login back to the map); benchmark at 2x density with 3000 screens: 173 ms to build, 1.6 ms per redraw, a 100 px drag moves exactly 100 world px at scale 1. Known nit: the You label can overlap an adjacent marked screen's edge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the /map page: any logged-in player sees every discovered screen on their layer at one pixel per tile, with the garden and their position marked, pan and zoom by mouse or keyboard, and links to and from the game. Verified with server, unit, and Playwright tests and a 3000-screen benchmark at 2x density.
<!-- SECTION:FINAL_SUMMARY:END -->
