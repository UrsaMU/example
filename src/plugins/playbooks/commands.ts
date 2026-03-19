import { addCmd } from "ursamu/app";
import { dbojs } from "ursamu";
import { sheets } from "./db.ts";
import { getPlaybook, listPlaybooks } from "./data.ts";
import { fileChargenJob } from "./jobs-integration.ts";
import { jobHooks, jobs } from "ursamu/jobs";
import type { ICharSheet, IDebt } from "./schema.ts";
import type { IJob } from "ursamu/jobs";

// --- Helpers ------------------------------------------------------------------

const H = "%ch";
const N = "%cn";
const Y = "%cy";
const G = "%cg";
const R = "%cr";
const DIM = "%cx";

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function bar(width = 60): string {
  return `${H}${"-".repeat(width)}${N}`;
}

/** Fetch the current user's sheet; send an error and return null if missing. */
async function mySheet(
  u: { me: { id: string }; send(m: string): void },
): Promise<ICharSheet | null> {
  const sheet = await sheets.queryOne(
    { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
  );
  if (!sheet) {
    u.send(
      `${H}+chargen:${N}  No sheet yet. Use %ch+chargen/start <playbook>${N} to begin.`,
    );
    return null;
  }
  return sheet as ICharSheet;
}

/** Full sheet display. */
function renderSheet(sheet: ICharSheet): string {
  const pb = getPlaybook(sheet.playbookId)!;
  const lines: string[] = [];

  lines.push(bar());
  lines.push(
    `  ${H}${sheet.name || "(unnamed)"}${N}` +
      `  ${DIM}[${sheet.playbookId}]${N}` +
      `  Status: ${
        sheet.status === "approved"
          ? `${G}${H}approved${N}`
          : sheet.status === "pending"
          ? `${Y}${H}pending review${N}`
          : sheet.status === "rejected"
          ? `${R}${H}rejected${N}`
          : `${DIM}draft${N}`
      }`,
  );

  // Identity
  lines.push(bar());
  lines.push(`  ${H}Look:${N}      ${sheet.look || `${DIM}(not set)${N}`}`);
  lines.push(
    `  ${H}Demeanor:${N} ${
      sheet.demeanor ||
      `${DIM}(not set — options: ${pb.demeanors.join(", ")})${N}`
    }`,
  );

  // Stats
  lines.push(bar());
  lines.push(
    `  ${H}Stats${N}  (boost one by +1 with ${H}+chargen/stat <stat>${N})`,
  );
  const statKeys = ["blood", "heart", "mind", "spirit"] as const;
  const statLine = statKeys.map((k) => {
    const boosted = sheet.stats[k] !== pb.baseStats[k];
    return `  ${boosted ? `${G}${H}` : ""}${k} ${sign(sheet.stats[k])}${
      boosted ? N : ""
    }`;
  });
  lines.push(statLine.join("   "));

  // Circle ratings
  lines.push(bar());
  lines.push(
    `  ${H}Circle Ratings${N}  (boost one with ${H}+chargen/circle <circle>${N})`,
  );
  const circleKeys = ["mortalis", "night", "power", "wild"] as const;
  const circleLine = circleKeys.map((k) => {
    const boosted = sheet.circleRatings[k] !== pb.circleRatings[k];
    return `  ${boosted ? `${G}${H}` : ""}${k} ${sign(sheet.circleRatings[k])}${
      boosted ? N : ""
    }`;
  });
  lines.push(circleLine.join("   "));

  // Starting circle status (read-only during chargen)
  const cs = sheet.circleStatus;
  lines.push(
    `  ${DIM}Circle Status (from playbook): mortalis ${
      sign(cs.mortalis)
    }  night ${sign(cs.night)}  power ${sign(cs.power)}  wild ${
      sign(cs.wild)
    }${N}`,
  );

  // Moves
  lines.push(bar());
  lines.push(
    `  ${H}Moves${N}  (${sheet.selectedMoves.length}/${pb.moveCount} selected — use ${H}+chargen/moves${N} to see all)`,
  );
  for (const id of sheet.selectedMoves) {
    const move = pb.moves.find((m) => m.id === id);
    lines.push(`  ${G}(*)${N} ${H}${move?.name ?? id}${N}`);
  }

  // Gear
  lines.push(bar());
  lines.push(
    `  ${H}Gear:${N} ${
      sheet.gear.length
        ? sheet.gear.join(", ")
        : `${DIM}(not set — use +chargen/gear <items>)${N}`
    }`,
  );

  // Intro answers
  lines.push(bar());
  lines.push(
    `  ${H}Intro Questions${N}  (use ${H}+chargen/answer <question>=<answer>${N})`,
  );
  for (const q of pb.introQuestions) {
    const ans = sheet.introAnswers[q];
    lines.push(`  ${DIM}Q:${N} ${q}`);
    lines.push(`    ${ans ? ans : `${R}(unanswered)${N}`}`);
  }

  // Debts
  lines.push(bar());
  lines.push(
    `  ${H}Debts${N}  (${sheet.debts.length}/${pb.startingDebts.length} required)`,
  );
  sheet.debts.forEach((d, i) => {
    const dir = d.direction === "owed"
      ? `${G}[owes me]${N}`
      : `${Y}[I owe]${N}`;
    lines.push(`  ${i + 1}. ${dir} ${H}${d.to}${N} — ${d.description}`);
  });
  if (!sheet.debts.length) lines.push(`  ${DIM}None recorded yet.${N}`);

  // Notes
  if (sheet.notes) {
    lines.push(bar());
    lines.push(`  ${H}Notes:${N} ${sheet.notes}`);
  }

  // Rejection reason
  if (sheet.status === "rejected" && sheet.rejectionReason) {
    lines.push(bar());
    lines.push(`  ${R}${H}Rejected:${N} ${sheet.rejectionReason}`);
  }

  // Checklist
  lines.push(bar());
  const problems = validateSheetLocal(sheet);
  if (problems.length === 0) {
    lines.push(`  ${G}${H}Sheet complete! Use +chargen/submit when ready.${N}`);
  } else {
    lines.push(`  ${Y}${H}Incomplete — ${problems.length} issue(s):${N}`);
    for (const p of problems) lines.push(`  ${R}-${N} ${p}`);
  }
  lines.push(bar());

  return lines.join("\n");
}

/** Inline copy of validation logic so we can show checklist without the REST layer. */
function validateSheetLocal(sheet: ICharSheet): string[] {
  const problems: string[] = [];
  const pb = getPlaybook(sheet.playbookId);
  if (!pb) return ["Unknown playbook"];

  if (!sheet.name.trim()) problems.push("name is required");
  if (!sheet.look.trim()) problems.push("look is required");
  if (!pb.demeanors.includes(sheet.demeanor)) {
    problems.push("choose a demeanor");
  }

  const statKeys = ["blood", "heart", "mind", "spirit"] as const;
  const boosted =
    statKeys.filter((k) => sheet.stats[k] !== pb.baseStats[k]).length;
  if (boosted === 0) problems.push("boost one stat by +1");
  if (boosted > 1) problems.push("only one stat may be boosted");

  const circleKeys = ["mortalis", "night", "power", "wild"] as const;
  const circBoosted =
    circleKeys.filter((k) => sheet.circleRatings[k] !== pb.circleRatings[k])
      .length;
  if (circBoosted === 0) problems.push("boost one circle rating by +1");
  if (circBoosted > 1) problems.push("only one circle rating may be boosted");

  const requiredMoves = pb.moves.filter((m) => m.required).map((m) => m.id);
  for (const id of requiredMoves) {
    if (!sheet.selectedMoves.includes(id)) {
      problems.push(`required move missing: ${id}`);
    }
  }
  if (sheet.selectedMoves.length !== pb.moveCount) {
    problems.push(
      `select exactly ${pb.moveCount} move(s) (have ${sheet.selectedMoves.length})`,
    );
  }

  if (!sheet.gear.length) problems.push("fill in your gear");

  for (const q of pb.introQuestions) {
    if (!sheet.introAnswers[q]?.trim()) problems.push(`unanswered: "${q}"`);
  }

  if (sheet.debts.length < pb.startingDebts.length) {
    problems.push(
      `add ${
        pb.startingDebts.length - sheet.debts.length
      } more starting debt(s)`,
    );
  }
  for (let i = 0; i < sheet.debts.length; i++) {
    const d = sheet.debts[i];
    if (!d.to?.trim()) problems.push(`debt ${i + 1}: 'to' is required`);
    if (!d.description?.trim()) {
      problems.push(`debt ${i + 1}: description required`);
    }
  }

  for (const def of pb.featureDefs) {
    if (!def.required) continue;
    const val = sheet.features[def.key];
    if (
      val === undefined || val === null || val === "" ||
      (Array.isArray(val) && !val.length)
    ) {
      problems.push(`feature required: ${def.label}`);
    }
  }

  return problems;
}

// --- +chargen -----------------------------------------------------------------
//  View your current sheet and checklist.

addCmd({
  name: "+chargen",
  category: "Urban Shadows",
  help: "+chargen  —  View your character sheet and chargen checklist.",
  pattern: /^\+chargen$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet) return;
    u.send(renderSheet(sheet));
  },
});

