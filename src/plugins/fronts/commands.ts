import { addCmd } from "ursamu/app";
import { fronts } from "./db.ts";
import { clockBar, isDoom, tickClock, untickClock } from "./logic.ts";
import { CLOCK_SIZES } from "./schema.ts";
import type { ClockSize, IFront, IGrimPortent } from "./schema.ts";

// --- Helpers ------------------------------------------------------------------

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

const STATUS_COLOR: Record<string, string> = {
  active: "%cg",
  resolved: "%cy",
  abandoned: "%cx",
};

/**
 * Find a front by ID prefix or case-insensitive name prefix.
 * Only searches active fronts unless `includeAll` is true.
 */
async function findFront(
  fragment: string,
  includeAll = false,
): Promise<IFront | null> {
  const all = await fronts.all();
  const pool = includeAll ? all : all.filter((f) => f.status === "active");
  const lower = fragment.toLowerCase();
  return (
    pool.find((f) => f.id.startsWith(fragment)) ??
      pool.find((f) => f.name.toLowerCase().startsWith(lower)) ??
      null
  );
}

function renderFront(f: IFront): string {
  const col = STATUS_COLOR[f.status];
  const doom = isDoom(f) ? " %ch%cr— DOOM REACHED%cn" : "";
  const lines = [
    `%ch--- Front: ${f.name} ---------------------------------%cn`,
    `  Status:  ${col}%ch${f.status.toUpperCase()}%cn${doom}`,
    `  Clock:   ${clockBar(f.clockTicks, f.clockSize)}`,
  ];

  if (f.description) {
    lines.push(`  Desc:    ${f.description}`);
  }

  if (f.grimPortents.length) {
    lines.push(`  %ch--- Grim Portents ----------------------------------%cn`);
    f.grimPortents.forEach((p, i) => {
      const marker = p.triggered ? `%ch%cg[*]%cn` : `%cx[ ]%cn`;
      lines.push(`  ${i + 1}. ${marker} ${p.text}`);
    });
  } else {
    lines.push(
      `  %cx(No grim portents yet — use +front/portent <id>=<text>)%cn`,
    );
  }

  lines.push(`  %ch[id: ${f.id.slice(0, 8)}]%cn`);
  return lines.join("\n");
}

// --- +front/create <name> -----------------------------------------------------

addCmd({
  name: "+front/create",
  category: "Urban Shadows",
  help:
    "+front/create <name>  —  [Staff] Create a new Front with a 6-segment clock.",
  pattern: /^\+front\/create\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/create:%cn  Staff only.");
      return;
    }

    const name = (u.cmd.args[0] ?? "").trim();
    if (!name) {
      u.send("%ch+front/create:%cn  Name cannot be blank.");
      return;
    }
    if (name.length > 100) {
      u.send("%ch+front/create:%cn  Name cannot exceed 100 characters.");
      return;
    }

    const now = Date.now();
    const front: IFront = {
      id: crypto.randomUUID(),
      name,
      description: "",
      clockSize: 6,
      clockTicks: 0,
      grimPortents: [],
      status: "active",
      createdBy: u.me.id,
      createdAt: now,
      updatedAt: now,
    };

    await fronts.create(front);
    u.send(
      `%ch+front/create:%cn  Front created: %ch${name}%cn  Clock: ${
        clockBar(0, 6)
      }  [id: ${front.id.slice(0, 8)}]\n` +
        `  Use %ch+front/desc%cn, %ch+front/portent%cn, %ch+front/tick%cn to fill it in.`,
    );
  },
});

// --- +front/list [all] --------------------------------------------------------

addCmd({
  name: "+front/list",
  category: "Urban Shadows",
  help: "+front/list [all]  —  [Staff] List active Fronts (or all with 'all').",
  pattern: /^\+front\/list(?:\s+(all))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/list:%cn  Staff only.");
      return;
    }

    const includeAll = (u.cmd.args[0] ?? "").toLowerCase() === "all";
    const all = await fronts.all();
    const pool = includeAll ? all : all.filter((f) => f.status === "active");

    if (!pool.length) {
      u.send(
        includeAll
          ? "%ch+front/list:%cn  No fronts exist yet. Use +front/create <name>."
          : "%ch+front/list:%cn  No active fronts. Use +front/list all to see resolved/abandoned.",
      );
      return;
    }

    const lines = [
      `%ch--- Fronts${
        includeAll ? " (all)" : ""
      } --------------------------------------%cn`,
    ];
    for (const f of pool) {
      const col = STATUS_COLOR[f.status];
      const doom = isDoom(f) ? " %cr%ch[DOOM]%cn" : "";
      lines.push(
        `  ${col}%ch${
          f.status.toUpperCase().padEnd(9)
        }%cn  %ch${f.name}%cn${doom}` +
          `  ${clockBar(f.clockTicks, f.clockSize)}` +
          `  %cx[${f.id.slice(0, 8)}]%cn`,
      );
    }
    u.send(lines.join("\n"));
  },
});

