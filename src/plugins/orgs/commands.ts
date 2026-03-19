import { addCmd } from "ursamu/app";
import { orgs } from "./db.ts";
import { isValidOrgCircle, ORG_CIRCLES } from "./logic.ts";
import type { CircleName, IOrg } from "./schema.ts";

const H = "%ch";
const N = "%cn";
const G = "%cg";
const DIM = "%cx";

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

async function findOrg(fragment: string): Promise<IOrg | null> {
  const all = await orgs.all();
  const lower = fragment.toLowerCase();
  return (
    all.find((o) => o.id.startsWith(fragment)) ??
      all.find((o) => o.name.toLowerCase().startsWith(lower)) ??
      null
  );
}

// --- +org/list [circle] ------------------------------------------------------

addCmd({
  name: "+org/list",
  category: "Urban Shadows",
  help:
    "+org/list [circle]  —  List organizations. Staff sees all; players see public ones.",
  pattern: /^\+org\/list(?:\s+(\w+))?$/i,
  exec: async (u) => {
    const circleFilter = (u.cmd.args[0] ?? "").toLowerCase().trim() as
      | CircleName
      | "";

    if (circleFilter && !isValidOrgCircle(circleFilter)) {
      u.send(
        `%ch+org/list:%cn  Unknown circle '${circleFilter}'. Use: ${
          ORG_CIRCLES.join(", ")
        }`,
      );
      return;
    }

    const staff = isStaff(u);
    let pool = await orgs.all();
    if (!staff) pool = pool.filter((o) => o.isPublic);
    if (circleFilter) pool = pool.filter((o) => o.circle === circleFilter);
    pool.sort((a, b) =>
      a.circle.localeCompare(b.circle) || a.name.localeCompare(b.name)
    );

    if (!pool.length) {
      u.send(
        circleFilter
          ? `%ch+org/list:%cn  No organizations in the ${circleFilter} circle${
            staff ? "" : " (or none are public)"
          }.`
          : `%ch+org/list:%cn  No organizations${
            staff ? "" : " (or none are public)"
          }.`,
      );
      return;
    }

    const lines = [
      `${H}--- Organizations${circleFilter ? ` (${circleFilter})` : ""}${
        staff ? " [staff]" : ""
      } ---${N}`,
    ];
    for (const o of pool) {
      const hiddenTag = staff && !o.isPublic ? ` ${DIM}[hidden]${N}` : "";
      lines.push(
        `  ${H}[${o.circle}]${N}  ${H}${o.name}${N}${hiddenTag}  ${DIM}[${
          o.id.slice(0, 8)
        }]${N}`,
      );
    }
    u.send(lines.join("\n"));
  },
});

// --- +org/view <name> --------------------------------------------------------

addCmd({
  name: "+org/view",
  category: "Urban Shadows",
  help: "+org/view <name>  —  View an organization's details.",
  pattern: /^\+org\/view\s+(.+)$/i,
  exec: async (u) => {
    const org = await findOrg((u.cmd.args[0] ?? "").trim());
    const staff = isStaff(u);

    if (!org || (!org.isPublic && !staff)) {
      u.send(`%ch+org/view:%cn  No organization found for '${u.cmd.args[0]}'.`);
      return;
    }

    const lines = [
      `${H}--- ${org.name} ------------------------------------------${N}`,
      `  Circle:  ${H}${org.circle}${N}`,
    ];
    if (org.description) lines.push(`  Desc:    ${org.description}`);

    if (staff) {
      if (org.notes) {
        lines.push(
          `${H}--- Staff Notes -----------------------------------${N}`,
        );
        lines.push(`  ${org.notes}`);
      }
      lines.push(
        `  ${DIM}[Public: ${org.isPublic ? "yes" : "no"}  id: ${
          org.id.slice(0, 8)
        }]${N}`,
      );
    }

    u.send(lines.join("\n"));
  },
});

// --- +org/create <circle>=<name> ---------------------------------------------