// --- +chargen/start <playbook> ------------------------------------------------
//  Begin chargen by picking a playbook. Also lists playbooks if no arg given.

addCmd({
  name: "+chargen/start",
  category: "Urban Shadows",
  help:
    "+chargen/start <playbook>  —  Begin chargen with a playbook. Omit to list options.",
  pattern: /^\+chargen\/start(?:\s+(.+))?$/i,
  exec: async (u) => {
    const arg = (u.cmd.args[0] ?? "").trim().toLowerCase();

    if (!arg) {
      // List all playbooks
      const all = listPlaybooks();
      const lines = [
        bar(),
        `  ${H}Available Playbooks${N}  (use ${H}+chargen/start <id>${N})`,
        bar(),
        ...all.map((pb) =>
          `  ${H}${pb.id.padEnd(18)}${N} ${pb.name}  ${DIM}${
            pb.tagline.slice(0, 55)
          }...${N}`
        ),
        bar(),
      ];
      u.send(lines.join("\n"));
      return;
    }

    const pb = getPlaybook(arg);
    if (!pb) {
      u.send(
        `${H}+chargen/start:${N}  Unknown playbook '${arg}'. Use ${H}+chargen/start${N} to list options.`,
      );
      return;
    }

    const existing = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    );
    if (existing && (existing as ICharSheet).status !== "rejected") {
      u.send(
        `${H}+chargen/start:${N}  You already have a sheet (${
          (existing as ICharSheet).status
        }). Use ${H}+chargen/reset${N} to start over.`,
      );
      return;
    }

    const player = await dbojs.queryOne({ id: u.me.id });
    const playerName =
      ((player?.data as Record<string, unknown>)?.name as string) ||
      (u.me.name ?? u.me.id);
    const now = Date.now();

    const sheet: ICharSheet = {
      id: u.me.id,
      playerId: u.me.id,
      playbookId: pb.id,
      status: "draft",
      name: playerName,
      look: "",
      demeanor: "",
      stats: { ...pb.baseStats },
      circleRatings: { ...pb.circleRatings },
      circleStatus: { ...pb.circleStatus },
      harm: { boxes: [false, false, false, false, false], armor: 0 },
      corruption: { marks: 0, advances: [] },
      selectedMoves: pb.moves.filter((m) => m.required).map((m) => m.id),
      gear: [],
      features: {},
      introAnswers: {},
      debts: [],
      notes: "",
      xp: 0,
      takenAdvances: [],
      createdAt: now,
      updatedAt: now,
    };

    await sheets.create(sheet);
    u.send(
      `${H}+chargen/start:${N}  Sheet created for ${H}${pb.name}${N}.\n${
        renderSheet(sheet)
      }`,
    );
  },
});