// --- +front/view <name> -------------------------------------------------------

addCmd({
  name: "+front/view",
  category: "Urban Shadows",
  help: "+front/view <name>  —  [Staff] View full Front details.",
  pattern: /^\+front\/view\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/view:%cn  Staff only.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim(), true);
    if (!front) {
      u.send(`%ch+front/view:%cn  No front found for '${u.cmd.args[0]}'.`);
      return;
    }

    u.send(renderFront(front));
  },
});

// --- +front/desc <name>=<text> ------------------------------------------------

addCmd({
  name: "+front/desc",
  category: "Urban Shadows",
  help: "+front/desc <name>=<text>  —  [Staff] Set a Front's description.",
  pattern: /^\+front\/desc\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/desc:%cn  Staff only.");
      return;
    }

    const description = (u.cmd.args[1] ?? "").trim();
    if (description.length > 2000) {
      u.send("%ch+front/desc:%cn  Description cannot exceed 2000 characters.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/desc:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      description,
      updatedAt: Date.now(),
    }));
    u.send(`%ch+front/desc:%cn  Description updated for %ch${front.name}%cn.`);
  },
});

// --- +front/clock <name>=<4|6|8> ---------------------------------------------

addCmd({
  name: "+front/clock",
  category: "Urban Shadows",
  help: "+front/clock <name>=<4|6|8>  —  [Staff] Change a Front's clock size.",
  pattern: /^\+front\/clock\s+(.+?)=(\d+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/clock:%cn  Staff only.");
      return;
    }

    const size = parseInt(u.cmd.args[1] ?? "0", 10) as ClockSize;
    if (!(CLOCK_SIZES as readonly number[]).includes(size)) {
      u.send(
        `%ch+front/clock:%cn  Clock size must be ${CLOCK_SIZES.join(", ")}.`,
      );
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/clock:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const result = await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      clockSize: size,
      clockTicks: Math.min(current.clockTicks, size),
      updatedAt: Date.now(),
    }));
    u.send(
      `%ch+front/clock:%cn  %ch${result.name}%cn  Clock: ${
        clockBar(result.clockTicks, result.clockSize)
      }`,
    );
  },
});

// --- +front/tick <name> [n] ---------------------------------------------------

addCmd({
  name: "+front/tick",
  category: "Urban Shadows",
  help:
    "+front/tick <name> [n]  —  [Staff] Advance a Front's clock by n (default 1).",
  pattern: /^\+front\/tick\s+(.+?)(?:\s+(\d+))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/tick:%cn  Staff only.");
      return;
    }

    const n = Math.max(1, parseInt(u.cmd.args[1] ?? "1", 10) || 1);
    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/tick:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const result = await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      clockTicks: tickClock(current.clockTicks, n, current.clockSize),
      updatedAt: Date.now(),
    }));

    const doom = isDoom(result) ? " %ch%cr— DOOM REACHED!%cn" : "";
    u.send(
      `%ch+front/tick:%cn  %ch${result.name}%cn  ${
        clockBar(result.clockTicks, result.clockSize)
      }${doom}`,
    );
  },
});

// --- +front/untick <name> -----------------------------------------------------

addCmd({
  name: "+front/untick",
  category: "Urban Shadows",
  help:
    "+front/untick <name>  —  [Staff] Remove one tick from a Front's clock.",
  pattern: /^\+front\/untick\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/untick:%cn  Staff only.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/untick:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const result = await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      clockTicks: untickClock(current.clockTicks),
      updatedAt: Date.now(),
    }));
    u.send(
      `%ch+front/untick:%cn  %ch${result.name}%cn  ${
        clockBar(result.clockTicks, result.clockSize)
      }`,
    );
  },
});

// --- +front/portent <name>=<text> --------------------------------------------
//  Append a grim portent to the front's portent list.