addCmd({
  name: "+org/create",
  category: "Urban Shadows",
  help: "+org/create <circle>=<name>  —  [Staff] Create a new organization.",
  pattern: /^\+org\/create\s+(\w+)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+org/create:%cn  Staff only.");
      return;
    }

    const circle = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const name = (u.cmd.args[1] ?? "").trim();

    if (!isValidOrgCircle(circle)) {
      u.send(
        `%ch+org/create:%cn  Unknown circle '${circle}'. Use: ${
          ORG_CIRCLES.join(", ")
        }`,
      );
      return;
    }
    if (!name) {
      u.send("%ch+org/create:%cn  Name cannot be blank.");
      return;
    }
    if (name.length > 100) {
      u.send("%ch+org/create:%cn  Name cannot exceed 100 characters.");
      return;
    }

    const now = Date.now();
    const org: IOrg = {
      id: crypto.randomUUID(),
      name,
      circle: circle as CircleName,
      description: "",
      notes: "",
      isPublic: false,
      createdBy: u.me.id,
      createdAt: now,
      updatedAt: now,
    };

    await orgs.create(org);
    u.send(
      `%ch+org/create:%cn  Created: %ch${name}%cn (${circle})  [id: ${
        org.id.slice(0, 8)
      }]\n` +
        `  Use +org/desc to describe it and +org/toggle to make it visible to players.`,
    );
  },
});

// --- +org/desc <name>=<text> -------------------------------------------------

addCmd({
  name: "+org/desc",
  category: "Urban Shadows",
  help:
    "+org/desc <name>=<text>  —  [Staff] Set an organization's public description.",
  pattern: /^\+org\/desc\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+org/desc:%cn  Staff only.");
      return;
    }

    const description = (u.cmd.args[1] ?? "").trim();
    if (description.length > 2000) {
      u.send("%ch+org/desc:%cn  Description cannot exceed 2000 characters.");
      return;
    }

    const org = await findOrg((u.cmd.args[0] ?? "").trim());
    if (!org) {
      u.send(`%ch+org/desc:%cn  No organization found for '${u.cmd.args[0]}'.`);
      return;
    }

    await orgs.atomicModify(org.id, (current: IOrg) => ({
      ...current,
      description,
      updatedAt: Date.now(),
    }));
    u.send(`%ch+org/desc:%cn  Description updated for %ch${org.name}%cn.`);
  },
});

// --- +org/note <name>=<text> -------------------------------------------------

addCmd({
  name: "+org/note",
  category: "Urban Shadows",
  help:
    "+org/note <name>=<text>  —  [Staff] Set private staff notes on an organization.",
  pattern: /^\+org\/note\s+(.+?)=(.*)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+org/note:%cn  Staff only.");
      return;
    }

    const notes = (u.cmd.args[1] ?? "").trim();
    if (notes.length > 2000) {
      u.send("%ch+org/note:%cn  Notes cannot exceed 2000 characters.");
      return;
    }

    const org = await findOrg((u.cmd.args[0] ?? "").trim());
    if (!org) {
      u.send(`%ch+org/note:%cn  No organization found for '${u.cmd.args[0]}'.`);
      return;
    }

    await orgs.atomicModify(org.id, (current: IOrg) => ({
      ...current,
      notes,
      updatedAt: Date.now(),
    }));
    u.send(`%ch+org/note:%cn  Notes updated for %ch${org.name}%cn.`);
  },
});

// --- +org/toggle <name> ------------------------------------------------------

addCmd({
  name: "+org/toggle",
  category: "Urban Shadows",
  help:
    "+org/toggle <name>  —  [Staff] Toggle an organization's public visibility.",
  pattern: /^\+org\/toggle\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+org/toggle:%cn  Staff only.");
      return;
    }

    const org = await findOrg((u.cmd.args[0] ?? "").trim());
    if (!org) {
      u.send(
        `%ch+org/toggle:%cn  No organization found for '${u.cmd.args[0]}'.`,
      );
      return;
    }

    const result = await orgs.atomicModify(org.id, (current: IOrg) => ({
      ...current,
      isPublic: !current.isPublic,
      updatedAt: Date.now(),
    }));
    const vis = result.isPublic ? `${G}${H}public${N}` : `${DIM}hidden${N}`;
    u.send(`%ch+org/toggle:%cn  %ch${result.name}%cn is now ${vis}.`);
  },
});

// --- +org/del <name> ---------------------------------------------------------

addCmd({
  name: "+org/del",
  category: "Urban Shadows",
  help: "+org/del <name>  —  [Staff] Permanently delete an organization.",
  pattern: /^\+org\/del\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+org/del:%cn  Staff only.");
      return;
    }

    const org = await findOrg((u.cmd.args[0] ?? "").trim());
    if (!org) {
      u.send(`%ch+org/del:%cn  No organization found for '${u.cmd.args[0]}'.`);
      return;
    }

    await orgs.delete({ id: org.id } as Parameters<typeof orgs.delete>[0]);
    u.send(`%ch+org/del:%cn  Deleted organization: %ch${org.name}%cn.`);
  },
});
