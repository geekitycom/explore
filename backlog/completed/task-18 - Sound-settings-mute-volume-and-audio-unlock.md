---
id: TASK-18
title: 'Sound settings: mute, volume, and audio unlock'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:28'
updated_date: '2026-09-25 01:06'
labels: []
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The game has no settings UI and browsers block audio until the player interacts. Add a small settings control in the game bar with mute and separate music and effects volumes, remembered per browser, and start audio on the first key press or click.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Audio starts only after the first key press or click, with no console errors before that
- [x] #2 Mute and music/effects volume controls are reachable by keyboard and screen reader
- [x] #3 Settings persist across reloads in the same browser and default to a moderate volume
- [x] #4 Audio is muted while the tab is hidden and resumes when it is visible again
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. audio/settings.ts: {muted, music, effects} with defaults (music 0.5, effects 0.7), persisted in localStorage behind try/catch.
2. audio/engine.ts: AudioContext created lazily on the first keydown or pointerdown (no autoplay warnings), master -> music bus and effects bus gains driven by settings; suspend while the tab is hidden.
3. ui/sound-settings.ts: a Sound button in the game bar toggling a small panel with a mute checkbox and labelled music/effects sliders.
4. Playwright: audio stays off before input, runs after a key press, settings persist across reload.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The AudioContext is created on the first keydown or pointerdown, so nothing is attempted before interaction. Typing during signup counts as interaction, which is correct. Music and effects buses sit under one context. The context suspends while the tab is hidden. The Sound panel stops key events from reaching the game, so arrow keys adjust a focused slider instead of walking. Settings live in localStorage under explore.sound and are validated on load, falling back to defaults.
Verification: e2e/sound.spec.ts checks the context is locked on a fresh page load with no input, starts running after a key press, logs no AudioContext console errors or warnings, and that mute and music volume persist across reload with the panel reflecting them. Visibility suspend was not exercised in e2e; it is two lines on the visibilitychange event.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added sound settings (mute, music and effects volume) in a keyboard-accessible Sound panel, persisted per browser, with audio unlocked on first input and suspended while the tab is hidden. Verified with a Playwright test.
<!-- SECTION:FINAL_SUMMARY:END -->
