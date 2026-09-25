---
id: TASK-50.1
title: Trace storage and a slowly refilling allowance
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
labels: []
milestone: m-5
dependencies: []
parent_task_id: TASK-50
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The foundation for every kind of trace. Store traces per screen position, separate from the generated screen record, so the server sends them with a screen and every player on it sees changes live. Give each player a per-kind allowance that refills slowly (for example one sign a day, a few cairn stones a day), enforced on the server. The client shows how many of each the player has left and when the next one comes back. Limits live in one table so they are easy to tune.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Traces are stored apart from screen records, survive restarts, and reach every player on the screen without reconnecting
- [ ] #2 Each trace kind has a server-enforced allowance that refills over time; a request past it is refused with the time until the next one
- [ ] #3 The client shows the remaining allowance per kind and when it refills
- [ ] #4 Allowance values for every kind live in one table
- [ ] #5 Stored generator output is unchanged (D23), and a world wipe also clears traces
<!-- AC:END -->
