---
id: TASK-74
title: Live sockets outlive logout and world closure
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:12'
updated_date: '2026-09-27 16:06'
labels:
  - server
  - client
  - security
  - auth
dependencies: []
references:
  - apps/server/src/app.ts
  - apps/server/src/host.ts
  - apps/server/src/worlds.ts
  - apps/web/src/game/net.ts
priority: medium
type: bug
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The session and visitor access are checked only when the WebSocket upgrades (`/ws/worlds/:id` in `apps/server/src/app.ts`), never again for a live socket.

- `POST /api/logout` deletes the session row but does not close sockets already open on that session (another tab or device keeps playing).
- When a revoked socket later reconnects, the upgrade fails with HTTP 401 before `onOpen`. The browser sees only close code 1006, which is not a terminal code in `apps/web/src/game/net.ts`, so the client retries forever showing "Reconnecting…" with no way back to the login screen.
- Visitor admission is computed at upgrade and used later in `onOpen`. If the owner closes the world to visitors, or it idles out, in between, `host.connect` admits the visitor anyway and `sendVisitorsHome` never reaches them.

The WS route also re-implements `requireWorld` inline.

Found by the multi-model architecture review (2026-09-27), Opus and Fable reviewers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Logging out closes every socket opened with that session
- [x] #2 A client whose session is gone ends up on the login screen instead of retrying forever
- [ ] #3 A visitor whose world closed to visitors between upgrade and open is not admitted
- [ ] #4 Tests cover logout with a second open socket, reconnect with a revoked session, and the close-before-open visitor race
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Failing tests: a socket without a valid session (none, forged, logged out) must open then close with a signed-out code instead of failing the upgrade (1006); logout closes every socket of that session in every world and leaves another session's socket open; e2e: logging out from another tab sends a playing tab to the login screen.
2. Server: add SIGNED_OUT_CLOSE_CODE (4401) to core protocol.ts. Move the session and admission checks on /ws/worlds/:id from the upgrade into onOpen, sharing one door function with requireWorld. Track open sockets by session token; logout closes them with the signed-out code.
3. Client: net.ts treats the signed-out code as terminal ('signedOut'); main.ts shows the login screen on it.
4. Visitor race (AC #3): probe showed onOpen runs before any macrotask after the upgrade handler (upgrade, open, then setImmediate/setTimeout), so no request or sweep can close the world in between with @hono/node-ws 1.3.1. Admission now runs in onOpen right before host.connect anyway.
5. Gates plus full pnpm e2e under the lock.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR https://github.com/geekitycom/explore/pull/6 (fix/task-74-live-socket-auth @ 7a0d27e, base fix/task-73-login-throttle). Checks moved to onOpen; logout closes that session's sockets with 4401; client shows login on 4401. AC #3 race did not reproduce (onOpen runs before any macrotask after the upgrade); admission now runs in onOpen anyway, no race test. Gates green; full e2e 36/36 at tip. Pre-existing flake: touch.spec.ts iPad fails on main too.

Verified: sockets without a valid session (none, forged, logged out) now open and close with 4401 instead of 1006; logout closes every socket of that session and no other; e2e "logging out in another tab sends this one to the login screen" red then green. AC 3 and the race part of AC 4 are not checked: a timing probe (reverted) showed onOpen runs before any macrotask with @hono/node-ws 1.3.1, so no window exists to test; admission now runs in onOpen immediately before host.connect regardless. PR #6 merged after merging main in to resolve the app.ts conflict with TASK-71 (both wrappers kept; 1017 unit tests pass).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Session and world admission are checked in onOpen, a missing session closes with 4401 and the client goes to login, and logout closes that session sockets. Verified by red-then-green app and e2e tests; the upgrade-to-open visitor race could not be reproduced (probe evidence in notes), so AC 3 and 4 stay unchecked. Merged in PR #6.
<!-- SECTION:FINAL_SUMMARY:END -->
