import { addCmd } from "ursamu/app";
import { actions, periods } from "./db.ts";
import { DOWNTIME_TYPE_LABELS, DOWNTIME_TYPES, isValidType } from "./logic.ts";
import type {
  DowntimeActionType,
  IDowntimeAction,
  IDowntimePeriod,
} from "./schema.ts";

const H = "%ch";
const N = "%cn";
const G = "%cg";
const Y = "%cy";
const DIM = "%cx";

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function myName(u: { me: { id: string } }): string {
  return (u.me as unknown as { name?: string }).name ?? u.me.id;
}

async function openPeriod(): Promise<IDowntimePeriod | null> {
  const all = await periods.all();
  return all.find((p) => p.status === "open") ?? null;
}

function actionLine(a: IDowntimeAction): string {
  const status = a.resolved ? `${G}[DONE]${N}` : `${Y}[OPEN]${N}`;
  const desc = a.description.length > 60
    ? a.description.slice(0, 57) + "..."
    : a.description;
  return `  ${H}${
    a.id.slice(0, 6)
  }${N}  ${status}  ${H}${a.playerName}${N}  [${a.type}]  ${desc}`;
}

// --- +downtime ---------------------------------------------------------------

addCmd({
  name: "+downtime",
  category: "Urban Shadows",
  help:
    "+downtime  —  View the current downtime period and your submitted actions.",
  pattern: /^\+downtime$/i,
  exec: async (u) => {
    const period = await openPeriod();
    if (!period) {
      u.send("%ch+downtime:%cn  No downtime period is currently open.");
      return;
    }

    const myActions = await actions.query(
      { periodId: period.id, playerId: u.me.id } as Parameters<
        typeof actions.query
      >[0],
    );

    const lines = [
      `${H}--- Downtime: ${period.label} ---${N}`,
      `  Status: ${G}${H}OPEN${N}  [Opened by ${period.openedByName}]`,
    ];

    if (myActions.length) {
      lines.push(`  ${H}Your submissions:${N}`);
      for (const a of myActions) lines.push(actionLine(a));
    } else {
      lines.push(`  ${DIM}No submissions yet.${N}`);
      lines.push(`  ${DIM}Use: +downtime/submit <type>=<description>${N}`);
      lines.push(`  ${DIM}Types: ${DOWNTIME_TYPES.join(", ")}${N}`);
    }

    u.send(lines.join("\n"));
  },
});

// --- +downtime/types ---------------------------------------------------------

addCmd({
  name: "+downtime/types",
  category: "Urban Shadows",
  help: "+downtime/types  —  List available downtime action types.",
  pattern: /^\+downtime\/types$/i,
  exec: (u) => {
    const lines = [
      `${H}--- Downtime Action Types -----------------------------------${N}`,
    ];
    for (const [t, label] of Object.entries(DOWNTIME_TYPE_LABELS)) {
      lines.push(`  ${H}${t.padEnd(14)}${N}  ${label}`);
    }
    u.send(lines.join("\n"));
  },
});

// --- +downtime/submit <type>=<description> -----------------------------------

addCmd({
  name: "+downtime/submit",
  category: "Urban Shadows",
  help: "+downtime/submit <type>=<description>  —  Submit a downtime action.",
  pattern: /^\+downtime\/submit\s+(\S+)=(.+)$/i,
  exec: async (u) => {
    const actionType = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const description = (u.cmd.args[1] ?? "").trim();

    if (!isValidType(actionType)) {
      u.send(
        `%ch+downtime/submit:%cn  Unknown type '${actionType}'. Use +downtime/types to see options.`,
      );
      return;
    }
    if (!description) {
      u.send("%ch+downtime/submit:%cn  Description cannot be blank.");
      return;
    }
    if (description.length > 1000) {
      u.send(
        "%ch+downtime/submit:%cn  Description cannot exceed 1000 characters.",
      );
      return;
    }

    const period = await openPeriod();
    if (!period) {
      u.send("%ch+downtime/submit:%cn  No downtime period is currently open.");
      return;
    }

    const action: IDowntimeAction = {
      id: crypto.randomUUID(),
      periodId: period.id,
      playerId: u.me.id,
      playerName: myName(u),
      type: actionType,
      description,
      resolved: false,
      createdAt: Date.now(),
    };

    await actions.create(action);
    u.send(
      `%ch+downtime/submit:%cn  Submitted: [${actionType}] ${description}`,
    );
  },
});

// --- +downtime/list ----------------------------------------------------------
// Staff: all actions in current period.

addCmd({
  name: "+downtime/list",
  category: "Urban Shadows",
  help:
    "+downtime/list  —  [Staff] List all actions in the current downtime period.",
  pattern: /^\+downtime\/list$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+downtime/list:%cn  Staff only.");
      return;
    }

    const period = await openPeriod();
    if (!period) {
      u.send("%ch+downtime/list:%cn  No downtime period is currently open.");
      return;
    }

    const all = await actions.query(
      { periodId: period.id } as Parameters<typeof actions.query>[0],
    );
    if (!all.length) {
      u.send(
        `%ch+downtime/list:%cn  No actions submitted yet for "${period.label}".`,
      );
      return;
    }

    const open = all.filter((a) => !a.resolved);
    const done = all.filter((a) => a.resolved);
    const lines = [
      `${H}--- Downtime: ${period.label} (${all.length} total) ---${N}`,
      `  ${Y}Open: ${open.length}${N}   ${G}Resolved: ${done.length}${N}`,
    ];
    for (const a of all) lines.push(actionLine(a));
    u.send(lines.join("\n"));
  },
});

