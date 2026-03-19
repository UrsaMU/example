import { addCmd } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { getPlaybook } from "../playbooks/data.ts";
import {
  ARMOR_MAX,
  clearCorruptionMarks,
  CORRUPTION_MARKS_MAX,
  HARM_MAX,
  healHarm,
  isIncapacitated,
  markCorruption,
  markedHarmCount,
  markHarm,
  setArmor,
  takeCorruptionAdvance,
} from "./logic.ts";
import { getNextJobNumber, jobHooks, jobs } from "ursamu/jobs";
import type { ICharSheet } from "../playbooks/schema.ts";
import type { IJob } from "ursamu/jobs";

// --- Job helpers --------------------------------------------------------------

async function fileIncapacitatedJob(sheet: ICharSheet): Promise<IJob> {
  const pb = getPlaybook(sheet.playbookId);
  const number = await getNextJobNumber();
  const now = Date.now();
  const job: IJob = {
    id: `job-${number}`,
    number,
    title: `Incapacitated: ${sheet.name}`,
    category: "request",
    priority: "critical",
    status: "new",
    submittedBy: sheet.playerId,
    submitterName: sheet.name,
    description: [
      `**${sheet.name}** (${
        pb?.name ?? sheet.playbookId
      }) has taken their 5th harm and is now incapacitated.`,
      ``,
      `This requires immediate MC attention — determine consequences (death, capture, bargain, etc.).`,
    ].join("\n"),
    comments: [],
    staffOnly: false,
    createdAt: now,
    updatedAt: now,
  };
  await jobs.create(job);
  await jobHooks.emit("job:created", job);
  return job;
}

async function fileCorruptionAdvanceJob(
  sheet: ICharSheet,
  advanceName: string,
): Promise<IJob> {
  const pb = getPlaybook(sheet.playbookId);
  const number = await getNextJobNumber();
  const now = Date.now();
  const job: IJob = {
    id: `job-${number}`,
    number,
    title: `Corruption Advance: ${sheet.name} — ${advanceName}`,
    category: "advance",
    priority: "high",
    status: "new",
    submittedBy: sheet.playerId,
    submitterName: sheet.name,
    description: [
      `**${sheet.name}** (${
        pb?.name ?? sheet.playbookId
      }) filled their corruption track and took a corruption advance: **${advanceName}**`,
      ``,
      `Total corruption advances: ${sheet.corruption.advances.length + 1}`,
      ``,
      `Introduce narrative consequences as appropriate.`,
    ].join("\n"),
    comments: [],
    staffOnly: false,
    createdAt: now,
    updatedAt: now,
  };
  await jobs.create(job);
  await jobHooks.emit("job:created", job);
  return job;
}

// --- Helpers ------------------------------------------------------------------

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function harmBar(boxes: boolean[]): string {
  return boxes.map((b) => b ? "%ch%cr[X]%cn" : "[_]").join("");
}

function corruptionDots(marks: number, max = 5): string {
  return Array.from(
    { length: max },
    (_, i) => i < marks ? "%ch%cy(*)%cn" : "( )",
  ).join("");
}

function harmDisplay(sheet: ICharSheet): string {
  const count = markedHarmCount(sheet.harm);
  const incap = isIncapacitated(sheet.harm) ? " %ch%cr— INCAPACITATED%cn" : "";
  const lines = [
    `%ch--- Harm & Armor ------------------------------------%cn`,
    `  Harm:   ${harmBar(sheet.harm.boxes)}  (${count}/5)${incap}`,
    `  Armor:  %ch${sheet.harm.armor}%cn`,
    `%ch--- Corruption -------------------------------------%cn`,
    `  Marks:  ${
      corruptionDots(sheet.corruption.marks)
    }  (${sheet.corruption.marks}/5)`,
  ];

  if (sheet.corruption.advances.length) {
    lines.push(
      `  Advances: ${
        sheet.corruption.advances.map((a) => `%ch${a}%cn`).join(", ")
      }`,
    );
  }

  return lines.join("\n");
}

