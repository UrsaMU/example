# Scene — Urban Shadows

The scene system lets the MC frame the current location with a description that
players can read at any time. Each room holds one scene. When the MC sets a
scene it broadcasts to everyone in the room.

## Commands

### +scene

View the current scene description.

    +scene

### +scene/set \<description\>

[Staff] Set (or replace) the scene description for the current room. Broadcasts
to the room immediately.

    +scene/set The rain hammers the neon-lit alley. Garbage cans flicker shadows.

### +scene/title \<text\>

[Staff] Set a short title line that appears above the description. Requires a
scene to be set first.

    +scene/title The Copper Hook — Back Alley

### +scene/clear

[Staff] Clear the current scene description.

    +scene/clear

---

## Quick Reference

| What you want to do     | Command                    |
| ----------------------- | -------------------------- |
| Read the current scene  | `+scene`                   |
| Set a scene description | `+scene/set <description>` |
| Set a scene title       | `+scene/title <text>`      |
| Clear the scene         | `+scene/clear`             |
