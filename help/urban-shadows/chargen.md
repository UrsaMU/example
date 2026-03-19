# Character Creation

Character creation (chargen) is a multi-step process. Use `+chargen` at any
point to see your current sheet and a checklist of what's left to do.

## Steps

### 1. Choose a playbook

```
+chargen/start
+chargen/start <playbook>
```

Run `+chargen/start` with no argument to see all 12 playbooks. Once you pick
one, your base stats and circle ratings are set automatically.

### 2. Set your name, look, and demeanor

```
+chargen/name <name>
+chargen/look <appearance>
+chargen/demeanor <demeanor>
```

Your playbook lists available demeanors — use `+chargen` to see them.

### 3. Apply your stat and circle boosts

```
+chargen/stat <blood|heart|mind|spirit>
+chargen/circle <mortalis|night|power|wild>
```

Each character gets one free +1 to any stat and one free +1 to any circle rating
at chargen, stacking on top of your playbook's base values.

### 4. Select your moves

```
+chargen/moves            (list available moves with full text)
+chargen/move <id>        (toggle a move on or off)
```

Your playbook specifies how many moves to pick. Move IDs look like
`aware-i-know-a-guy`.

### 5. Set your starting gear

```
+chargen/gear <item, item, ...>
```

Enter your gear as a comma-separated list.

### 6. Answer intro questions

```
+chargen/answer                       (list questions)
+chargen/answer <#>=<your answer>     (answer one by number)
```

### 7. Record starting debts

```
+chargen/debt/add <name>=<description>    (debt owed TO you)
+chargen/debt/owe <name>=<description>    (debt you OWE)
+chargen/debt/del <number>                (remove one by number)
```

### 8. Submit for approval

```
+chargen/submit
```

Your sheet enters a **pending** state. Staff will review and approve or reject
it. You cannot edit while pending.

## Other commands

- `+chargen/notes <text>` — add freeform notes to your sheet
- `+chargen/reset` — **permanently delete** your sheet and start over

## Staff

- `+chargen/list` — list all sheets
- `+chargen/review <player>` — view a player's sheet
- `+chargen/approve <player>` — approve a sheet
- `+chargen/reject <player>=<reason>` — reject with feedback