// --- +chargen/name <name> -----------------------------------------------------

addCmd({
  name: "+chargen/name",
  category: "Urban Shadows",
  help: "+chargen/name <name>  —  Set your character's name.",
  pattern: /^\+chargen\/name\s+(.+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const name = (u.cmd.args[0] ?? "").trim();
    if (!name) {
      u.send(`${H}+chargen/name:${N}  Name cannot be blank.`);
      return;
    }
    if (name.length > 100) {
      u.send(`${H}+chargen/name:${N}  Name cannot exceed 100 characters.`);
      return;
    }
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { name, updatedAt: Date.now() },
    );
    u.send(`${H}+chargen/name:${N}  Name set to ${H}${name}${N}.`);
  },
});

// --- +chargen/look <look> -----------------------------------------------------

addCmd({
  name: "+chargen/look",
  category: "Urban Shadows",
  help: "+chargen/look <description>  —  Describe your character's appearance.",
  pattern: /^\+chargen\/look\s+(.+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const look = (u.cmd.args[0] ?? "").trim();
    if (look.length > 1000) {
      u.send(`${H}+chargen/look:${N}  Look cannot exceed 1000 characters.`);
      return;
    }
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { look, updatedAt: Date.now() },
    );
    u.send(`${H}+chargen/look:${N}  Look set.`);
  },
});

