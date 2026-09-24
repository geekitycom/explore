---
id: TASK-7
title: 'Web client: signup, login, and avatar creator'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 22:10'
labels: []
milestone: m-0
dependencies:
  - TASK-4
  - TASK-5
priority: medium
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser UI to create an account with an avatar, log in, log out, and edit the avatar. See decision-3, decision-4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A new visitor can sign up, design an avatar with a live animated preview, and enter the game
- [x] #2 A returning visitor can log in and log out
- [x] #3 Validation errors from the server are shown inline
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. api.ts: typed fetch wrappers for /api/me, signup, login, logout, avatar; server errors surface as ApiError with code, message, field.
2. app.ts: a single view state (loading | auth(login|signup) | game) rendered into #app; no framework.
3. ui/auth.ts: login and signup forms with inline field errors from the server.
4. ui/avatar-picker.ts: hair style and palette swatches driving a live animated preview canvas (uses the art pipeline's avatarSheet once task-4 lands).
5. Pixel-styled CSS. Verify in a real browser against the running server.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Preview now draws the recolored Ninja Adventure walk sheet via art avatarSheet and redraws immediately on each choice. Verified by Playwright (e2e/auth.spec.ts): signup with chosen hair color and shirt persisted to /api/me; case-insensitive login; reload keeps the session; inline field errors for short password and taken username; form-level error for bad credentials. The Chrome extension could not run scripts on the page (another extension blocked it), so browser verification uses Playwright against system Chrome instead. Editing the avatar after signup exists in the API (PUT /api/me/avatar) but has no UI yet.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the signup, login, and logout UI with a live animated avatar creator (hair style, hair, skin, shirt, pants), a typed API client, and inline server errors. Verified end to end with Playwright against the real server.
<!-- SECTION:FINAL_SUMMARY:END -->