async function getApprovedSheet(
  u: { me: { id: string }; send(msg: string): void },
): Promise<ICharSheet | null> {
  const sheet = await sheets.queryOne(
    { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
  );
  if (!sheet) {
    u.send("%ch+harm:%cn  No character sheet found.");
    return null;
  }
  if (sheet.status !== "approved") {
    u.send("%ch+harm:%cn  Your sheet must be approved before tracking harm.");
    return null;
  }
  return sheet as ICharSheet;
}

// --- +harm --------------------------------------------------------------------
//  Show my harm track and corruption.

addCmd({
  name: "+harm",
  category: "Urban Shadows",
  help: "+harm  —  View your Harm track and Corruption.",
  pattern: /^\+harm$/i,
  exec: async (u) => {
    const sheet = await getApprovedSheet(u);
    if (!sheet) return;
    u.send(harmDisplay(sheet));
  },
});

// --- +harm/mark ---------------------------------------------------------------
//  Mark a harm box (MC-initiated, or player in certain moves).

addCmd({
  name: "+harm/mark",
  category: "Urban Shadows",
  help: "+harm/mark [<player>]  —  Mark a Harm box. Defaults to yourself.",
  pattern: /^\+harm\/mark(?:\s+(.+))?$/i,
  exec: async (u) => {
    const targetName = (u.cmd.args[0] ?? "").trim();
    let targetId = u.me.id;

    if (targetName && !isStaff(u)) {
      u.send("%ch+harm/mark:%cn  Only staff can mark harm on others.");
      return;
    }

    if (targetName) {
      const player = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!player) {
        u.send(`%ch+harm/mark:%cn  No sheet found for '${targetName}'.`);
        return;
      }
      targetId = player.id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet) {
      u.send("%ch+harm/mark:%cn  No approved sheet found.");
      return;
    }
    if (sheet.status !== "approved") {
      u.send("%ch+harm/mark:%cn  Sheet must be approved.");
      return;
    }

    let noChange = false;
    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => {
        const updated = markHarm(current.harm);
        if (!updated) {
          noChange = true;
          return current;
        }
        return { ...current, harm: updated, updatedAt: Date.now() };
      },
    );

    if (noChange) {
      u.send(
        "%ch+harm/mark:%cn  All harm boxes are already marked (incapacitated).",
      );
      return;
    }

    const count = markedHarmCount(result.harm);
    const incap = isIncapacitated(result.harm)
      ? " %ch%cr— INCAPACITATED!%cn"
      : "";
    u.send(
      `%ch+harm/mark:%cn  Harm marked. ${
        harmBar(result.harm.boxes)
      }  (${count}/5)${incap}`,
    );

    if (isIncapacitated(result.harm)) {
      const job = await fileIncapacitatedJob(result);
      u.send(
        `%ch+harm/mark:%cn  %cr%chStaff notified of incapacitation (Job #${job.number}).%cn`,
      );
    }
  },
});

// --- +harm/heal [<n>] ---------------------------------------------------------
//  Heal n harm boxes (MC/staff or player via move).

addCmd({
  name: "+harm/heal",
  category: "Urban Shadows",
  help: "+harm/heal [<n>] [<player>]  —  Heal Harm boxes. Default: 1.",
  pattern: /^\+harm\/heal(?:\s+(\d+))?(?:\s+(.+))?$/i,
  exec: async (u) => {
    const count = Math.min(parseInt(u.cmd.args[0] ?? "1", 10) || 1, HARM_MAX);
    const targetName = (u.cmd.args[1] ?? "").trim();
    let targetId = u.me.id;

    if (targetName) {
      if (!isStaff(u)) {
        u.send("%ch+harm/heal:%cn  Only staff can heal others.");
        return;
      }
      const player = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!player) {
        u.send(`%ch+harm/heal:%cn  No sheet found for '${targetName}'.`);
        return;
      }
      targetId = (player as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+harm/heal:%cn  No approved sheet found.");
      return;
    }

    let beforeCount = 0;
    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => {
        beforeCount = markedHarmCount(current.harm);
        return {
          ...current,
          harm: healHarm(current.harm, count),
          updatedAt: Date.now(),
        };
      },
    );

    const remaining = markedHarmCount(result.harm);
    const actualHealed = beforeCount - remaining;
    u.send(
      `%ch+harm/heal:%cn  Healed ${actualHealed} box(es). ${
        harmBar(result.harm.boxes)
      }  (${remaining}/5)`,
    );
  },
});

// --- +harm/armor <n> ----------------------------------------------------------
//  Set armor value (0–3). Staff can set for others.

addCmd({
  name: "+harm/armor",
  category: "Urban Shadows",
  help: "+harm/armor <0-3>  —  Set your Armor value.",
  pattern: /^\+harm\/armor\s+(\d+)(?:\s+(.+))?$/i,
  exec: async (u) => {
    const value = parseInt(u.cmd.args[0] ?? "0", 10);
    if (value < 0 || value > ARMOR_MAX) {
      u.send(`%ch+harm/armor:%cn  Value must be 0–${ARMOR_MAX}. Got ${value}.`);
      return;
    }

    const targetName = (u.cmd.args[1] ?? "").trim();
    let targetId = u.me.id;

    if (targetName) {
      if (!isStaff(u)) {
        u.send("%ch+harm/armor:%cn  Only staff can set armor on others.");
        return;
      }
      const player = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!player) {
        u.send(`%ch+harm/armor:%cn  No sheet found for '${targetName}'.`);
        return;
      }
      targetId = (player as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+harm/armor:%cn  No approved sheet found.");
      return;
    }

    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => ({
        ...current,
        harm: setArmor(current.harm, value),
        updatedAt: Date.now(),
      }),
    );

    u.send(`%ch+harm/armor:%cn  Armor set to %ch${result.harm.armor}%cn.`);
  },
});