// --- +chargen/demeanor <demeanor> ---------------------------------------------

addCmd({
  name: "+chargen/demeanor",
  category: "Urban Shadows",
  help:
    "+chargen/demeanor <demeanor>  —  Choose a demeanor from your playbook's list.",
  pattern: /^\+chargen\/demeanor\s+(\S+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const pb = getPlaybook(sheet.playbookId)!;
    const demeanor = (u.cmd.args[0] ?? "").trim().toLowerCase();
    if (!pb.demeanors.includes(demeanor)) {
      u.send(
        `${H}+chargen/demeanor:${N}  Invalid. Choose from: ${
          pb.demeanors.join(", ")
        }`,
      );
      return;
    }
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { demeanor, updatedAt: Date.now() },
    );
    u.send(`${H}+chargen/demeanor:${N}  Demeanor set to ${H}${demeanor}${N}.`);
  },
});

// --- +chargen/stat <stat> -----------------------------------------------------
//  Apply your +1 stat boost. Can re-run to change choice before submit.

addCmd({
  name: "+chargen/stat",
  category: "Urban Shadows",
  help: "+chargen/stat <blood|heart|mind|spirit>  —  Apply your +1 stat boost.",
  pattern: /^\+chargen\/stat\s+(\S+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const pb = getPlaybook(sheet.playbookId)!;
    const stat = (u.cmd.args[0] ?? "").trim()
      .toLowerCase() as keyof typeof pb.baseStats;
    const valid = ["blood", "heart", "mind", "spirit"] as const;
    if (!(valid as readonly string[]).includes(stat)) {
      u.send(
        `${H}+chargen/stat:${N}  Unknown stat. Choose from: ${
          valid.join(", ")
        }`,
      );
      return;
    }
    // Reset all stats to base, then apply boost to chosen stat
    const stats = { ...pb.baseStats, [stat]: pb.baseStats[stat] + 1 };
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { stats, updatedAt: Date.now() },
    );
    u.send(
      `${H}+chargen/stat:${N}  ${H}${stat}${N} boosted to ${G}${H}${
        sign(stats[stat])
      }${N}. Other stats reset to base.`,
    );
  },
});

// --- +chargen/circle <circle> -------------------------------------------------
//  Apply your +1 circle rating boost.

addCmd({
  name: "+chargen/circle",
  category: "Urban Shadows",
  help:
    "+chargen/circle <mortalis|night|power|wild>  —  Apply your +1 circle rating boost.",
  pattern: /^\+chargen\/circle\s+(\S+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const pb = getPlaybook(sheet.playbookId)!;
    const circle = (u.cmd.args[0] ?? "").trim()
      .toLowerCase() as keyof typeof pb.circleRatings;
    const valid = ["mortalis", "night", "power", "wild"] as const;
    if (!(valid as readonly string[]).includes(circle)) {
      u.send(
        `${H}+chargen/circle:${N}  Unknown circle. Choose from: ${
          valid.join(", ")
        }`,
      );
      return;
    }
    const circleRatings = {
      ...pb.circleRatings,
      [circle]: pb.circleRatings[circle] + 1,
    };
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { circleRatings, updatedAt: Date.now() },
    );
    u.send(
      `${H}+chargen/circle:${N}  ${H}${circle}${N} rating boosted to ${G}${H}${
        sign(circleRatings[circle])
      }${N}.`,
    );
  },
});

// --- +chargen/moves -----------------------------------------------------------
//  List all moves for the playbook, showing which are selected.

