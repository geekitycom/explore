---
id: TASK-75
title: Landmarks start with generated names that players can rename
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:15'
updated_date: '2026-09-27 16:27'
labels:
  - server
  - core
  - client
  - text-gen
dependencies: []
references:
  - packages/core/src/traces/kinds/landmark.ts
  - packages/core/src/landmarks.ts
  - apps/server/src/epitaphs.ts
  - apps/server/src/text-gen.ts
  - apps/server/src/names.ts
  - apps/server/src/landmark-names.ts
  - apps/web/src/ui/naming-dialog.ts
  - e2e/landmarks.spec.ts
documentation:
  - backlog/docs/doc-1 - Architecture.md
  - backlog/docs/doc-2 - Decision-log.md
priority: medium
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today a landmark (a point of interest with a signpost spot, trace kind `landmark` in `packages/core/src/traces/kinds/landmark.ts`) has no name until a player stands in it and picks "Name this place". Until then the trace is invisible and walkable, and only the player who named it can rename or clear it; anyone else is refused with "<name> named this place first."

Instead, every landmark should start with a creative name and a short message (the existing `name` and `line` fields), so the world feels named and lived-in from the first visit. Players then see "Rename this place" instead of "Name this place".

The rename dialog offers two ways to change it:
- Type a new name and message by hand.
- Press a refresh (regenerate) icon to have the model write a fresh name and message for the place. The new text appears in the dialog fields first, so the player can press it again, edit it, or save it. Saving is what changes the signpost.

Generation should follow the epitaph pattern (`apps/server/src/epitaphs.ts`, and the Text generation section of the README):
- A name and message derived from the world seed are available at once, so the game works with no LLM provider configured.
- When `LLM_*` is set, the server asks the model once per landmark, off the screen-generation path, filters the reply, and commits it as a trace update so everyone on the screen sees it. A failed try keeps the seed text and is retried after a restart.
- The prompt can use what the game knows about the place: the landmark kind (`LANDMARK_NOUNS`), the biome, and nearby features. A regenerate request should ask for something different from the current name.
- Regenerate calls a paid or slow model on demand, so it needs a per-player rate limit and a visible loading state, and it must never block the game loop.

The credit shown on the bubble needs to distinguish generated text from a player's typed rename (today it reads "named by <player>"). A saved regenerated name is still generated text, but a player chose it; the credit should say so.

Open question for whoever picks this up: who may rename a landmark that someone else already renamed (anyone in the world, the world owner, or only the last renamer), and whether visitors may rename landmarks in a world they are visiting. Decide this with the user and record it in the decision log before implementing.

Existing worlds: landmarks already named by a player keep their names; unnamed landmarks get generated text when their screen is next opened.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every landmark shows a name and message on its signpost the first time any player sees its screen, with no player action
- [x] #2 With no LLM provider configured, the name and message are built from the world seed and are the same every time that landmark is loaded
- [x] #3 With an LLM provider configured, each landmark is written by the model at most once per server run, off the screen-generation path, and players on the screen see the new text without reloading
- [x] #4 Model replies that are empty, too long, crude, or not a name are rejected and the seed text stays
- [x] #5 The bubble credit tells a generated name apart from one a player chose
- [x] #6 Landmarks named by players before this change keep their names and credits
- [x] #7 The `pnpm names` admin script lists generated and player-chosen names and can reset a landmark to its generated name
- [x] #8 README text-generation section and doc-1 Architecture describe landmark name generation
- [x] #9 Unit tests cover seed names, reply filtering, rename, and restore; an e2e spec covers renaming a landmark
- [x] #10 The player action reads "Rename this place"; the dialog opens with the current name and message and lets the player type new ones, subject to the rename rule recorded in the decision log
- [x] #11 The rename dialog has a regenerate (refresh) button that fills the fields with a new model-written name and message for that landmark, different from the current one, without changing the signpost until the player saves
- [x] #12 While a regenerate is in flight the button shows a loading state and the game keeps running; a failed or filtered reply shows a short message and leaves the fields unchanged
- [x] #13 Regenerate requests are rate limited per player, and the button is hidden or disabled when no LLM provider is configured
- [x] #14 A player can restore the landmark to its original generated name
- [x] #15 Tests cover regenerate: a new name fills the dialog without saving, the rate limit refuses rapid requests, and a failed model call leaves the fields unchanged
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Design settled by an architect arena (three candidates on Opus, Fable, Sonnet; cross-judge on Fable). Base: candidate 2. Full design and grafts: scratchpad arena-task75/final/{sketch.ts,rationale.md,synthesis.md} (copied into the PR description on delivery).

