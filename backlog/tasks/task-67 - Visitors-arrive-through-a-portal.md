---
id: TASK-67
title: Visitors arrive and leave through a portal
status: To Do
assignee: []
created_date: '2026-09-26 15:56'
updated_date: '2026-09-26 15:57'
labels: []
dependencies:
  - TASK-64.3
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Visitors come and go through a portal instead of simply appearing and vanishing.

Arriving: a small glowing dot appears in the secret garden and opens into a swirling, animated portal. The visitor appears standing in front of it, the portal closes behind them, and the friend is there.

Leaving: when a visitor goes home, or is sent home because the host closed their world, a portal opens next to them, they step into it and disappear, and it closes. Wherever the visitor lands next (their own world), they arrive the same way they normally would there.

Everyone on the screen sees the portal, including the visitor. The portal has a sound: a rising and falling, wheezing, groaning whoosh in the spirit of the TARDIS, made with the game's own synth (D18) rather than a recording, because the real TARDIS sound is the BBC's.

The portal is drawn in code like the rest of the scenery (D21), not taken from an art pack. Arrival placement comes from TASK-64.3 (a random free tile in the garden); the portal needs that tile plus the spot it opens on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When a visitor joins, everyone on the garden screen sees a glowing dot open into a swirling portal, the visitor appear in front of it, and the portal close
- [ ] #2 The visitor sees their own arrival the same way
- [ ] #3 The portal and the arrival tile are both on walkable garden tiles that no player is standing on
- [ ] #4 The visitor cannot move until the portal has finished opening and they have appeared, and the whole sequence takes about two seconds
- [ ] #5 With reduced motion on, the portal fades in and out without the swirl
- [ ] #6 The portal is drawn from code in the game's own visual language (D21) and matches the pixel scale of the garden
- [ ] #7 A visitor who goes home, or is sent home when the host closes their world, leaves through a portal that everyone on their screen sees open, take them, and close
- [ ] #8 The portal plays a wheezing, rising and falling whoosh made with the game's synth when it opens for an arrival or a departure; it follows the sound settings and is silent when sound is off
<!-- AC:END -->