addCmd({
  name: "+chargen/moves",
  category: "Urban Shadows",
  help: "+chargen/moves  —  List your playbook's moves.",
  pattern: /^\+chargen\/moves$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet) return;
    const pb = getPlaybook(sheet.playbookId)!;
    const lines = [
      bar(),
      `  ${H}${pb.name} — Moves${N}  (${pb.movesInstruction})`,
      `  Selected: ${sheet.selectedMoves.length}/${pb.moveCount}  — toggle with ${H}+chargen/move <id>${N}`,
      bar(),
    ];
    for (const m of pb.moves) {
      const selected = sheet.selectedMoves.includes(m.id);
      const req = m.required ? ` ${DIM}[required]${N}` : "";
      const marker = selected ? `${G}${H}[*]${N}` : `${DIM}[ ]${N}`;
      lines.push(`  ${marker} ${H}${m.name}${N}${req}  ${DIM}${m.id}${N}`);
      lines.push(
        `      ${m.description.slice(0, 100)}${
          m.description.length > 100 ? "..." : ""
        }`,
      );
    }
    lines.push(bar());
    u.send(lines.join("\n"));
  },
});

// --- +chargen/move <id> -------------------------------------------------------
//  Toggle a move on or off.

addCmd({
  name: "+chargen/move",
  category: "Urban Shadows",
  help: "+chargen/move <id>  —  Toggle a move on/off.",
  pattern: /^\+chargen\/move\s+(\S+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const pb = getPlaybook(sheet.playbookId)!;
    const id = (u.cmd.args[0] ?? "").trim().toLowerCase();
    const move = pb.moves.find((m) => m.id === id);
    if (!move) {
      u.send(
        `${H}+chargen/move:${N}  Unknown move '${id}'. Use ${H}+chargen/moves${N} to see options.`,
      );
      return;
    }
    if (move.required) {
      u.send(
        `${H}+chargen/move:${N}  ${H}${move.name}${N} is required and cannot be deselected.`,
      );
      return;
    }
    const selected = sheet.selectedMoves.includes(id);
    const updated = selected
      ? sheet.selectedMoves.filter((m) => m !== id)
      : [...sheet.selectedMoves, id];
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { selectedMoves: updated, updatedAt: Date.now() },
    );
    u.send(
      `${H}+chargen/move:${N}  ${H}${move.name}${N} ${
        selected ? `${R}removed${N}` : `${G}added${N}`
      }. (${updated.length}/${pb.moveCount} selected)`,
    );
  },
});

// --- +chargen/gear <items> ----------------------------------------------------

addCmd({
  name: "+chargen/gear",
  category: "Urban Shadows",
  help:
    "+chargen/gear <item, item, ...>  —  Set your starting gear (comma-separated).",
  pattern: /^\+chargen\/gear\s+(.+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const gear = (u.cmd.args[0] ?? "").split(",").map((s) => s.trim()).filter(
      Boolean,
    );
    if (gear.length > 20) {
      u.send(`${H}+chargen/gear:${N}  Too many items (max 20).`);
      return;
    }
    const longItem = gear.find((g) => g.length > 200);
    if (longItem) {
      u.send(`${H}+chargen/gear:${N}  Each item cannot exceed 200 characters.`);
      return;
    }
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { gear, updatedAt: Date.now() },
    );
    u.send(`${H}+chargen/gear:${N}  Gear set: ${gear.join(", ")}`);
  },
});

// --- +chargen/answer [<n>=<answer>] ------------------------------------------
//  With no args: list numbered intro questions.
//  With args: answer question #n.

addCmd({
  name: "+chargen/answer",
  category: "Urban Shadows",
  help:
    "+chargen/answer [<#>=<answer>]  —  List intro questions, or answer one by number.",
  pattern: /^\+chargen\/answer(?:\s+(\d+)=(.+))?$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet) return;

    const pb = getPlaybook(sheet.playbookId)!;

    // No args — show numbered question list
    if (!u.cmd.args[0]) {
      const lines = [
        bar(),
        `  ${H}Intro Questions${N}  (answer with ${H}+chargen/answer <#>=<your answer>${N})`,
        bar(),
      ];
      pb.introQuestions.forEach((q, i) => {
        const ans = sheet.introAnswers[q];
        lines.push(`  ${H}${i + 1}.${N} ${q}`);
        lines.push(`     ${ans ? `${G}${ans}${N}` : `${DIM}(unanswered)${N}`}`);
      });
      lines.push(bar());
      u.send(lines.join("\n"));
      return;
    }

    if (sheet.status === "approved") {
      u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      return;
    }

    const n = parseInt(u.cmd.args[0] ?? "0", 10);
    const answer = (u.cmd.args[1] ?? "").trim();
    const question = pb.introQuestions[n - 1];

    if (!question) {
      u.send(
        `${H}+chargen/answer:${N}  No question #${n}. Use ${H}+chargen/answer${N} to see the list.`,
      );
      return;
    }
    if (!answer) {
      u.send(`${H}+chargen/answer:${N}  Answer cannot be blank.`);
      return;
    }
    if (answer.length > 1000) {
      u.send(`${H}+chargen/answer:${N}  Answer cannot exceed 1000 characters.`);
      return;
    }

    const introAnswers = { ...sheet.introAnswers, [question]: answer };
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { introAnswers, updatedAt: Date.now() },
    );
    u.send(`${H}+chargen/answer:${N}  ${G}OK${N} Q${n} answered.`);
  },
});

