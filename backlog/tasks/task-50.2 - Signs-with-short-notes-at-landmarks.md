---
id: TASK-50.2
title: Name a landmark
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 21:47'
updated_date: '2026-09-26 01:38'
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
Landmarks are the points of interest the generator already places (POI_KINDS: stone circles, ruins, groves, lakesides, clearings, towns, caves, graveyards). The first player to reach a landmark that has no name can choose to name it. Naming plants a signpost at a spot the generator picks for that landmark, and everyone who walks up to it reads the name and who gave it; the name also appears on /map. There is one landmark per region, so names stay rare and need no allowance. Names are public text written by players, so they can be removed and reported.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Landmarks are defined in code from POI_KINDS, each with its area and a fixed signpost spot chosen by the generator that never blocks a road or traps a player
- [x] #2 When a player stands in an unnamed landmark's area, the hint bar offers 'Name this place'; declining leaves it open for the next visitor, and named landmarks never offer it
- [x] #3 The naming dialog takes a name (up to about 30 characters) and an optional short line (up to about 80), with live counts; saving plants the signpost; if two players save at once the first wins and the other is told who named it
- [x] #4 Walking up to a signpost shows the name, the optional line and the namer in a bubble, and named landmarks show their names on /map
- [x] #5 The namer can rename or clear their name; an admin command clears any name; players can report a name and reports are recorded
- [x] #6 The signpost sprite is a recipe that passes pnpm lint:art
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: landmarks.ts derives the landmark whose POI centre lies on a screen (networkOf poisIn, hubs skipped) with its area (footprint ellipse in screen-local lattice units) and signpostSpot(screen, area): first tile, nearest the centre, whose 3x3 lies in the footprint and is walkable on the bare screen, not on a road, not edge, wayIfSolid open.
2. Core kind traces/kinds/landmark.ts: trace at the signpost tile {poi, area, named?: {name, line?, by, at}}; settle puts the unnamed site when a screen opens; offer 'Name this place' when standing in an unnamed area; action name/clear (first wins, author only renames or clears); solid and drawn only when named; bubble {text, line, by}. Bubble becomes a small generic record so epitaphs reuse it. Signpost recipe family.
3. Protocol: report message; server records reports in trace_reports (deduped), map JSON gains names; admin script pnpm names (list, --clear) following world:wipe.
4. Web: E on an offer opens the naming dialog (live counts, pending until the server confirms or refuses); DOM bubble layer over the world with Report and Edit buttons; /map draws names.
5. Tests: core landmarks/kind, server play (name, race, rename/clear, report, map), web dialog/bubbles; e2e spec with screenshots; lint, typecheck, test, format, lint:art, e2e; land on main; CI.

6. Coordinator addition: bubbles never cover player names (one bubble at a time, lifted clear of names), for signposts, flowers, cairns and later epitaphs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Reading: the note shows in a bubble with the author's name when the player stands next to the sign, no key press.

Replaces free-form note signs placed from the inventory with a daily allowance. Decided 2026-09-25 while brainstorming how players get signs.

Defaults chosen: a landmark belongs to the screen holding its POI centre (a town footprint spilling onto a neighbour is named only from the centre screen); the signpost spot is chosen from the bare generated screen (tile in the area, walkable, no path corner, not the edge, wayIfSolid open, a walkable side neighbour in the area; nearest the centre, then least crowded, then bare ground), so when no such tile exists that landmark is not nameable; the unnamed site is an invisible walkable landmark trace settled when the screen opens, and naming turns it into a solid signpost through the usual world rules (refused if someone stands on the spot). The namer renames or clears from the Edit button on their own bubble; others get a Report button, and reports dedupe per reporter and snapshot. E takes an offer the same as an act, so the hint reads 'E  Name this place'. The admin command is pnpm names (list with report counts) and pnpm names --clear sx,sy [--layer]; it edits the database, so a server holding that screen open shows the change once everyone has left it. Bubble moved from canvas text to a DOM layer: Bubble is {text, line?, by?, credit?}; flowers and cairns keep their text and get no Report button since they carry no free text. One bubble shows at a time (faced trace, else nearest) and it rises to the lowest spot that covers no player's name.

Verification on 4730a05 (rebased on cb4d46f): pnpm lint, lint:art (8 PNGs), typecheck, format:check, test (654 tests: core landmarks.test over three samples of every POI kind for spot rules and unchanged walkable patches, landmark.test for offer/name/race/rename/clear/world rule/settle, server play.test landmarks for first-wins race, report recording and dedupe, map names, admin clear; web bubbles.test for one-at-a-time and never covering the reader's name at every standing position, naming-dialog.test), pnpm e2e 15 specs including e2e/landmarks.spec.ts which teleports a player beside a real landmark, names it through the dialog, reads the bubble and finds the name on /map. Screenshots: e2e/.results/landmark-dialog.png, landmark-bubble.png, landmark-map.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Players can name the landmarks the generator places. Core: landmarks.ts gives each non-hub POI to the screen holding its centre, with its footprint as the area and a signpost spot derived from the generated screen that is off roads and edges, has a free tile beside it, and never splits walkable ground; the landmark trace kind (one file plus one export line) settles an invisible site there, offers 'Name this place' inside an unnamed area, names it through an action (first save wins, the second is told who named it, the namer can rename or clear), and draws a solid signpost recipe once named. Server: report messages land in trace_reports once per reporter and wording; /api/map carries names; pnpm names lists names with report counts and pnpm names --clear sx,sy clears one. Web: E opens a naming dialog with live counts that stays open until the server shows or refuses the save; bubbles are a generic DOM layer (text, line, author, Report or Edit) showing one at a time and lifted clear of every player's name, which also fixes flower and cairn bubbles covering names; /map labels named landmarks. Verified with lint, lint:art, typecheck, format:check, 654 unit tests and 15 e2e specs including e2e/landmarks.spec.ts with screenshots landmark-dialog.png, landmark-bubble.png and landmark-map.png.
<!-- SECTION:FINAL_SUMMARY:END -->
