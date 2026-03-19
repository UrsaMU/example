import { addCmd } from "ursamu/app";
import { npcs } from "./db.ts";
import { markHarm, healHarm, markedHarmCount, isIncapacitated, HARM_MAX, ARMOR_MAX } from "../tracker/logic.ts";
import { EMPTY_HARM } from "./schema.ts";
import type { INPC } from "./schema.ts";

// --- Helpers ------------------------------------------------------------------

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") || u.me.flags.has("superuser");
}

function harmBar(boxes: boolean[]): string {
  return boxes.map((b) => b ? "%ch%cr[X]%cn" : "[_]").join("");
}

function npcLine(n: INPC): string {
  const count = markedHarmCount(n.harm);
  const incap = isIncapacitated(n.harm) ? " %ch%cr[INCAP]%cn" : "";
  const circle = n.circle ? `  %cx[${n.circle}]%cn` : "";
  return `  %ch${n.name}%cn${circle}  Harm: ${harmBar(n.harm.boxes)} (${count}/5)  Armor: ${n.harm.armor}${incap}`;
}

/** Find an NPC by case-insensitive name prefix or ID prefix. First match wins. */
async function findNPC(fragment: string): Promise<INPC | null> {
  const all = await npcs.all();
  const lower = fragment.toLowerCase();
  return (
    all.find((n) => n.id.startsWith(fragment)) ??
    all.find((n) => n.name.toLowerCase().startsWith(lower)) ??
    null
  );
}

// --- +npc/create <name> -------------------------------------------------------

addCmd({
  name: "+npc/create",
  category: "Urban Shadows",
  help: "+npc/create <name>  —  [Staff] Create a new NPC.",
  pattern: /^\+npc\/create\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/create:%cn  Staff only."); return; }

    const name = (u.cmd.args[0] ?? "").trim();
    if (!name) { u.send("%ch+npc/create:%cn  Name cannot be blank."); return; }
    if (name.length > 100) { u.send("%ch+npc/create:%cn  Name cannot exceed 100 characters."); return; }

    const now = Date.now();
    const npc: INPC = {
      id: crypto.randomUUID(),
      name,
      harm: { ...EMPTY_HARM, boxes: [false, false, false, false, false] },
      notes: "",
      createdBy: u.me.id,
      createdAt: now,
      updatedAt: now,
    };

    await npcs.create(npc);
    u.send(`%ch+npc/create:%cn  Created NPC: %ch${name}%cn  [id: ${npc.id.slice(0, 8)}]`);
  },
});

// --- +npc/list ----------------------------------------------------------------

addCmd({
  name: "+npc/list",
  category: "Urban Shadows",
  help: "+npc/list  —  [Staff] List all tracked NPCs.",
  pattern: /^\+npc\/list$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/list:%cn  Staff only."); return; }

    const all = await npcs.all();
    if (!all.length) { u.send("%ch+npc/list:%cn  No NPCs tracked yet. Use +npc/create <name>."); return; }

    const lines = [
      `%ch--- NPCs (${all.length}) -------------------------------------%cn`,
      ...all.map(npcLine),
    ];
    u.send(lines.join("\n"));
  },
});

// --- +npc/view <name> ---------------------------------------------------------

addCmd({
  name: "+npc/view",
  category: "Urban Shadows",
  help: "+npc/view <name>  —  [Staff] View NPC details.",
  pattern: /^\+npc\/view\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/view:%cn  Staff only."); return; }

    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/view:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    const count = markedHarmCount(npc.harm);
    const incap = isIncapacitated(npc.harm) ? " %ch%cr— INCAPACITATED%cn" : "";
    const lines = [
      `%ch--- NPC: ${npc.name} ---------------------------------%cn`,
      `  ID:     ${npc.id.slice(0, 8)}`,
      npc.circle ? `  Circle: %ch${npc.circle}%cn` : `  Circle: %cx(none)%cn`,
      `  Harm:   ${harmBar(npc.harm.boxes)}  (${count}/5)${incap}`,
      `  Armor:  %ch${npc.harm.armor}%cn`,
      npc.notes ? `  Notes:  ${npc.notes}` : `  Notes:  %cx(none)%cn`,
    ];
    u.send(lines.join("\n"));
  },
});

// --- +npc/harm <name> ---------------------------------------------------------

addCmd({
  name: "+npc/harm",
  category: "Urban Shadows",
  help: "+npc/harm <name>  —  [Staff] Mark 1 Harm on an NPC.",
  pattern: /^\+npc\/harm\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/harm:%cn  Staff only."); return; }

    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/harm:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    let noChange = false;
    const result = await npcs.atomicModify(npc.id, (current: INPC) => {
      const updated = markHarm(current.harm);
      if (!updated) { noChange = true; return current; }
      return { ...current, harm: updated, updatedAt: Date.now() };
    });

    if (noChange) {
      u.send(`%ch+npc/harm:%cn  ${npc.name} is already incapacitated.`);
      return;
    }

    const count = markedHarmCount(result.harm);
    const incap = isIncapacitated(result.harm) ? " %ch%cr— INCAPACITATED!%cn" : "";
    u.send(`%ch+npc/harm:%cn  %ch${result.name}%cn  ${harmBar(result.harm.boxes)}  (${count}/5)${incap}`);
  },
});

