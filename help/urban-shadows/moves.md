# Moves

Moves are the core resolution mechanic. When your character does something that
triggers a move, you roll 2d6 + the listed stat.

- **10+** — Strong hit. You do it and choose the best outcome.
- **7–9** — Weak hit. You do it, but with a cost, complication, or hard choice.
- **6−** — Miss. The MC makes a move. Things get worse.

## Your moves

```
+moves
```

Lists every move on your character sheet with its stat and a brief description.

## Trigger a move

```
+move <name or id>
+move <name or id> +1
+move <name or id> -1
```

Looks up the move by partial name (e.g. `+move lion's den`) or exact ID (e.g.
`+move aware-the-lions-den`). Reads your stat from your sheet, rolls 2d6+stat,
and broadcasts the result and full move text to the room.

Add a bonus or penalty after the move name if a move or situation grants one.

## Read a move without rolling

```
+move/ref <name or id>
```

Shows the full text of any move across all playbooks without triggering a roll.
No approved character required — useful for rules-checking mid-scene.

## Browse all moves

```
+moves/all
+moves/all <playbook>
```

Without an argument, lists all playbooks. With a playbook name or ID, shows
every move for that playbook with full descriptions. Useful when picking a
cross-playbook move via advancement.

## Roll a stat directly

```
+roll <stat>
+roll <stat> +1
```

Rolls 2d6 + your sheet stat without invoking a specific move. Stats are:
**blood**, **heart**, **mind**, **spirit**.

## Examples

```
+move i know a guy
+move lion's den +1
+move aware-charming-not-sincere
+move/ref enthrall
+moves/all The Fae
+roll blood
+roll heart +1
```