// --- +chargen/debt/add <name>=<desc>  (they owe me) --------------------------

addCmd({
  name: "+chargen/debt/add",
  category: "Urban Shadows",
  help:
    "+chargen/debt/add <name>=<desc>  —  Record a starting Debt owed to you.",
  pattern: /^\+chargen\/debt\/add\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const to = (u.cmd.args[0] ?? "").trim();
    const description = (u.cmd.args[1] ?? "").trim();
    if (!to) {
      u.send(`${H}+chargen/debt/add:${N}  Name cannot be blank.`);
      return;
    }
    if (!description) {
      u.send(`${H}+chargen/debt/add:${N}  Description cannot be blank.`);
      return;
    }
    if (to.length > 100) {
      u.send(`${H}+chargen/debt/add:${N}  Name cannot exceed 100 characters.`);
      return;
    }
    if (description.length > 500) {
      u.send(
        `${H}+chargen/debt/add:${N}  Description cannot exceed 500 characters.`,
      );
      return;
    }
    const debt: IDebt = {
      id: crypto.randomUUID(),
      to,
      description,
      direction: "owed",
    };
    const debts = [...sheet.debts, debt];
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { debts, updatedAt: Date.now() },
    );
    u.send(
      `${H}+chargen/debt/add:${N}  ${H}${to}${N} owes you — "${description}"  (debt ${debts.length})`,
    );
  },
});

// --- +chargen/debt/owe <name>=<desc>  (I owe them) ---------------------------

addCmd({
  name: "+chargen/debt/owe",
  category: "Urban Shadows",
  help:
    "+chargen/debt/owe <name>=<desc>  —  Record a starting Debt you owe someone.",
  pattern: /^\+chargen\/debt\/owe\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const to = (u.cmd.args[0] ?? "").trim();
    const description = (u.cmd.args[1] ?? "").trim();
    if (!to) {
      u.send(`${H}+chargen/debt/owe:${N}  Name cannot be blank.`);
      return;
    }
    if (!description) {
      u.send(`${H}+chargen/debt/owe:${N}  Description cannot be blank.`);
      return;
    }
    if (to.length > 100) {
      u.send(`${H}+chargen/debt/owe:${N}  Name cannot exceed 100 characters.`);
      return;
    }
    if (description.length > 500) {
      u.send(
        `${H}+chargen/debt/owe:${N}  Description cannot exceed 500 characters.`,
      );
      return;
    }
    const debt: IDebt = {
      id: crypto.randomUUID(),
      to,
      description,
      direction: "owes",
    };
    const debts = [...sheet.debts, debt];
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { debts, updatedAt: Date.now() },
    );
    u.send(
      `${H}+chargen/debt/owe:${N}  You owe ${H}${to}${N} — "${description}"  (debt ${debts.length})`,
    );
  },
});

// --- +chargen/debt/del <n> ----------------------------------------------------

addCmd({
  name: "+chargen/debt/del",
  category: "Urban Shadows",
  help: "+chargen/debt/del <number>  —  Remove a starting debt by its number.",
  pattern: /^\+chargen\/debt\/del\s+(\d+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const idx = parseInt(u.cmd.args[0] ?? "0", 10) - 1;
    if (idx < 0 || idx >= sheet.debts.length) {
      u.send(
        `${H}+chargen/debt/del:${N}  No debt #${
          idx + 1
        }. You have ${sheet.debts.length}.`,
      );
      return;
    }
    const removed = sheet.debts[idx];
    const debts = sheet.debts.filter((_, i) => i !== idx);
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { debts, updatedAt: Date.now() },
    );
    u.send(
      `${H}+chargen/debt/del:${N}  Removed debt with ${H}${removed.to}${N}.`,
    );
  },
});

// --- +chargen/notes <text> ----------------------------------------------------

