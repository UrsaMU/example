# Organizations — Urban Shadows

The orgs system is a city-level faction roster. Staff creates and describes the
organizations that populate the city's four circles. Public entries are visible
to all players; hidden ones are staff-only until revealed.

## Finding an Organization

All commands that take `<name>` accept:

- The start of the organization's name (case-insensitive)
- The first 8+ characters of its ID (shown in brackets)

## Commands

### +org/list [circle]

List organizations. Players see public ones; staff sees all. Optionally filter
by circle: mortalis, night, power, or wild.

    +org/list
    +org/list night
    +org/list power

### +org/view \<name\>

View an organization's public details. Staff also sees private notes.

    +org/view Spire
    +org/view constab

### +org/create \<circle\>=\<name\> [staff]

Create a new organization. Starts hidden (not visible to players).

    +org/create night=The Spire
    +org/create mortalis=The Constabulary

### +org/desc \<name\>=\<text\> [staff]

Set the public description players see when they view the org.

    +org/desc Spire=The dominant vampire court, ruled by the ancient Aelindra.

### +org/note \<name\>=\<text\> [staff]

Set private staff-only notes (plot hooks, current plans, etc.). Leave blank to
clear.

    +org/note Spire=Planning a coup — three sub-factions are moving.
    +org/note Spire=

### +org/toggle \<name\> [staff]

Toggle between public (visible to players) and hidden.

    +org/toggle Spire

### +org/del \<name\> [staff]

Permanently delete the organization.

    +org/del Spire

---

## Quick Reference

| What you want to do          | Command                       |
| ---------------------------- | ----------------------------- |
| List organizations           | `+org/list [circle]`          |
| View one org                 | `+org/view <name>`            |
| Create an org [staff]        | `+org/create <circle>=<name>` |
| Set description [staff]      | `+org/desc <name>=<text>`     |
| Set staff notes [staff]      | `+org/note <name>=<text>`     |
| Toggle public/hidden [staff] | `+org/toggle <name>`          |
| Delete an org [staff]        | `+org/del <name>`             |