addCmd({
  name: "+front/portent",
  category: "Urban Shadows",
  help:
    "+front/portent <name>=<text>  —  [Staff] Add a Grim Portent to a Front.",
  pattern: /^\+front\/portent\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/portent:%cn  Staff only.");
      return;
    }

    const text = (u.cmd.args[1] ?? "").trim();
    if (!text) {
      u.send("%ch+front/portent:%cn  Portent text cannot be blank.");
      return;
    }
    if (text.length > 500) {
      u.send("%ch+front/portent:%cn  Portent cannot exceed 500 characters.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/portent:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const portent: IGrimPortent = {
      id: crypto.randomUUID(),
      text,
      triggered: false,
    };
    let atMax = false;
    const result = await fronts.atomicModify(front.id, (current: IFront) => {
      if (current.grimPortents.length >= 8) {
        atMax = true;
        return current;
      }
      return {
        ...current,
        grimPortents: [...current.grimPortents, portent],
        updatedAt: Date.now(),
      };
    });

    if (atMax) {
      u.send(`%ch+front/portent:%cn  Fronts support at most 8 grim portents.`);
      return;
    }

    const idx = result.grimPortents.length;
    u.send(
      `%ch+front/portent:%cn  %ch${result.name}%cn  Portent #${idx} added: "${text}"`,
    );
  },
});

// --- +front/trigger <name>=<n> -----------------------------------------------
//  Mark portent #n as triggered (1-indexed).

addCmd({
  name: "+front/trigger",
  category: "Urban Shadows",
  help:
    "+front/trigger <name>=<n>  —  [Staff] Mark Grim Portent #n as triggered.",
  pattern: /^\+front\/trigger\s+(.+?)=(\d+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/trigger:%cn  Staff only.");
      return;
    }

    const n = parseInt(u.cmd.args[1] ?? "0", 10);
    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/trigger:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    if (n < 1 || n > front.grimPortents.length) {
      u.send(
        `%ch+front/trigger:%cn  No portent #${n}. Front has ${front.grimPortents.length}.`,
      );
      return;
    }

    const result = await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      grimPortents: current.grimPortents.map((p, i) =>
        i === n - 1 ? { ...p, triggered: true, triggeredAt: Date.now() } : p
      ),
      updatedAt: Date.now(),
    }));

    const portent = result.grimPortents[n - 1];
    u.send(
      `%ch+front/trigger:%cn  %ch${result.name}%cn  Portent #${n} triggered: "${portent.text}"`,
    );
  },
});

// --- +front/resolve <name> ----------------------------------------------------

addCmd({
  name: "+front/resolve",
  category: "Urban Shadows",
  help: "+front/resolve <name>  —  [Staff] Mark a Front as resolved.",
  pattern: /^\+front\/resolve\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/resolve:%cn  Staff only.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/resolve:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const result = await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      status: "resolved" as const,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    }));
    u.send(`%ch+front/resolve:%cn  %ch${result.name}%cn  %cg%chResolved.%cn`);
  },
});

// --- +front/abandon <name> ----------------------------------------------------

addCmd({
  name: "+front/abandon",
  category: "Urban Shadows",
  help: "+front/abandon <name>  —  [Staff] Mark a Front as abandoned.",
  pattern: /^\+front\/abandon\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/abandon:%cn  Staff only.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim());
    if (!front) {
      u.send(
        `%ch+front/abandon:%cn  No active front found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const result = await fronts.atomicModify(front.id, (current: IFront) => ({
      ...current,
      status: "abandoned" as const,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    }));
    u.send(`%ch+front/abandon:%cn  %ch${result.name}%cn  %cx%chAbandoned.%cn`);
  },
});

// --- +front/del <name> --------------------------------------------------------

addCmd({
  name: "+front/del",
  category: "Urban Shadows",
  help: "+front/del <name>  —  [Staff] Permanently delete a Front.",
  pattern: /^\+front\/del\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+front/del:%cn  Staff only.");
      return;
    }

    const front = await findFront((u.cmd.args[0] ?? "").trim(), true);
    if (!front) {
      u.send(`%ch+front/del:%cn  No front found for '${u.cmd.args[0]}'.`);
      return;
    }

    await fronts.delete(
      { id: front.id } as Parameters<typeof fronts.delete>[0],
    );
    u.send(`%ch+front/del:%cn  Deleted front: %ch${front.name}%cn.`);
  },
});