// --- +downtime/view <id> -----------------------------------------------------

addCmd({
  name: "+downtime/view",
  category: "Urban Shadows",
  help: "+downtime/view <id>  —  View a downtime action's full details.",
  pattern: /^\+downtime\/view\s+(\S+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const all = await actions.all();
    const action = all.find((a) => a.id.startsWith(fragment));

    if (!action || (!isStaff(u) && action.playerId !== u.me.id)) {
      u.send(`%ch+downtime/view:%cn  No action found for '${fragment}'.`);
      return;
    }

    const statusStr = action.resolved
      ? `${G}${H}RESOLVED${N}`
      : `${Y}${H}OPEN${N}`;
    const lines = [
      `${H}--- Downtime Action -----------------------------------${N}`,
      `  ID:     ${action.id.slice(0, 8)}`,
      `  Player: ${H}${action.playerName}${N}`,
      `  Type:   ${H}${action.type}${N}  (${
        DOWNTIME_TYPE_LABELS[action.type]
      })`,
      `  Status: ${statusStr}`,
      `  Desc:   ${action.description}`,
    ];
    if (action.resolved && action.resolution) {
      lines.push(
        `${H}--- MC Resolution -----------------------------------${N}`,
      );
      lines.push(`  ${action.resolution}`);
      if (action.resolvedByName) {
        lines.push(`  ${DIM}[Resolved by ${action.resolvedByName}]${N}`);
      }
    }
    u.send(lines.join("\n"));
  },
});

// --- +downtime/resolve <id>=<resolution> -------------------------------------

addCmd({
  name: "+downtime/resolve",
  category: "Urban Shadows",
  help:
    "+downtime/resolve <id>=<resolution>  —  [Staff] Resolve a downtime action with narrative.",
  pattern: /^\+downtime\/resolve\s+(\S+)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+downtime/resolve:%cn  Staff only.");
      return;
    }

    const fragment = (u.cmd.args[0] ?? "").trim();
    const resolution = (u.cmd.args[1] ?? "").trim();

    if (!resolution) {
      u.send("%ch+downtime/resolve:%cn  Resolution text cannot be blank.");
      return;
    }
    if (resolution.length > 2000) {
      u.send(
        "%ch+downtime/resolve:%cn  Resolution cannot exceed 2000 characters.",
      );
      return;
    }

    const all = await actions.all();
    const action = all.find((a) => a.id.startsWith(fragment));
    if (!action) {
      u.send(`%ch+downtime/resolve:%cn  No action found for '${fragment}'.`);
      return;
    }
    if (action.resolved) {
      u.send(`%ch+downtime/resolve:%cn  Action is already resolved.`);
      return;
    }

    let alreadyDone = false;
    const result = await actions.atomicModify(
      action.id,
      (current: IDowntimeAction) => {
        if (current.resolved) {
          alreadyDone = true;
          return current;
        }
        return {
          ...current,
          resolved: true,
          resolution,
          resolvedBy: u.me.id,
          resolvedByName: myName(u),
          resolvedAt: Date.now(),
        };
      },
    );

    if (alreadyDone) {
      u.send(`%ch+downtime/resolve:%cn  Action is already resolved.`);
      return;
    }
    u.send(
      `%ch+downtime/resolve:%cn  Resolved ${H}${result.playerName}${N}'s [${result.type}] action.`,
    );
  },
});

// --- +downtime/open [label] --------------------------------------------------

addCmd({
  name: "+downtime/open",
  category: "Urban Shadows",
  help: "+downtime/open [label]  —  [Staff] Open a new downtime period.",
  pattern: /^\+downtime\/open(?:\s+(.+))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+downtime/open:%cn  Staff only.");
      return;
    }

    const existing = await openPeriod();
    if (existing) {
      u.send(
        `%ch+downtime/open:%cn  A period is already open: "${existing.label}". Close it first.`,
      );
      return;
    }

    const label = ((u.cmd.args[0] ?? "").trim() || "Downtime").slice(0, 100);
    const period: IDowntimePeriod = {
      id: crypto.randomUUID(),
      label,
      status: "open",
      openedBy: u.me.id,
      openedByName: myName(u),
      openedAt: Date.now(),
    };

    await periods.create(period);
    u.send(
      `%ch+downtime/open:%cn  Downtime period opened: "${label}"\n` +
        `  Players can now submit with +downtime/submit <type>=<description>.`,
    );
  },
});

// --- +downtime/close ---------------------------------------------------------

addCmd({
  name: "+downtime/close",
  category: "Urban Shadows",
  help: "+downtime/close  —  [Staff] Close the current downtime period.",
  pattern: /^\+downtime\/close$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+downtime/close:%cn  Staff only.");
      return;
    }

    const period = await openPeriod();
    if (!period) {
      u.send("%ch+downtime/close:%cn  No downtime period is currently open.");
      return;
    }

    const all = await actions.query(
      { periodId: period.id } as Parameters<typeof actions.query>[0],
    );
    const openCount = all.filter((a) => !a.resolved).length;

    await periods.atomicModify(period.id, (current: IDowntimePeriod) => ({
      ...current,
      status: "closed" as const,
      closedBy: u.me.id,
      closedByName: myName(u),
      closedAt: Date.now(),
    }));

    const warn = openCount > 0
      ? `\n  ${Y}Warning: ${openCount} action(s) left unresolved.${N}`
      : "";
    u.send(
      `%ch+downtime/close:%cn  Downtime period "${period.label}" closed.${warn}`,
    );
  },
});
