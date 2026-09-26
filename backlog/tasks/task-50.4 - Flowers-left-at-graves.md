---
id: TASK-50.4
title: Flowers picked and left at graves
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 21:47'
updated_date: '2026-09-26 01:45'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
parent_task_id: TASK-50
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Players pick flowers from the flower patches that grow in the world and carry them to graves (TASK-48.3). The species picked is the species left, so poppies on a tundra grave show that someone carried them from a meadow. Picking is the limit: there is no daily allowance. A picked plant is picked for everyone and regrows through sprout and bud stages over a couple of days, so a patch of sprouts shows that someone was just there. Each grave holds one set of flowers at a time; they stay fresh for a few days, then wilt, then disappear, and only then can someone leave new ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 E on a flower patch adds that species to the inventory bar, stacked by species; the picked plant regrows after a fixed number of days
- [x] #2 Using flowers on a grave leaves that species there; any other target is refused with 'Flowers can only be placed on graves'
- [x] #3 A grave with flowers, fresh or wilted, refuses more with 'This grave already has flowers' and the player keeps their bouquet; facing it shows who left them
- [x] #4 Flowers on a grave show fresh, then wilted, then disappear over a fixed number of days
- [x] #5 Flower sprites come from the species recipes in FLORA and pass pnpm lint:art
- [x] #6 A picked plant regrows through visible stages, sprout then bud then full flower, over its regrowth days, and can only be picked again once it is a full flower; each stage is a recipe of the species that passes pnpm lint:art
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Flower recipe gains an optional form: sprout, bud (regrowth stages), bunch (fresh on a grave) and wilted; every flower species at every form joins the recipe style-lint list and the art gallery.
2. Kind 'picked' (kinds/picked.ts): a trace {at} on a picked flower tile; hides the generated plant and draws sprout, bud, then the full species by elapsed time; E on a flower-family plant gains a 'flowers' item of that species, refused while regrowing.
3. Kind 'flowers' (kinds/flowers.ts): carried item keyed by species name; use on a grave puts {species, by, at}; fresh then wilted then gone by elapsed time from the stored timestamp and Here.now; refusals for non-graves and graves already holding flowers; bubble names who left them.
4. Tests in core with an injected now; e2e picks a flower, leaves it on a grave, screenshots each state.
5. lint, typecheck, test, format:check, lint:art, e2e; rebase and push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Flowers in hand do not wilt (a real-time wilt while carrying felt nagging in the demo).

Defaults chosen: regrowDays 2 (sprout the first day, bud the second), grave flowers fresh 3 days and wilted until day 5; both live in the LIMITS table. Only flower-family species are pickable, so mushrooms in forest and taiga flower patches are left alone. The picked state is one shared trace per tile: 'does not remove it for other players' read as the plant staying in the world and regrowing for everyone, matching AC6. E on a regrowing plant is refused with 'It has not grown back yet.' Refusal texts keep the house full stop: 'Flowers can only be placed on graves.' and 'This grave already has flowers.' No carry limit (the flowers kind's full text is unreachable without one); the ten slots are the only cap. A regrown patch is drawn by its picked trace with the trace seed, so it may differ slightly from the original clump and does not sway in the wind. Expired grave flowers stay as a row and are overwritten by the next bunch. The who-left-them line is the flowers trace's own bubble ('Cornflower, left by name'), so TASK-52's epitaph can sit beside it on the same tile.

Verified: pnpm lint, lint:art, typecheck, format:check, test (600 tests incl. packages/core/src/traces/kinds/flowers.test.ts with an injected now, mutation-checked), pnpm e2e 13 passed. Live run against a local server (scripted Playwright, clock faked client-side for later days) screenshots in /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/5fcbf254-9b57-47b2-a2bf-c0a00fadf132/scratchpad/task-50.4: 1-pick-prompt, 2-picked-sprout-and-bouquet, 3-refusal-regrowing, 4-refusal-not-a-grave, 5-grave-fresh, 6-refusal-grave-has-flowers, 7-grave-wilted, 8-grave-gone, 9-regrow-bud, 10-regrow-bloom (each with a -zoom crop), gallery-flowers.png (art.html?section=flowers).

Correction: the unit test count is 595 (594 plus the perf test), not 600.

User confirmed on 2026-09-25: picked flowers regrow for everyone (shared state), as built.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Players pick flowers with E from flower patches: the species goes into the inventory bar stacked by species, and the patch regrows for everyone as a sprout, then a bud, then the full flower over two days, refusing a second pick until then. Selecting the bouquet and using it on a grave leaves that species there as a laid bunch that stays fresh three days, wilts until day five, then disappears; a bubble in reach names the species and who left it. Other targets refuse with 'Flowers can only be placed on graves.', a grave already holding flowers with 'This grave already has flowers.', and the player keeps the bouquet. Code: two trace kinds, packages/core/src/traces/kinds/picked.ts and flowers.ts, each stage derived from a stored timestamp and Here.now; the flower recipe gained a form (sprout, bud, bunch, wilted) with FLOWERS, pickable and flowerRecipe in flora.ts; every form of every flower is in the recipe style-lint test and a new flowers gallery section. Verified with lint, lint:art, typecheck, format:check, 595 unit tests, 13 e2e specs and a scripted live run with screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
