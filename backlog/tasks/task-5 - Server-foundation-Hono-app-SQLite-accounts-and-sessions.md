---
id: TASK-5
title: 'Server foundation: Hono app, SQLite, accounts, and sessions'
status: To Do
assignee: []
created_date: '2026-09-24 21:29'
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
- [ ] #1 Signup creates a user with an avatar and a session cookie; duplicate usernames (case-insensitive) are rejected
- [ ] #2 Login succeeds with the right password and fails with a wrong one without revealing which part was wrong
- [ ] #3 Logout invalidates the session server-side
- [ ] #4 Passwords are stored only as scrypt hashes; session tokens only as SHA-256 hashes
- [ ] #5 Integration tests cover the auth endpoints against a real SQLite database
<!-- AC:END -->
