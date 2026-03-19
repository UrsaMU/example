# Harm & Corruption

## Harm

Your harm track has **5 boxes**. When you take harm, boxes fill from left to
right. At 5 harm you are **incapacitated** and an MC job is filed automatically.

```
+harm                       view your harm track, armor, and corruption
+harm/mark                  mark 1 harm on yourself
+harm/mark <player>         mark 1 harm on another (MC/staff)
+harm/heal                  heal 1 harm box
+harm/heal <n>              heal n harm boxes
+harm/heal <n> <player>     heal another player (MC/staff)
+harm/armor <0-3>           set your armor value
```

**Armor** reduces incoming harm. Set it when you gain or lose protective gear
or abilities. Valid values: 0 (none), 1, 2, 3 (heavy).

## Corruption

Your corruption track has **5 marks**. When it fills, you must take a
Corruption advance to reset it to 0. Corruption advances are permanent and
cumulative — they change who your character is.

```
+corruption/mark                mark 1 corruption on yourself
+corruption/mark <player>       mark 1 corruption on another (MC/staff)
+corruption/take <advance>      record a corruption advance, reset marks to 0
```

To see what Corruption advances are available for your playbook, check your
playbook sheet (`+chargen`) or the game text.

## Staff

```
+corruption/clear              clear all corruption marks (no advance taken)
+corruption/clear <player>     clear another player's marks
```
