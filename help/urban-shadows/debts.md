# Debts

Debts are the social currency of Urban Shadows. They represent favors owed,
obligations incurred, and leverage held. When someone cashes in a Debt against
you, you must help them — or face the consequences of refusing.

## Commands

```
+debts                          list all your active debts
+debt/add <person>=<desc>       record a debt someone owes YOU
+debt/owe <person>=<desc>       record a debt YOU owe someone
+debt/cashin <id>               cash in a debt owed to you (marks it spent)
+debt/del <id>                  delete a debt record entirely
```

The `<id>` is the number shown in `+debts`.

## Examples

```
+debt/add Marcus=Covered his tracks at the Meridian Building
+debt/owe Carla=She got me out of lockup last Tuesday
+debt/cashin 3
+debt/del 2
```

## Starting debts vs. in-play debts

**Chargen debts** (set during character creation with `+chargen/debt/*`) are
narrative background. They appear on your sheet but are not the same records
as in-play debts tracked here.

**In-play debts** (this system) are created during actual play when moves or
fiction result in obligations.
