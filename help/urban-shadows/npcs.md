# NPCs — Urban Shadows

The NPC tracker lets staff create and manage named NPCs with harm tracks, armor,
circle affiliations, and free-text notes. All commands are staff-only.

## Finding an NPC

All commands that take `<name>` accept either:

- The start of the NPC's name (case-insensitive, e.g. `ghost` matches `Ghost`)
- The first 8+ characters of the NPC's ID (shown in brackets in listings)

Multi-word names work: `+npc/harm Bloody Marcus` finds "Bloody Marcus".

---

## Commands

### +npc/create \<name\>

Create a new NPC with an empty harm track.

    +npc/create Ghost
    +npc/create Bloody Marcus

### +npc/list

List all tracked NPCs with harm bars and armor values.

    +npc/list

### +npc/view \<name\>

Display full details for one NPC: harm, armor, circle, notes, and ID.

    +npc/view Ghost

### +npc/harm \<name\>

Mark 1 harm on the NPC. Reports INCAPACITATED when the track fills.

    +npc/harm Ghost

### +npc/heal \<name\> [n]

Heal _n_ harm boxes (default 1). Clears the earliest marked boxes first.

    +npc/heal Ghost
    +npc/heal Ghost 3

### +npc/armor \<name\>=\<0-3\>

Set the NPC's armor rating (0–3).

    +npc/armor Ghost=2

### +npc/circle \<name\>=\<circle\>

Tag the NPC with a circle affiliation. Leave the value empty to clear it.

    +npc/circle Ghost=night
    +npc/circle Ghost=

### +npc/note \<name\>=\<text\>

Set free-text notes on the NPC. Leave empty to clear.

    +npc/note Ghost=Wears a long coat. Owes Miriam a debt.
    +npc/note Ghost=

### +npc/del \<name\>

Permanently delete the NPC record.

    +npc/del Ghost

---

## Quick Reference

| What you want to do    | Command                       |
| ---------------------- | ----------------------------- |
| Create an NPC          | `+npc/create <name>`          |
| See all NPCs           | `+npc/list`                   |
| See one NPC's details  | `+npc/view <name>`            |
| Mark 1 harm            | `+npc/harm <name>`            |
| Heal harm boxes        | `+npc/heal <name> [n]`        |
| Set armor              | `+npc/armor <name>=<0-3>`     |
| Set circle affiliation | `+npc/circle <name>=<circle>` |
| Add/update notes       | `+npc/note <name>=<text>`     |
| Delete an NPC          | `+npc/del <name>`             |