// --- +npc/heal <name> [n] -----------------------------------------------------

addCmd({
  name: "+npc/heal",
  category: "Urban Shadows",
  help: "+npc/heal <name> [n]  —  [Staff] Heal n Harm boxes on an NPC (default 1).",
  pattern: /^\+npc\/heal\s+(.+?)(?:\s+(\d+))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/heal:%cn  Staff only."); return; }

    const count = Math.min(parseInt(u.cmd.args[1] ?? "1", 10) || 1, HARM_MAX);
    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/heal:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    let beforeCount = 0;
    const result = await npcs.atomicModify(npc.id, (current: INPC) => {
      beforeCount = markedHarmCount(current.harm);
      return { ...current, harm: healHarm(current.harm, count), updatedAt: Date.now() };
    });

    const remaining = markedHarmCount(result.harm);
    const actualHealed = beforeCount - remaining;
    u.send(`%ch+npc/heal:%cn  %ch${result.name}%cn  Healed ${actualHealed}. ${harmBar(result.harm.boxes)}  (${remaining}/5)`);
  },
});

// --- +npc/armor <name>=<value> ------------------------------------------------

addCmd({
  name: "+npc/armor",
  category: "Urban Shadows",
  help: "+npc/armor <name>=<0-3>  —  [Staff] Set an NPC's Armor value.",
  pattern: /^\+npc\/armor\s+(.+?)=(\d+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/armor:%cn  Staff only."); return; }

    const value = parseInt(u.cmd.args[1] ?? "0", 10);
    if (value < 0 || value > ARMOR_MAX) {
      u.send(`%ch+npc/armor:%cn  Armor must be 0–${ARMOR_MAX}. Got ${value}.`);
      return;
    }

    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/armor:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    const result = await npcs.atomicModify(npc.id, (current: INPC) => ({
      ...current,
      harm: { ...current.harm, armor: value },
      updatedAt: Date.now(),
    }));

    u.send(`%ch+npc/armor:%cn  %ch${result.name}%cn  Armor set to %ch${result.harm.armor}%cn.`);
  },
});

// --- +npc/circle <name>=<circle> ---------------------------------------------

addCmd({
  name: "+npc/circle",
  category: "Urban Shadows",
  help: "+npc/circle <name>=<circle>  —  [Staff] Set an NPC's circle affiliation.",
  pattern: /^\+npc\/circle\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/circle:%cn  Staff only."); return; }

    const circle = (u.cmd.args[1] ?? "").trim().toLowerCase();
    if (circle.length > 50) { u.send("%ch+npc/circle:%cn  Circle name too long."); return; }

    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/circle:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    const result = await npcs.atomicModify(npc.id, (current: INPC) => ({
      ...current,
      circle: circle || undefined,
      updatedAt: Date.now(),
    }));

    u.send(`%ch+npc/circle:%cn  %ch${result.name}%cn  Circle set to %ch${result.circle ?? "(none)"}%cn.`);
  },
});

// --- +npc/note <name>=<text> --------------------------------------------------

addCmd({
  name: "+npc/note",
  category: "Urban Shadows",
  help: "+npc/note <name>=<text>  —  [Staff] Set notes on an NPC.",
  pattern: /^\+npc\/note\s+(.+?)=(.*)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/note:%cn  Staff only."); return; }

    const notes = (u.cmd.args[1] ?? "").trim();
    if (notes.length > 2000) { u.send("%ch+npc/note:%cn  Notes cannot exceed 2000 characters."); return; }

    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/note:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    await npcs.atomicModify(npc.id, (current: INPC) => ({
      ...current,
      notes,
      updatedAt: Date.now(),
    }));

    u.send(`%ch+npc/note:%cn  Notes updated for %ch${npc.name}%cn.`);
  },
});

// --- +npc/del <name> ----------------------------------------------------------

addCmd({
  name: "+npc/del",
  category: "Urban Shadows",
  help: "+npc/del <name>  —  [Staff] Delete an NPC.",
  pattern: /^\+npc\/del\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) { u.send("%ch+npc/del:%cn  Staff only."); return; }

    const npc = await findNPC((u.cmd.args[0] ?? "").trim());
    if (!npc) { u.send(`%ch+npc/del:%cn  No NPC found for '${u.cmd.args[0]}'.`); return; }

    await npcs.delete({ id: npc.id } as Parameters<typeof npcs.delete>[0]);
    u.send(`%ch+npc/del:%cn  Deleted NPC: %ch${npc.name}%cn.`);
  },
});
