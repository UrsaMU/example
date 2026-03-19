import { addCmd } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { factions } from "./db.ts";
import { adjustCircle, improveCircle, markCircle } from "./logic.ts";
import {
  CIRCLE_NAMES,
  CIRCLE_STATUS_MAX,
  CIRCLE_STATUS_MIN,
} from "./schema.ts";
import type { CircleName, IFactionEntry } from "./schema.ts";
import type { ICharSheet } from "../playbooks/schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function statusColor(v: number): string {
  if (v >= 2) return "%cg";
  if (v <= -2) return "%cr";
  return "%cy";
}

function statusDisplay(v: number): string {
  const col = statusColor(v);
  const sign = v > 0 ? "+" : "";
  return `${col}%ch${sign}${v}%cn`;
}

function circleStatusTable(sheet: ICharSheet): string {
  const s = sheet.circleStatus;
  const r = sheet.circleRatings;
  return [
    `%ch─── Circle Status ────────────────────────────────────%cn`,
    `  ${"Circle".padEnd(10)} Status  Rating`,
    `  ${"──────".padEnd(10)} ──────  ──────`,
    ...CIRCLE_NAMES.map((c) =>
      `  ${c.padEnd(10)} ${statusDisplay(s[c]).padEnd(20)}  ${
        r[c] >= 0 ? "+" : ""
      }${r[c]}`
    ),
  ].join("\n");
}

// ─── +circles ─────────────────────────────────────────────────────────────────
//  Show my circle status and faction affiliations.

addCmd({
  name: "+circles",
  category: "Urban Shadows",
  help: "+circles  —  View your Circle status and Faction affiliations.",
  pattern: /^\+circles$/i,
  exec: async (u) => {
    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+circles:%cn  No approved character sheet found.");
      return;
    }

    const myFactions = await factions.query(
      { playerId: u.me.id } as Parameters<typeof factions.query>[0],
    );
    const lines = [circleStatusTable(sheet)];

    if (myFactions.length) {
      lines.push(
        `\n%ch─── Faction Affiliations ─────────────────────────────%cn`,
      );
      for (const f of myFactions) {
        lines.push(
          `  [${f.circle}] %ch${f.name}%cn  ${statusDisplay(f.status)}  %ch[${
            f.id.slice(0, 8)
          }]%cn`,
        );
        if (f.notes) lines.push(`    ${f.notes}`);
      }
    } else {
      lines.push(`\n  No faction affiliations. Use +faction/add to add one.`);
    }

    u.send(lines.join("\n"));
  },
});

// ─── +circles/mark <circle> ───────────────────────────────────────────────────
//  Mark a circle (-1 status). Staff/MC action.

addCmd({
  name: "+circles/mark",
  category: "Urban Shadows",
  help:
    "+circles/mark <circle> [<player>]  —  Mark a Circle (−1 status). Staff/MC.",
  pattern: /^\+circles\/mark\s+(\w+)(?:\s+(.+))?$/i,
  exec: async (u) => {
    const circle = (u.cmd.args[0] ?? "").toLowerCase() as CircleName;
    const targetName = (u.cmd.args[1] ?? "").trim();

    if (!CIRCLE_NAMES.includes(circle)) {
      u.send(
        `%ch+circles/mark:%cn  Unknown circle '${circle}'. Use: ${
          CIRCLE_NAMES.join(", ")
        }`,
      );
      return;
    }

    let targetId = u.me.id;
    if (targetName) {
      if (!isStaff(u)) {
        u.send("%ch+circles/mark:%cn  Only staff can adjust others.");
        return;
      }
      const target = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!target) {
        u.send(`%ch+circles/mark:%cn  No sheet for '${targetName}'.`);
        return;
      }
      targetId = (target as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+circles/mark:%cn  No approved sheet found.");
      return;
    }
    if (!markCircle(sheet.circleStatus, circle)) {
      u.send(
        `%ch+circles/mark:%cn  ${circle} status is already at minimum (${CIRCLE_STATUS_MIN}).`,
      );
      return;
    }

    let atMin = false;
    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => {
        const updated = markCircle(current.circleStatus, circle);
        if (!updated) {
          atMin = true;
          return current;
        }
        return { ...current, circleStatus: updated, updatedAt: Date.now() };
      },
    );

    if (atMin) {
      u.send(
        `%ch+circles/mark:%cn  ${circle} status is already at minimum (${CIRCLE_STATUS_MIN}).`,
      );
      return;
    }

    const who = targetName || "Your";
    u.send(
      `%ch+circles/mark:%cn  ${who} %ch${circle}%cn status: ${
        statusDisplay(result.circleStatus[circle])
      }`,
    );
  },
});

