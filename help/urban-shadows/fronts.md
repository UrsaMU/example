# Fronts & Clocks — Urban Shadows

Fronts represent the MC's campaign threats: criminal empires, awakening horrors,
political schemes. Each front has a **doom clock** that ticks toward a terrible
consequence and a list of **grim portents** — the escalating signs that the
threat is advancing.

All commands are staff-only.

## Doom Clocks

A doom clock has 4, 6, or 8 segments. When the clock fills, **doom is reached**
and the threat resolves catastrophically. Use `+front/tick` to advance it and
`+front/untick` to pull it back. The clock display looks like:

    [████░░] 4/6

## Finding a Front

All commands that take `<name>` accept either:
- The start of the front's name (case-insensitive)
- The first 8+ characters of the front's ID (shown in brackets)

Most commands operate on **active** fronts only. Use `+front/view` or
`+front/list all` to work with resolved or abandoned fronts.

---

## Commands

### +front/create \<name\>

Create a new front with a 6-segment clock.

    +front/create The Court of Whispers

### +front/list [all]

List all active fronts with clocks and doom status. Add `all` to include
resolved and abandoned fronts.

    +front/list
    +front/list all

### +front/view \<name\>

Display full details: clock, description, and grim portents checklist.

    +front/view Court

### +front/desc \<name\>=\<text\>

Set the front's description.

    +front/desc Court=A vampire court consolidating power over the night.

### +front/clock \<name\>=\<4|6|8\>

Change the doom clock size. Existing ticks are clamped to the new size.

    +front/clock Court=8

### +front/tick \<name\> [n]

Advance the doom clock by *n* segments (default 1). Announces DOOM REACHED when
the clock fills.

    +front/tick Court
    +front/tick Court 2

### +front/untick \<name\>

Remove one tick from the doom clock (floor at 0).

    +front/untick Court

### +front/portent \<name\>=\<text\>

Add a grim portent to the front. Fronts support at most 8 portents. Portents
are numbered in the order added.

    +front/portent Court=The third blood feast is announced publicly.
    +front/portent Court=Bodies found drained in the Mortalis quarter.

### +front/trigger \<name\>=\<n\>

Mark grim portent #n as triggered (played out in the fiction).

    +front/trigger Court=1

### +front/resolve \<name\>

Mark the front as resolved (threat neutralised).

    +front/resolve Court

### +front/abandon \<name\>

Mark the front as abandoned (no longer tracked actively).

    +front/abandon Court

### +front/del \<name\>

Permanently delete the front record (searches all statuses).

    +front/del Court

---

## Quick Reference

| What you want to do            | Command                          |
|--------------------------------|----------------------------------|
| Create a front                 | `+front/create <name>`           |
| List active fronts             | `+front/list`                    |
| List all fronts                | `+front/list all`                |
| See full front details         | `+front/view <name>`             |
| Set description                | `+front/desc <name>=<text>`      |
| Change clock size              | `+front/clock <name>=<4\|6\|8>` |
| Advance clock                  | `+front/tick <name> [n]`         |
| Pull back clock                | `+front/untick <name>`           |
| Add grim portent               | `+front/portent <name>=<text>`   |
| Trigger portent #n             | `+front/trigger <name>=<n>`      |
| Resolve front                  | `+front/resolve <name>`          |
| Abandon front                  | `+front/abandon <name>`          |
| Delete front                   | `+front/del <name>`              |
