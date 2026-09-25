---
id: TASK-5
title: 'Server foundation: Hono app, SQLite, accounts, and sessions'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:39'
labels: []
milestone: m-0
dependencies:
  - TASK-1
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hono server on Node with node:sqlite migrations, username/password signup and login, cookie sessions, and serving the built web client. See decision-2, decision-3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Signup creates a user with an avatar and a session cookie; duplicate usernames (case-insensitive) are rejected
- [x] #2 Login succeeds with the right password and fails with a wrong one without revealing which part was wrong
- [x] #3 Logout invalidates the session server-side
- [x] #4 Passwords are stored only as scrypt hashes; session tokens only as SHA-256 hashes
- [x] #5 Integration tests cover the auth endpoints against a real SQLite database
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent in an isolated worktree; reviewed and cherry-picked onto main. Modules: db.ts (ordered migrations on PRAGMA user_version, WAL, foreign keys), password.ts (scrypt), sessions.ts (hashed tokens, sessionUser for WS upgrade reuse), users.ts (repository), app.ts (createApp with zod at the boundary, JSON errors), main.ts (DB_PATH, static web dist with SPA fallback).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions: unknown usernames still run one scrypt against a cached decoy hash so timing does not reveal existing usernames. Login body only caps lengths so any bad credential yields the same 401. Username conflicts use INSERT ... ON CONFLICT DO NOTHING RETURNING. Secure cookie flag is a createApp option set from NODE_ENV=production. Expired sessions are purged when a session is created. Timestamps are epoch ms INTEGER. scrypt N=2^15 needs maxmem raised to 256MB; params are stored per hash so they can change without a migration. /api/* has a JSON 404 so API typos never fall through to index.html.
Verification: 24 server integration tests against real SQLite (in-memory and a temp file); live curl run of signup, duplicate, me, avatar update, logout, wrong password vs unknown user, case-insensitive login, SPA fallback. Mutation check (verifyPassword always true) fails 2 tests as expected.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Hono server foundation: SQLite migrations, username/password accounts with scrypt, hashed cookie sessions, /api/signup, /api/login, /api/logout, /api/me, /api/me/avatar, and static serving of the web client. Verified with 24 integration tests, a live curl session against the real process, and a mutation check on password verification.
<!-- SECTION:FINAL_SUMMARY:END -->
