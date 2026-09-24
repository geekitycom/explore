---
id: TASK-7
title: 'Web client: signup, login, and avatar creator'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:43'
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
- [ ] #1 A new visitor can sign up, design an avatar with a live animated preview, and enter the game
- [ ] #2 A returning visitor can log in and log out
- [ ] #3 Validation errors from the server are shown inline
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. api.ts: typed fetch wrappers for /api/me, signup, login, logout, avatar; server errors surface as ApiError with code, message, field.
2. app.ts: a single view state (loading | auth(login|signup) | game) rendered into #app; no framework.
3. ui/auth.ts: login and signup forms with inline field errors from the server.
4. ui/avatar-picker.ts: hair style and palette swatches driving a live animated preview canvas (uses the art pipeline's avatarSheet once task-4 lands).
5. Pixel-styled CSS. Verify in a real browser against the running server.
<!-- SECTION:PLAN:END -->