1. Core: landmark trace gains optional `sign {name, line, source: pending|seed|model}` beside the unchanged `named`; `wordsOf(site) = named ?? sign` drives solid, look, bubble, offer, map and admin. `seedSign` from the world seed. `settle` fills a missing sign (legacy named rows keep their post; legacy unnamed rows get a post from `signpostSpot(place, area)` on the live place, or stay unposted with the manual naming path). Actions: name (anyone, in the area or within reach; refuses a no-op), restore (drops `named`).
2. Server: `textWriter` with one serial queue per kind and a Scribe per kind (epitaph, landmark); `createSuggester` server-wide limiter (6 per 5 min) plus one in flight per user, calls the model directly; socket `{t:suggest, n}` answered by `{t:suggestion, n, suggestion}`; `screen.suggestions` flag; `unstuck` on resume.
3. Client: dialog Rename, regenerate button with loading state, request numbers, refill untouched fields when the sign changes, Restore; bubble Rename for all and Report only on others' player words.
4. Admin `pnpm names` lists sign and name, restores, pins seed text.
5. Docs: README text generation, doc-1, decision log entry for the rename rule.
6. Tests: core parse-compat rows, settle cases, apply rules; server filter, writer, suggester, play; web bubbles and dialog; e2e with an OpenAI-compatible stub server.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Units landed on feat/task-75-landmark-names: core sign model (sign beside named, wordsOf, seedSign, settle fills a missing sign, anyone renames/restores); unstuck on resume; textWriter with per-kind queues and Scribe<T> (typed by trace, not kind: TS measures Scribe<K> invariant through Extract), landmarkScribe, cleanSign, signPrompt, describeScreen. Scribe.pending(place) became waiting(trace) so the writer owns the re-read check.

Client (dialog with Suggest a name, request numbers, refill of untouched fields, Use the land's name; bubble Rename for anyone), admin (pnpm names --restore/--reseed, map shows every landmark's current name), e2e (llm-stub OpenAI-compatible stub as a second webServer; landmarks.spec rewritten, 2 tests) and docs (README, doc-1, doc-2 D26) committed. Full e2e: 37/38 pass; the one failure was wake.spec 'coming back after the timeout' racing window.exploreState (unrelated; passed 3/3 on repeat).

PR https://github.com/geekitycom/explore/pull/9 (base main: lane A PRs #3-#7 had merged and fix/task-74-live-socket-auth was deleted, so origin/main was merged in without rewriting; the merge changed no files). Head a3b2da8. Gates: lint, format:check, typecheck, test (1048 + 1 perf) pass; pnpm e2e 38/38. e2e fixes for this change: epitaph spec now asserts only the grave's words before facing it; landmark spec faces the post before acting. Pre-existing flakes seen: touch.spec rock pickup (1/6 on base), wake.spec exploreState race.

Merged as PR #9 (9ba9dd8). Checked on origin/main 9ba9dd8: lint, typecheck and unit tests pass (1048 + 1 perf). landmarks.spec (2 tests) and epitaphs.spec pass in e2e. Rename rule recorded as D26: anyone admitted to the world may rename or restore. Suggestions are limited to 6 per player per 5 minutes, with 1 in flight at a time.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every landmark now has the land's own name and line from its first visit. The text comes from the world seed at once, and the model rewrites it once, off the screen-generation path, when LLM_* is set. Anyone admitted to the world can rename a landmark, fill the dialog with a model-suggested name (rate limited, with a loading state and an error message on failure), or restore the land's name. Credits: the land's words have no byline; a saved name reads 'named by <player>'. Names that players chose before this change keep their names. pnpm names lists, restores and reseeds names. README, doc-1 and D26 are updated. Verified on merged main (9ba9dd8): lint, typecheck and 1048 unit tests pass; the e2e landmark specs, run against a stub model, pass.
<!-- SECTION:FINAL_SUMMARY:END -->
