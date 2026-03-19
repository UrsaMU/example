# Circles & Factions

## Circles

The four circles represent your standing with the city's major supernatural
communities. Status runs from **−3** (hostile/shunned) to **+3** (trusted/
respected).

| Circle   | Who they are                              |
| -------- | ----------------------------------------- |
| Mortalis | Ordinary humans, mortal institutions      |
| Night    | Vampires, the undead, creatures of night  |
| Power    | Sorcerers, mages, wielders of arcane arts |
| Wild     | Fae, spirits, the untamed supernatural    |

```
+circles                            view all circle status and factions
+circles/improve <circle>           +1 status (max +3)
+circles/mark <circle>              −1 status (min −3)
```

Moves and MC calls will prompt you to mark or improve circles. Spending circle
status (marking) represents burning goodwill; earning it back requires effort.

## Factions

Factions are specific groups within a circle — particular vampire courts, mage
cabals, mortal agencies, etc. Track obligations and history here.

```
+factions                           list all faction affiliations
+faction/add <circle>=<name>        add a new faction
+faction/note <id>=<notes>          update notes (obligations, history)
+faction/del <id>                   remove a faction
```

The ID shown in `+factions` is used for note updates and deletion.

## Examples

```
+circles/mark night
+circles/improve mortalis
+faction/add night=The Undying Court
+faction/note 2=They want eyes on the Meridian Building
```

## Staff

```
+circles/set <circle>=<value> [<player>]    set status to exact value
+circles/mark <circle> <player>             mark another player's circle
+circles/improve <circle> <player>          improve another player's circle
```