addCmd({
  name: "+chargen/notes",
  category: "Urban Shadows",
  help: "+chargen/notes <text>  —  Set freeform notes on your sheet.",
  pattern: /^\+chargen\/notes\s+(.+)$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet || sheet.status === "approved") {
      if (sheet?.status === "approved") {
        u.send(`${H}+chargen:${N}  Approved sheets cannot be edited.`);
      }
      return;
    }
    const notes = (u.cmd.args[0] ?? "").trim();
    if (notes.length > 3000) {
      u.send(`${H}+chargen/notes:${N}  Notes cannot exceed 3000 characters.`);
      return;
    }
    await sheets.modify(
      { id: u.me.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { notes, updatedAt: Date.now() },
    );
    u.send(`${H}+chargen/notes:${N}  Notes saved.`);
  },
});

// --- +chargen/submit ----------------------------------------------------------

addCmd({
  name: "+chargen/submit",
  category: "Urban Shadows",
  help: "+chargen/submit  —  Submit your sheet for staff approval.",
  pattern: /^\+chargen\/submit$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet) return;
    if (sheet.status !== "draft") {
      u.send(`${H}+chargen/submit:${N}  Sheet is already ${sheet.status}.`);
      return;
    }
    const problems = validateSheetLocal(sheet);
    if (problems.length) {
      u.send(
        `${H}+chargen/submit:${N}  ${R}${H}Sheet incomplete:${N}\n` +
          problems.map((p) => `  ${R}-${N} ${p}`).join("\n"),
      );
      return;
    }
    const submitted = await sheets.atomicModify(
      u.me.id,
      (current: ICharSheet) => ({
        ...current,
        status: "pending" as const,
        updatedAt: Date.now(),
      }),
    );
    const job = await fileChargenJob(submitted);
    u.send(
      `${H}+chargen/submit:${N}  ${G}${H}Sheet submitted for staff approval.${N}  Job #${job.number} filed.`,
    );
  },
});

// --- +chargen/reset -----------------------------------------------------------

addCmd({
  name: "+chargen/reset",
  category: "Urban Shadows",
  help: "+chargen/reset  —  Abandon your current sheet and start over.",
  pattern: /^\+chargen\/reset$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet) return;
    if (sheet.status === "approved") {
      u.send(`${H}+chargen/reset:${N}  Approved sheets cannot be deleted.`);
      return;
    }
    await sheets.delete({ id: u.me.id } as Parameters<typeof sheets.delete>[0]);
    u.send(
      `${H}+chargen/reset:${N}  Sheet deleted. Use ${H}+chargen/start <playbook>${N} to begin again.`,
    );
  },
});

// --- Staff commands -----------------------------------------------------------

addCmd({
  name: "+chargen/list",
  category: "Urban Shadows",
  help: "+chargen/list  —  [Staff] List all character sheets.",
  pattern: /^\+chargen\/list$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+chargen/list:${N}  Staff only.`);
      return;
    }
    const all = await sheets.query();
    if (!all.length) {
      u.send(`${H}+chargen/list:${N}  No sheets found.`);
      return;
    }
    const lines = [
      bar(),
      `  ${H}Character Sheets${N}`,
      bar(),
      ...all.map((s) => {
        const status = s.status === "approved"
          ? `${G}approved${N}`
          : s.status === "pending"
          ? `${Y}${H}pending${N}`
          : s.status === "rejected"
          ? `${R}rejected${N}`
          : `${DIM}draft${N}`;
        return `  ${H}${(s.name || s.id).padEnd(20)}${N} ${
          s.playbookId.padEnd(16)
        } ${status}`;
      }),
      bar(),
    ];
    u.send(lines.join("\n"));
  },
});

addCmd({
  name: "+chargen/review",
  category: "Urban Shadows",
  help: "+chargen/review <player>  —  [Staff] View any player's sheet.",
  pattern: /^\+chargen\/review\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+chargen/review:${N}  Staff only.`);
      return;
    }
    const name = (u.cmd.args[0] ?? "").trim();
    const sheet = await sheets.queryOne(
      { name } as Parameters<typeof sheets.queryOne>[0],
    );
    if (!sheet) {
      u.send(`${H}+chargen/review:${N}  No sheet found for '${name}'.`);
      return;
    }
    u.send(renderSheet(sheet as ICharSheet));
  },
});

