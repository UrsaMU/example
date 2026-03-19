# Downtime — Urban Shadows

Downtime happens between sessions. The MC opens a downtime period; players
submit what their characters are doing; the MC resolves each action with
narrative and (if applicable) mechanical effects via other commands.

## Downtime Action Types

| Type           | Meaning                                 |
| -------------- | --------------------------------------- |
| `recover`      | Rest and heal harm                      |
| `indulge`      | Indulge your vice to clear corruption   |
| `consolidate`  | Shore up circle status or relationships |
| `work-contact` | Work a contact for favors or info       |
| `pursue-lead`  | Follow a lead or investigate something  |
| `other`        | Anything else (describe in full)        |

Use `+downtime/types` to see the full list with descriptions in-game.

## Commands

### +downtime

View the current downtime period and your submitted actions.

    +downtime

### +downtime/types

List available action types with descriptions.

    +downtime/types

### +downtime/submit \<type\>=\<description\>

Submit a downtime action. The type must be one of the valid types above.

    +downtime/submit recover=Lying low at Maria's place, stitching up the wound.
    +downtime/submit work-contact=Calling in a favor with the Spire's door staff.
    +downtime/submit other=Looking for Ghost's sister.

### +downtime/view \<id\>

View the full details of a submitted action, including MC resolution if set. The
ID is the short hex prefix shown in listings.

    +downtime/view a3b2f1

---

## Staff Commands

### +downtime/open [label]

Open a new downtime period. Only one can be open at a time.

    +downtime/open Between Session 4 and 5
    +downtime/open

### +downtime/list

List all submitted actions in the current period with status.

    +downtime/list

### +downtime/resolve \<id\>=\<resolution\>

Mark an action as resolved and record the narrative outcome.

    +downtime/resolve a3b2f1=You patch yourself up. Clear 2 harm boxes.

### +downtime/close

Close the current downtime period (warns about unresolved actions).

    +downtime/close

---

## Quick Reference

| What you want to do           | Command                                 |
| ----------------------------- | --------------------------------------- |
| See current downtime period   | `+downtime`                             |
| List action types             | `+downtime/types`                       |
| Submit an action              | `+downtime/submit <type>=<description>` |
| View an action's full details | `+downtime/view <id>`                   |
| Open a period [staff]         | `+downtime/open [label]`                |
| List all actions [staff]      | `+downtime/list`                        |
| Resolve an action [staff]     | `+downtime/resolve <id>=<resolution>`   |
| Close period [staff]          | `+downtime/close`                       |
