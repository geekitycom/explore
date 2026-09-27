---
id: m-6
title: "M7: Reliable tests"
---

## Description

A red CI run means a real regression again. Today about four in ten CI runs on main fail e2e on specs the change never touched, and every failure seen so far traced to a test race, not the game. This milestone removes those causes, moves most behaviour checks into server integration tests that already run 1000+ tests without flakes, and keeps e2e for what needs a real browser.