// ─── +circles/improve <circle> ────────────────────────────────────────────────
//  Improve a circle (+1 status).

addCmd({
  name: "+circles/improve",
  category: "Urban Shadows",
  help:
    "+circles/improve <circle> [<player>]  —  Improve a Circle (+1 status).",
  pattern: /^\+circles\/improve\s+(\w+)(?:\s+(.+))?$/i,
  exec: async (u) => {
    const circle = (u.cmd.args[0] ?? "").toLowerCase() as CircleName;
    const targetName = (u.cmd.args[1] ?? "").trim();

    if (!CIRCLE_NAMES.includes(circle)) {
      u.send(
        `%ch+circles/improve:%cn  Unknown circle '${circle}'. Use: ${
          CIRCLE_NAMES.join(", ")
        }`,
      );
      return;
    }

    let targetId = u.me.id;
    if (targetName) {
      if (!isStaff(u)) {
        u.send("%ch+circles/improve:%cn  Only staff can adjust others.");
        return;
      }
      const target = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!target) {
        u.send(`%ch+circles/improve:%cn  No sheet for '${targetName}'.`);
        return;
      }
      targetId = (target as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+circles/improve:%cn  No approved sheet found.");
      return;
    }
    if (!improveCircle(sheet.circleStatus, circle)) {
      u.send(
        `%ch+circles/improve:%cn  ${circle} status is already at maximum (${CIRCLE_STATUS_MAX}).`,
      );
      return;
    }

    let atMax = false;
    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => {
        const updated = improveCircle(current.circleStatus, circle);
        if (!updated) {
          atMax = true;
          return current;
        }
        return { ...current, circleStatus: updated, updatedAt: Date.now() };
      },
    );

    if (atMax) {
      u.send(
        `%ch+circles/improve:%cn  ${circle} status is already at maximum (${CIRCLE_STATUS_MAX}).`,
      );
      return;
    }

    const who = targetName || "Your";
    u.send(
      `%ch+circles/improve:%cn  ${who} %ch${circle}%cn status: ${
        statusDisplay(result.circleStatus[circle])
      }`,
    );
  },
});

// ─── +circles/set <circle>=<value> [<player>] ─────────────────────────────────
//  Staff: set a circle status directly.

addCmd({
  name: "+circles/set",
  category: "Urban Shadows",
  help:
    "+circles/set <circle>=<value> [<player>]  —  [Staff] Set Circle status directly.",
  pattern: /^\+circles\/set\s+(\w+)=([+-]?\d+)(?:\s+(.+))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+circles/set:%cn  Staff only.");
      return;
    }

    const circle = (u.cmd.args[0] ?? "").toLowerCase() as CircleName;
    const value = parseInt(u.cmd.args[1] ?? "0", 10);
    const targetName = (u.cmd.args[2] ?? "").trim();

    if (!CIRCLE_NAMES.includes(circle)) {
      u.send(
        `%ch+circles/set:%cn  Unknown circle. Use: ${CIRCLE_NAMES.join(", ")}`,
      );
      return;
    }

    if (value < CIRCLE_STATUS_MIN || value > CIRCLE_STATUS_MAX) {
      u.send(
        `%ch+circles/set:%cn  Value must be ${CIRCLE_STATUS_MIN}–${CIRCLE_STATUS_MAX}. Got ${value}.`,
      );
      return;
    }

    let targetId = u.me.id;
    if (targetName) {
      const target = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!target) {
        u.send(`%ch+circles/set:%cn  No sheet for '${targetName}'.`);
        return;
      }
      targetId = (target as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet) {
      u.send("%ch+circles/set:%cn  No sheet found.");
      return;
    }

    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => ({
        ...current,
        circleStatus: adjustCircle(
          current.circleStatus,
          circle,
          value - current.circleStatus[circle],
        ),
        updatedAt: Date.now(),
      }),
    );

    u.send(
      `%ch+circles/set:%cn  %ch${circle}%cn status set to ${
        statusDisplay(result.circleStatus[circle])
      }`,
    );
  },
});

// ─── +factions ────────────────────────────────────────────────────────────────
//  List my faction affiliations.