// --- +corruption/mark ---------------------------------------------------------
//  Mark one corruption point.

addCmd({
  name: "+corruption/mark",
  category: "Urban Shadows",
  help: "+corruption/mark [<player>]  —  Mark a Corruption point.",
  pattern: /^\+corruption\/mark(?:\s+(.+))?$/i,
  exec: async (u) => {
    const targetName = (u.cmd.args[0] ?? "").trim();
    let targetId = u.me.id;

    if (targetName) {
      if (!isStaff(u)) {
        u.send(
          "%ch+corruption/mark:%cn  Only staff can mark corruption on others.",
        );
        return;
      }
      const player = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!player) {
        u.send(`%ch+corruption/mark:%cn  No sheet for '${targetName}'.`);
        return;
      }
      targetId = (player as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+corruption/mark:%cn  No approved sheet found.");
      return;
    }

    let advanceTriggered = false;
    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => {
        const { corruption: updated, advanceTriggered: triggered } =
          markCorruption(current.corruption);
        advanceTriggered = triggered;
        return { ...current, corruption: updated, updatedAt: Date.now() };
      },
    );

    if (advanceTriggered) {
      u.send(
        `%ch+corruption/mark:%cn  ${
          corruptionDots(result.corruption.marks)
        } — ` +
          `%ch%cr5 marks! Take a Corruption advance with +corruption/take <advance name>.%cn`,
      );
    } else {
      u.send(
        `%ch+corruption/mark:%cn  ${
          corruptionDots(result.corruption.marks)
        }  (${result.corruption.marks}/5)`,
      );
    }
  },
});

// --- +corruption/take <advance> -----------------------------------------------
//  Record a corruption advance (after filling 5 marks).

addCmd({
  name: "+corruption/take",
  category: "Urban Shadows",
  help: "+corruption/take <advance name>  —  Record a Corruption advance.",
  pattern: /^\+corruption\/take\s+(.+)$/i,
  exec: async (u) => {
    const advanceName = (u.cmd.args[0] ?? "").trim();
    if (!advanceName) {
      u.send("%ch+corruption/take:%cn  Usage: +corruption/take <advance name>");
      return;
    }
    if (advanceName.length > 100) {
      u.send(
        "%ch+corruption/take:%cn  Advance name cannot exceed 100 characters.",
      );
      return;
    }

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+corruption/take:%cn  No approved sheet found.");
      return;
    }

    if (sheet.corruption.marks < CORRUPTION_MARKS_MAX) {
      u.send(
        `%ch+corruption/take:%cn  Your corruption track isn't full yet ` +
          `(${sheet.corruption.marks}/${CORRUPTION_MARKS_MAX}). ` +
          `Use %ch+corruption/mark%cn to fill it first.`,
      );
      return;
    }

    const result = await sheets.atomicModify(u.me.id, (current: ICharSheet) => {
      if (current.corruption.marks < CORRUPTION_MARKS_MAX) return current;
      return {
        ...current,
        corruption: takeCorruptionAdvance(current.corruption, advanceName),
        updatedAt: Date.now(),
      };
    });

    u.send(
      `%ch+corruption/take:%cn  Corruption advance recorded: %ch${advanceName}%cn. Marks reset.`,
    );

    const job = await fileCorruptionAdvanceJob(result, advanceName);
    u.send(
      `%ch+corruption/take:%cn  %cy%chStaff notified (Job #${job.number}).%cn`,
    );
  },
});

// --- +corruption/clear --------------------------------------------------------
//  Staff: clear all corruption marks (without taking an advance).

addCmd({
  name: "+corruption/clear",
  category: "Urban Shadows",
  help: "+corruption/clear [<player>]  —  [Staff] Clear all Corruption marks.",
  pattern: /^\+corruption\/clear(?:\s+(.+))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+corruption/clear:%cn  Staff only.");
      return;
    }

    const targetName = (u.cmd.args[0] ?? "").trim();
    let targetId = u.me.id;

    if (targetName) {
      const player = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!player) {
        u.send(`%ch+corruption/clear:%cn  No sheet for '${targetName}'.`);
        return;
      }
      targetId = (player as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet) {
      u.send("%ch+corruption/clear:%cn  No sheet found.");
      return;
    }

    await sheets.atomicModify(targetId, (current: ICharSheet) => ({
      ...current,
      corruption: clearCorruptionMarks(current.corruption),
      updatedAt: Date.now(),
    }));

    u.send(`%ch+corruption/clear:%cn  Corruption marks cleared.`);
  },
});
