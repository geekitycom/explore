---
id: TASK-40
title: Trust a reverse proxy's client address for rate limits
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 13:40'
updated_date: '2026-09-25 14:02'
labels: []
milestone: m-1
dependencies: []
priority: low
type: enhancement
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Auth rate limits (TASK-11) key per-address buckets on the TCP peer address from @hono/node-server getConnInfo. Behind a reverse proxy every player shares the proxy's address, so 30 logins or 20 signups across all players would throttle everyone. When the deployment puts a proxy in front, add an opt-in setting (for example TRUST_PROXY) that reads the client address from X-Forwarded-For, taking the entry added by the trusted proxy rather than the spoofable leftmost one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With the setting off, X-Forwarded-For is ignored for rate limits
- [x] #2 With the setting on, per-address limits key on the client address the trusted proxy reports
- [x] #3 Integration tests cover both modes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add trustProxy?: boolean (default false) to createApp options in apps/server/src/app.ts. 2. Resolve the rate-limit key via a small clientAddress(c) helper: when trustProxy is on, use the rightmost entry of X-Forwarded-For (trimmed) when present; otherwise (or when off) fall back to getConnInfo(c).remote.address. 3. Parse TRUST_PROXY once in apps/server/src/main.ts (process.env.TRUST_PROXY === 'true'), matching the existing secureCookies pattern, and pass it to createApp. 4. Document TRUST_PROXY in README.md next to the production-run instructions, alongside where DB_PATH is documented. 5. Add integration tests in apps/server/src/app.test.ts: proxy off ignores X-Forwarded-For (shared bucket by real remote address); proxy on keys per the rightmost X-Forwarded-For entry and ignores a spoofed leftmost entry. 6. Run pnpm lint, pnpm typecheck, pnpm test, pnpm format:check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with pnpm test (219 tests pass), including the two new app.test.ts cases: 'ignores X-Forwarded-For when trustProxy is off' and 'trust proxy > keys the limit on the rightmost X-Forwarded-For entry, not a spoofed leftmost one'. Also ran pnpm lint, pnpm typecheck, pnpm format:check, all clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an opt-in trustProxy option to createApp (apps/server/src/app.ts), parsed once from TRUST_PROXY in apps/server/src/main.ts. When on, rate-limit keys come from the rightmost X-Forwarded-For entry (the one the trusted proxy appended); when off, the header is ignored and the TCP peer address is used as before. Documented TRUST_PROXY in README.md next to the production-run instructions. Added integration tests in apps/server/src/app.test.ts covering both modes.
<!-- SECTION:FINAL_SUMMARY:END -->