addCmd({
  name: "+factions",
  category: "Urban Shadows",
  help: "+factions  —  List your Faction affiliations.",
  pattern: /^\+factions$/i,
  exec: async (u) => {
    const myFactions = await factions.query(
      { playerId: u.me.id } as Parameters<typeof factions.query>[0],
    );

    if (!myFactions.length) {
      u.send(
        "%ch+factions:%cn  No faction affiliations. Use +faction/add <circle>=<name> to add one.",
      );
      return;
    }

    const lines = [
      `%ch─── Faction Affiliations ─────────────────────────────%cn`,
    ];
    for (const f of myFactions) {
      lines.push(
        `  %ch[${f.circle}]%cn  ${f.name}  ${statusDisplay(f.status)}  %ch[${
          f.id.slice(0, 8)
        }]%cn`,
      );
      if (f.notes) lines.push(`    ${f.notes}`);
    }

    u.send(lines.join("\n"));
  },
});

// ─── +faction/add <circle>=<name> ─────────────────────────────────────────────
//  Add a faction affiliation.

addCmd({
  name: "+faction/add",
  category: "Urban Shadows",
  help: "+faction/add <circle>=<name>  —  Add a Faction affiliation.",
  pattern: /^\+faction\/add\s+(\w+)=(.+)$/i,
  exec: async (u) => {
    const circle = (u.cmd.args[0] ?? "").toLowerCase() as CircleName;
    const name = (u.cmd.args[1] ?? "").trim();

    if (!CIRCLE_NAMES.includes(circle)) {
      u.send(
        `%ch+faction/add:%cn  Unknown circle '${circle}'. Use: ${
          CIRCLE_NAMES.join(", ")
        }`,
      );
      return;
    }
    if (!name) {
      u.send("%ch+faction/add:%cn  Usage: +faction/add <circle>=<name>");
      return;
    }
    if (name.length > 200) {
      u.send("%ch+faction/add:%cn  Faction name cannot exceed 200 characters.");
      return;
    }

    const now = Date.now();
    const entry: IFactionEntry = {
      id: crypto.randomUUID(),
      playerId: u.me.id,
      circle,
      name,
      status: 0,
      notes: "",
      createdAt: now,
      updatedAt: now,
    };

    await factions.create(entry);
    u.send(
      `%ch+faction/add:%cn  Added faction: %ch${name}%cn (${circle}, status +0)  [id: ${
        entry.id.slice(0, 8)
      }]`,
    );
  },
});

// ─── +faction/note <id>=<notes> ───────────────────────────────────────────────
//  Update notes on a faction.

addCmd({
  name: "+faction/note",
  category: "Urban Shadows",
  help: "+faction/note <id>=<notes>  —  Update notes on a Faction affiliation.",
  pattern: /^\+faction\/note\s+(\S+)=(.+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const notes = (u.cmd.args[1] ?? "").trim();

    if (notes.length > 2000) {
      u.send("%ch+faction/note:%cn  Notes cannot exceed 2000 characters.");
      return;
    }

    const all = await factions.query(
      { playerId: u.me.id } as Parameters<typeof factions.query>[0],
    );
    const faction = all.find((f) => f.id.startsWith(fragment));

    if (!faction) {
      u.send(`%ch+faction/note:%cn  No faction found matching '${fragment}'.`);
      return;
    }

    await factions.atomicModify(faction.id, (current) => ({
      ...current,
      notes,
      updatedAt: Date.now(),
    }));

    u.send(`%ch+faction/note:%cn  Notes updated for %ch${faction.name}%cn.`);
  },
});

// ─── +faction/del <id> ────────────────────────────────────────────────────────
//  Remove a faction affiliation.

addCmd({
  name: "+faction/del",
  category: "Urban Shadows",
  help: "+faction/del <id>  —  Remove a Faction affiliation.",
  pattern: /^\+faction\/del\s+(\S+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const all = await factions.query(
      { playerId: u.me.id } as Parameters<typeof factions.query>[0],
    );
    const faction = all.find((f) => f.id.startsWith(fragment));

    if (!faction) {
      u.send(`%ch+faction/del:%cn  No faction found matching '${fragment}'.`);
      return;
    }

    await factions.delete(
      { id: faction.id } as Parameters<typeof factions.delete>[0],
    );
    u.send(`%ch+faction/del:%cn  Removed %ch${faction.name}%cn.`);
  },
});
