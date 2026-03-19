# Advancement

## XP

Your XP track goes from 0 to 5. At 5 XP you may take an advance.

```
+xp                         view your XP and all advances taken
+xp/mark                    mark 1 XP on yourself
+xp/mark <player>           mark 1 XP on another player (staff)
```

## Advances

```
+advance                    list all available advances with their IDs
+advance/take <id>          spend 5 XP to take an advance
```

Taking an advance resets your XP to 0. Some advances can be taken more than
once (up to their listed limit).

### Standard advances (available to all playbooks)

| ID               | Advance                                     | Limit |
|------------------|---------------------------------------------|-------|
| `stat-blood`     | +1 Blood (max +2)                           | 2×    |
| `stat-heart`     | +1 Heart (max +2)                           | 2×    |
| `stat-mind`      | +1 Mind (max +2)                            | 2×    |
| `stat-spirit`    | +1 Spirit (max +2)                          | 2×    |
| `move-own-1`     | Take another move from your playbook        | 1×    |
| `move-own-2`     | Take another move from your playbook        | 1×    |
| `move-other-1`   | Take a move from another playbook           | 1×    |
| `move-other-2`   | Take a move from a different playbook       | 1×    |
| `circle-rating`  | Improve a circle rating by +1               | 2×    |
| `clear-corruption` | Remove a Corruption mark                  | 3×    |
| `corruption-adv` | Take a Corruption advance                   | 5×    |

### Major advances (require 5+ regular advances first)

| ID               | Advance                                     |
|------------------|---------------------------------------------|
| `retire`         | Retire your character to safety             |
| `change-playbook`| Change your playbook                        |
| `move-any`       | Take a move from any playbook               |

Major advances file an MC job for coordination.

## Staff

```
+advance/xp <player>=<amount>    set a player's XP directly
```
