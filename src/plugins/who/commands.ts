import { addCmd } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { getPlaybook } from "../playbooks/data.ts";
import {
  markedHarmCount,
  isIncapacitated,
  HARM_MAX,
  CORRUPTION_MARKS_MAX,
} from "../tracker/logic.ts";
import type { ICharSheet } from "../playbooks/schema.ts";

const H = "%ch"; const N = "%cn"; const R = "%cr"; const DIM = "%cx";

function sign(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }

// --- +who --------------------------------------------------------------------

addCmd({
  name: "+who",
  category: "Urban Shadows",
  help: "+who  —  List all approved characters.",
  pattern: /^\+who$/i,
  exec: async (u) => {
    const all = await sheets.all() as ICharSheet[];
    const approved = all
      .filter((s) => s.status === "approved")
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!approved.length) {
      u.send("%ch+who:%cn  No approved characters yet.");
      return;
    }

    const lines = [
      `${H}--- Active Characters (${approved.length}) ----------------------------${N}`,
    ];
    for (const s of approved) {
      const pb = getPlaybook(s.playbookId);
      const harm = markedHarmCount(s.harm);
      const incapFlag = isIncapacitated(s.harm) ? ` ${R}${H}[INCAP]${N}` : "";
      lines.push(
        `  ${H}${s.name}${N}  ${DIM}(${pb?.name ?? s.playbookId})${N}` +
        `  Harm: ${harm}/${HARM_MAX}${incapFlag}  Corr: ${s.corruption.marks}/${CORRUPTION_MARKS_MAX}`,
      );
    }
    u.send(lines.join("\n"));
  },
});

// --- +who/view <name> --------------------------------------------------------

addCmd({
  name: "+who/view",
  category: "Urban Shadows",
  help: "+who/view <name>  —  View a character's public info.",
  pattern: /^\+who\/view\s+(.+)$/i,
  exec: async (u) => {
    const query = (u.cmd.args[0] ?? "").trim().toLowerCase();
    const all = await sheets.all() as ICharSheet[];
    const sheet = all.find(
      (s) => s.status === "approved" && s.name.toLowerCase().startsWith(query),
    );

    if (!sheet) {
      u.send(`%ch+who/view:%cn  No approved character found for '${u.cmd.args[0]}'.`);
      return;
    }

    const pb = getPlaybook(sheet.playbookId);
    const harm = markedHarmCount(sheet.harm);
    const incapFlag = isIncapacitated(sheet.harm) ? ` ${R}${H}[INCAPACITATED]${N}` : "";
    const cs = sheet.circleStatus;

    u.send([
      `${H}--- ${sheet.name} ------------------------------------------${N}`,
      `  Playbook:   ${H}${pb?.name ?? sheet.playbookId}${N}`,
      `  Harm:       ${harm}/${HARM_MAX}${incapFlag}`,
      `  Corruption: ${sheet.corruption.marks}/${CORRUPTION_MARKS_MAX}`,
      `  Circles:    mortalis ${sign(cs.mortalis)}  night ${sign(cs.night)}  power ${sign(cs.power)}  wild ${sign(cs.wild)}`,
    ].join("\n"));
  },
});