addCmd({
  name: "+chargen/approve",
  category: "Urban Shadows",
  help:
    "+chargen/approve <player>  —  [Staff] Approve a character sheet (resolves the app job).",
  pattern: /^\+chargen\/approve\s+(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+chargen/approve:${N}  Staff only.`);
      return;
    }
    const name = (u.cmd.args[0] ?? "").trim();
    const sheet = await sheets.queryOne(
      { name } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet) {
      u.send(`${H}+chargen/approve:${N}  No sheet for '${name}'.`);
      return;
    }
    if (sheet.status === "approved") {
      u.send(`${H}+chargen/approve:${N}  Already approved.`);
      return;
    }

    // Find the open app job for this player and resolve it — the job:resolved hook does the rest
    const appJobs = await jobs.query(
      { category: "app", submittedBy: sheet.playerId } as Parameters<
        typeof jobs.query
      >[0],
    ) as IJob[];
    const openJob = appJobs.find((j) =>
      j.status !== "resolved" && j.status !== "closed"
    );

    if (openJob) {
      await jobs.modify(
        { id: openJob.id } as Parameters<typeof jobs.modify>[0],
        "$set",
        { status: "resolved", updatedAt: Date.now(), closedAt: Date.now() },
      );
      await jobHooks.emit("job:resolved", { ...openJob, status: "resolved" });
      u.send(
        `${H}+chargen/approve:${N}  ${G}${H}${sheet.name}${N} approved. Job #${openJob.number} resolved.`,
      );
    } else {
      // No job found — approve directly
      await jobHooks.emit("job:resolved", {
        id: "direct",
        number: 0,
        title: "",
        category: "app",
        priority: "normal",
        status: "resolved",
        submittedBy: sheet.playerId,
        submitterName: sheet.name,
        description: "",
        comments: [],
        staffOnly: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      u.send(`${H}+chargen/approve:${N}  ${G}${H}${sheet.name}${N} approved.`);
    }
  },
});

addCmd({
  name: "+chargen/reject",
  category: "Urban Shadows",
  help:
    "+chargen/reject <player>=<reason>  —  [Staff] Reject a sheet (closes the app job).",
  pattern: /^\+chargen\/reject\s+(.+?)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+chargen/reject:${N}  Staff only.`);
      return;
    }
    const name = (u.cmd.args[0] ?? "").trim();
    const reason = (u.cmd.args[1] ?? "").trim();
    const sheet = await sheets.queryOne(
      { name } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet) {
      u.send(`${H}+chargen/reject:${N}  No sheet for '${name}'.`);
      return;
    }

    // Add the reason as a comment then close the job — the job:closed hook rejects the sheet
    const appJobs = await jobs.query(
      { category: "app", submittedBy: sheet.playerId } as Parameters<
        typeof jobs.query
      >[0],
    ) as IJob[];
    const openJob = appJobs.find((j) =>
      j.status !== "resolved" && j.status !== "closed"
    );

    if (openJob) {
      const comment = {
        id: crypto.randomUUID(),
        authorId: u.me.id,
        authorName: u.me.name ?? u.me.id,
        text: reason,
        timestamp: Date.now(),
        staffOnly: false,
      };
      const updated = {
        ...openJob,
        status: "closed" as const,
        comments: [...openJob.comments, comment],
        updatedAt: Date.now(),
        closedAt: Date.now(),
      };
      await jobs.modify(
        { id: openJob.id } as Parameters<typeof jobs.modify>[0],
        "$set",
        updated,
      );
      await jobHooks.emit("job:closed", updated);
      u.send(
        `${H}+chargen/reject:${N}  ${sheet.name}'s sheet rejected. Job #${openJob.number} closed.`,
      );
    } else {
      // No job — reject directly via hook with the reason embedded as a comment
      await jobHooks.emit("job:closed", {
        id: "direct",
        number: 0,
        title: "",
        category: "app",
        priority: "normal",
        status: "closed",
        submittedBy: sheet.playerId,
        submitterName: sheet.name,
        description: "",
        staffOnly: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        comments: [{
          id: crypto.randomUUID(),
          authorId: u.me.id,
          authorName: u.me.name ?? u.me.id,
          text: reason,
          timestamp: Date.now(),
          staffOnly: false,
        }],
      });
      u.send(`${H}+chargen/reject:${N}  ${sheet.name}'s sheet rejected.`);
    }
  },
});
