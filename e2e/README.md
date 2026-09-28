# End-to-end smoke paths

The e2e suite drives the built client against a real server in Chrome and an emulated iPad. It
keeps only what needs a real browser: rendering and layout, DOM dialogs, pointer and touch input,
audio, and the client's reaction to the server. Run it with `pnpm e2e`; set `E2E_PORT` to run two
checkouts at once.

Game rules and server behaviour are tested without a browser:

- `apps/server/src/play.test.ts` drives the game through real HTTP and websocket handling: movement,
  travel, traces and cairns, landmarks, the map, visitors, sessions and waking.
- `apps/server/src/app.test.ts` covers the HTTP routes: signup, login, validation, throttling,
  profiles.
- `packages/core` tests cover world generation, routes, items and epitaphs.
- `apps/web` unit tests cover client logic: game state, hint timing, walk intent, bubble placement,
  map layout, the naming dialog, the travel timeout.

A new e2e test earns its place only when one of those cannot check it.

| Spec      | Smoke path                                                             | Why it needs a browser                                         |
| --------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| ambience  | the garden moves by itself                                             | canvas pixels change over time                                 |
| ambience  | reduced motion holds the world still                                   | the `prefers-reduced-motion` media query freezes the canvas    |
| auth      | a logged-out visitor lands on login, on the site and on /map           | the client's routing and login screen                          |
| auth      | the create-account screen catches a mistyped password                  | a client-side form error, with no request sent                 |
| auth      | a new player gets the avatar step until they choose one                | the signup screens and the client's routing to the avatar step |
| auth      | server errors appear next to their field                               | where the form renders each error                              |
| auth      | logging out in another tab sends this one to login                     | the client's reaction to a socket closed with code 4401        |
| avatar    | a player renames and restyles from the Name & avatar dialog            | the dialog and the game bar update without a reconnect         |
| landmarks | a landmark carries a name; anyone may rename it or put it back         | the rename dialog, its counters and alert, the bubble's box    |
| map       | the map link goes there and back; a logged-out visitor logs in first   | client routing between the game and /map                       |
| map       | the map opens over the game, keeping the music and the connection      | the overlay, keyboard focus, audio and the one websocket       |
| map       | the map opens on you at one size, however big the window               | canvas sizing on resize, and that no input pans or zooms it    |
| mouse     | a mouse wakes the player and walks them while held                     | real pointer events on the canvas                              |
| mouse     | a double-click walks off the east edge with no server corrections      | pointer input driving a routed walk end to end                 |
| sound     | music and ambience wait for input, follow the world, settings persist  | Web Audio unlocking, and the Sound panel across a reload       |
| sound     | ambience plays on the effects bus and obeys mute and volume            | the audio graph's output level                                 |
| traces    | the inventory bar and the hint bar frame the world                     | layout on a desktop and a 360 px phone                         |
| traces    | the inventory bar takes its colours from the biome                     | computed CSS colours                                           |
| visitors  | a friend joins with the code, goes home, is sent home when it closes   | the Friends dialog, the notice and Go home across two browsers |
| wake      | a new session opens its eyes on the garden and holds still until Space | the eye animation and keys ignored until it ends               |
| wake      | with reduced motion the dark fades                                     | the reduced-motion animation                                   |
| touch     | a player on an iPad plays by touch alone                               | touch input on an emulated iPad                                |
| touch     | the game fits an iPad in portrait and landscape                        | layout at iPad sizes with no scrolling                         |
