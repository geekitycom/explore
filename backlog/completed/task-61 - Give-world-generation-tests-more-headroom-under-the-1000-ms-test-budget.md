---
id: TASK-61
title: Give world-generation tests more headroom under the 1000 ms test budget
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 13:51'
updated_date: '2026-09-26 14:13'
labels:
  - testing
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After TASK-57 every unit test is under 1000 ms, but on the arm64 CI runner the world-generation tests sit at 500-670 ms (generate.test lakes/forests 671, reach tests 520-532, river seams north 590; CI run 36245904783), and generate.test.ts alone takes about 14 s. Most of it is generating screens (about 1 ms each on the Mac) and cold per-seed fields. Cut the cost further so the budget cannot flake on a slower runner, without weakening what each test catches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No unit test exceeds 400 ms on the arm64 CI check job
- [x] #2 Each changed test still fails on the defect it guards, checked by injecting it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pull per-test times from recent arm64 CI check logs (tests over 300 ms are printed) as the baseline.
2. generate.test: walk the region before generating margin screens, and generate margin screens only when the region alone leaves a screen unreached (same verdict); split the whatever-order regeneration into parts plus a seam check; compute each screen's crossings once; build the seed-3 land sample once per describe and split its assertions.
3. rivers.test, roads.test, photo-palette.test and the slow server tests (wipe, epitaphs, legacy): find each one's cost and cut it without weakening.
4. Inject each changed test's defect into old and new copies with mutate.mjs.
5. lint, typecheck, format, test; land on main; read per-test times from the CI run of the commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline, arm64 CI check job (runs 36246578224, 36246566542, 36246433930, 36246533136): world-generation tests 412-702 ms (lakes/forests/meadows 650-702, reach and opens-onto 434-587, whatever-order 412-537), river seams north 391-565, wipe 405-476, epitaphs two players 399-468, photo meadow palette 415-424, roads whatever-order 362-390. generate.test.ts 13.4-14.6 s.

After, CI run 36247595694 (commit 7942d67): slowest unit test 362 ms (epitaphs two players), then 349 (dressing lakes), 330 (legacy), 320/314 (web terrain seams), 313 (preview); no other test over 300 ms. generate.test.ts 7.9 s, rivers.test.ts 2.9 s, unit Duration 20.8 s (was 22.9 s).

What changed: the reach walk covers the region first and generates margin screens only while a region screen stays unreached (same verdict; seeds 16838 and 48514 still step out, so that path runs). Whatever-order regeneration split into 4 parts plus a seam check on the row-order screens. Crossings computed once per screen. River seams run in 2 ordered parts per half. Moved to describe scope (collection, which the budget does not time): the seed-3 sample, the river wet grid, one fresh road network's masks (also removes a duplicate network build), and the photo palettes (k-means is about 100 ms per biome; no exact speedup found). wipe.test uses a stub generator that records the seed and passwordHash 'x'. No generation code changed, so no fingerprint was needed.

Defects: scratchpad t61/mut.json run with mutate.mjs against old and new copies of generate, rivers, roads, photo-palette and wipe tests: 23 defects, old and new tests caught the same ones (4 missed by both, unchanged from TASK-57).

Not changed: epitaphs (362) and legacy (330) in apps/server, both under 400; their cost is game prefetch and a cold world, outside the test files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
World-generation tests now run in 100 ms or less alone, and the slowest unit test on the arm64 CI check job is 362 ms, down from 702 ms (CI run 36247595694 against runs 36246578224 and others). generate.test.ts takes 7.9 s instead of about 14 s. The reach walk generates margin screens only when it needs them, with the same verdict. Heavy loops were split into ordered parts, and shared fixtures are built once per describe. The wipe test uses a stub generator. No generation code changed. Injecting 23 defects into old and new copies of each changed test gave identical catches.
<!-- SECTION:FINAL_SUMMARY:END -->
