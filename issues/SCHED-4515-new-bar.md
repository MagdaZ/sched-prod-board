---
id: SCHED-4515
title: List holds still; "N new" bar brings new incidents in
status: done
plan: R1, R4
---

Product's decision after the step-1 recording (00:25): with live insert at the top, a new incident moved every
row down under the pointer, and an Ack meant for INC-1441 acked INC-3305.

- The list holds still while it is on screen. A refresh updates rows already shown in place and never
  inserts or removes rows.
- New incidents wait behind a bar at the top (`data-testid="new-bar"`): "N new incidents · show".
  Clicking it brings them in, newest first.
- The bar keeps its space while hidden (`visibility`), so showing it does not move the rows.
- Ack stays on the row (`data-testid="ack"`, R2).

Acceptance: leave the board open; the top row does not change by itself and the bar shows the count;
click the bar and the new incidents are on top; an Ack lands on the row that was aimed at.
