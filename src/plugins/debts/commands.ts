import { addCmd } from "ursamu/app";
import { dbojs } from "ursamu";
import { debts } from "./db.ts";
import type { IDebtRecord } from "./schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function debtLine(d: IDebtRecord): string {
  const dir = d.direction === "owed" ? "%cg[OWED TO ME]%cn" : "%cy[I OWE]%cn";
  const status = d.cashedIn ? " %ch%cx(cashed in)%cn" : "";
  return `  ${dir} %ch${d.otherName}%cn${status}\n    ${d.description}  %ch[id: ${d.id.slice(0, 8)}]%cn`;
}

async function ownerName(id: string): Promise<string> {
  const p = await dbojs.queryOne({ id });
  return ((p?.data as Record<string, unknown>)?.name as string) || id;
}

// ─── +debts ───────────────────────────────────────────────────────────────────
//  List my active debts.

addCmd({
  name: "+debts",
  category: "Urban Shadows",
  help: "+debts  —  List your active Debts.",
  pattern: /^\+debts?$/i,
  exec: async (u) => {
    const all = await debts.query({ ownerId: u.me.id } as Parameters<typeof debts.query>[0]);
    const active = all.filter((d) => !d.cashedIn);
    const cashed = all.filter((d) => d.cashedIn);

    if (!all.length) {
      u.send("%ch+debts:%cn  You have no debts recorded.");
      return;
    }

    const lines: string[] = ["%ch─── Debts ───────────────────────────────────────────%cn"];

    if (active.length) {
      lines.push("%chActive:%cn");
      active.forEach((d) => lines.push(debtLine(d)));
    }

    if (cashed.length) {
      lines.push("%chCashed In:%cn");
      cashed.forEach((d) => lines.push(debtLine(d)));
    }

    u.send(lines.join("\n"));
  },
});

// ─── +debt/owe <person>=<description> ─────────────────────────────────────────
//  Record a debt I owe to someone else.

addCmd({
  name: "+debt/owe",
  category: "Urban Shadows",
  help: "+debt/owe <person>=<description>  —  Record a Debt you owe someone.",
  pattern: /^\+debt\/owe\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    const otherName = (u.cmd.args[0] ?? "").trim();
    const description = (u.cmd.args[1] ?? "").trim();

    if (!otherName || !description) {
      u.send("%ch+debt/owe:%cn  Usage: +debt/owe <person>=<description>");
      return;
    }
    if (otherName.length > 100) { u.send("%ch+debt/owe:%cn  Person name cannot exceed 100 characters."); return; }
    if (description.length > 1000) { u.send("%ch+debt/owe:%cn  Description cannot exceed 1000 characters."); return; }

    const now = Date.now();
    const record: IDebtRecord = {
      id: crypto.randomUUID(),
      ownerId: u.me.id,
      ownerName: await ownerName(u.me.id),
      direction: "owes",
      otherName,
      description,
      cashedIn: false,
      createdAt: now,
      updatedAt: now,
    };

    await debts.create(record);
    u.send(`%ch+debt/owe:%cn  Added debt to %ch${otherName}%cn — "${description}"`);
  },
});

// ─── +debt/add <person>=<description> ─────────────────────────────────────────
//  Record a debt someone owes me.

addCmd({
  name: "+debt/add",
  category: "Urban Shadows",
  help: "+debt/add <person>=<description>  —  Record a Debt owed to you.",
  pattern: /^\+debt\/add\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    const otherName = (u.cmd.args[0] ?? "").trim();
    const description = (u.cmd.args[1] ?? "").trim();

    if (!otherName || !description) {
      u.send("%ch+debt/add:%cn  Usage: +debt/add <person>=<description>");
      return;
    }
    if (otherName.length > 100) { u.send("%ch+debt/add:%cn  Person name cannot exceed 100 characters."); return; }
    if (description.length > 1000) { u.send("%ch+debt/add:%cn  Description cannot exceed 1000 characters."); return; }

    const now = Date.now();
    const record: IDebtRecord = {
      id: crypto.randomUUID(),
      ownerId: u.me.id,
      ownerName: await ownerName(u.me.id),
      direction: "owed",
      otherName,
      description,
      cashedIn: false,
      createdAt: now,
      updatedAt: now,
    };

    await debts.create(record);
    u.send(`%ch+debt/add:%cn  Recorded that %ch${otherName}%cn owes you — "${description}"`);
  },
});

// ─── +debt/cashin <id> ─────────────────────────────────────────────────────────
//  Mark a debt as cashed in (spent).

addCmd({
  name: "+debt/cashin",
  category: "Urban Shadows",
  help: "+debt/cashin <id>  —  Cash in a Debt (mark it as spent).",
  pattern: /^\+debt\/cashin\s+(\S+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const all = await debts.query({ ownerId: u.me.id } as Parameters<typeof debts.query>[0]);
    const debt = all.find((d) => d.id.startsWith(fragment) && !d.cashedIn);

    if (!debt) {
      u.send(`%ch+debt/cashin:%cn  No active debt found matching '${fragment}'.`);
      return;
    }

    await debts.atomicModify(debt.id, (current) => ({
      ...current,
      cashedIn: true,
      cashedInAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const dir = debt.direction === "owed" ? `${debt.otherName} owes you` : `you owe ${debt.otherName}`;
    u.send(`%ch+debt/cashin:%cn  Marked as cashed in: ${dir} — "${debt.description}"`);
  },
});

// ─── +debt/del <id> ────────────────────────────────────────────────────────────
//  Delete a debt record.

addCmd({
  name: "+debt/del",
  category: "Urban Shadows",
  help: "+debt/del <id>  —  Delete a Debt record.",
  pattern: /^\+debt\/del\s+(\S+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const all = await debts.query({ ownerId: u.me.id } as Parameters<typeof debts.query>[0]);
    const debt = all.find((d) => d.id.startsWith(fragment));

    if (!debt) {
      u.send(`%ch+debt/del:%cn  No debt found matching '${fragment}'.`);
      return;
    }

    await debts.delete({ id: debt.id } as Parameters<typeof debts.delete>[0]);
    u.send(`%ch+debt/del:%cn  Deleted debt with ${debt.otherName} — "${debt.description}"`);
  },
});
