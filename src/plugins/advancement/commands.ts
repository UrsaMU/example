import { addCmd } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { getPlaybook } from "../playbooks/data.ts";
import {
  applyAdvance,
  canTakeAdvance,
  markXP,
  validateAdvance,
  XP_PER_ADVANCE,
} from "./logic.ts";
import { getNextJobNumber, jobHooks, jobs } from "ursamu/jobs";
import type { ICharSheet } from "../playbooks/schema.ts";
import type { IPlaybookAdvance } from "../playbooks/schema.ts";
import type { IJob } from "ursamu/jobs";

// ─── Job helper ───────────────────────────────────────────────────────────────

async function fileMajorAdvanceJob(
  sheet: ICharSheet,
  adv: IPlaybookAdvance,
): Promise<IJob> {
  const pb = getPlaybook(sheet.playbookId);
  const number = await getNextJobNumber();
  const descriptions: Record<string, string> = {
    "retire":
      "This character is retiring to safety. Work with the player to close out their story.",
    "change-playbook":
      "This character is changing playbooks. Coordinate the transition with the player.",
    "move-any":
      "This character is taking a move from any playbook. Confirm the choice is narratively sound.",
  };
  const now = Date.now();
  const job: IJob = {
    id: `job-${number}`,
    number,
    title: `Major Advance: ${sheet.name} — ${adv.label}`,
    category: "advance",
    priority: "high",
    status: "new",
    submittedBy: sheet.playerId,
    submitterName: sheet.name,
    description: [
      `**${sheet.name}** (${
        pb?.name ?? sheet.playbookId
      }) has taken a major advance: **${adv.label}**`,
      ``,
      descriptions[adv.id] ?? "A major advance was taken.",
      ``,
      `Advances taken so far: ${sheet.takenAdvances.length}`,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function xpBar(xp: number, max = XP_PER_ADVANCE): string {
  return Array.from({ length: max }, (_, i) => i < xp ? "%ch%cg(*)%cn" : "( )")
    .join("");
}

// ─── +xp ──────────────────────────────────────────────────────────────────────
//  Show my current XP and advances taken.

addCmd({
  name: "+xp",
  category: "Urban Shadows",
  help: "+xp  —  View your XP and Advances.",
  pattern: /^\+xp$/i,
  exec: async (u) => {
    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+xp:%cn  No approved character sheet found.");
      return;
    }

    const pb = getPlaybook(sheet.playbookId);
    const lines = [
      `%ch─── XP & Advancement ────────────────────────────────%cn`,
      `  XP:  ${xpBar(sheet.xp)}  (${sheet.xp}/${XP_PER_ADVANCE})`,
    ];

    if (canTakeAdvance(sheet.xp)) {
      lines.push(`  %ch%cgYou can spend XP! Use +advance to see options.%cn`);
    }

    if (sheet.takenAdvances.length) {
      lines.push(`\n%chAdvances taken:%cn`);
      for (const id of sheet.takenAdvances) {
        const adv = pb?.advances.find((a) => a.id === id);
        lines.push(`  %ch-%cn ${adv?.label ?? id}`);
      }
    }

    u.send(lines.join("\n"));
  },
});

// ─── +xp/mark [<player>] ──────────────────────────────────────────────────────
//  Award 1 XP. Players mark their own; staff can award to others.

addCmd({
  name: "+xp/mark",
  category: "Urban Shadows",
  help: "+xp/mark [<player>]  —  Mark 1 XP. Staff can award to others.",
  pattern: /^\+xp\/mark(?:\s+(.+))?$/i,
  exec: async (u) => {
    const targetName = (u.cmd.args[0] ?? "").trim();
    let targetId = u.me.id;

    if (targetName) {
      if (!isStaff(u)) {
        u.send("%ch+xp/mark:%cn  Only staff can award XP to others.");
        return;
      }
      const target = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      );
      if (!target) {
        u.send(`%ch+xp/mark:%cn  No sheet found for '${targetName}'.`);
        return;
      }
      targetId = (target as ICharSheet).id;
    }

    const sheet = await sheets.queryOne(
      { id: targetId } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+xp/mark:%cn  No approved sheet found.");
      return;
    }

    const result = await sheets.atomicModify(
      targetId,
      (current: ICharSheet) => ({
        ...current,
        xp: markXP(current.xp),
        updatedAt: Date.now(),
      }),
    );

    const who = targetName ? `${targetName}'s` : "Your";
    u.send(
      `%ch+xp/mark:%cn  ${who} XP: ${
        xpBar(result.xp)
      }  (${result.xp}/${XP_PER_ADVANCE})${
        result.xp >= XP_PER_ADVANCE ? " — %ch%cgReady to advance!%cn" : ""
      }`,
    );
  },
});

// ─── +advance ─────────────────────────────────────────────────────────────────
//  List available advances for my playbook.

addCmd({
  name: "+advance",
  category: "Urban Shadows",
  help: "+advance  —  List available Advances for your playbook.",
  pattern: /^\+advance$/i,
  exec: async (u) => {
    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+advance:%cn  No approved character sheet found.");
      return;
    }

    const pb = getPlaybook(sheet.playbookId);
    if (!pb) {
      u.send("%ch+advance:%cn  Unknown playbook.");
      return;
    }

    const lines = [
      `%ch─── Available Advances (${pb.name}) ────────────────────%cn`,
      `  XP: ${xpBar(sheet.xp)}  (${sheet.xp}/${XP_PER_ADVANCE})`,
      "",
    ];

    for (const adv of pb.advances) {
      const err = validateAdvance(sheet, adv.id, pb);
      const taken = sheet.takenAdvances.filter((id) => id === adv.id).length;
      const maxLabel = adv.maxTimes && adv.maxTimes > 1
        ? ` (${taken}/${adv.maxTimes})`
        : "";
      const majorTag = adv.major ? " %ch%cy[major]%cn" : "";

      if (err) {
        const reason = err === "not-enough-xp"
          ? "not enough XP"
          : err === "major-advance-locked"
          ? "need 5 regular advances first"
          : err === "advance-maxed"
          ? "maxed out"
          : err === "stat-at-max"
          ? "stat already at max"
          : err;
        lines.push(
          `  %cx${adv.id}${maxLabel}%cn  ${adv.label}${majorTag}  %ch%cx(${reason})%cn`,
        );
      } else {
        lines.push(`  %ch${adv.id}${maxLabel}%cn  ${adv.label}${majorTag}`);
      }
    }

    lines.push("", `Use: %ch+advance/take <id>%cn to spend XP on an advance.`);
    u.send(lines.join("\n"));
  },
});

// ─── +advance/take <id> ───────────────────────────────────────────────────────
//  Spend 5 XP to take an advance.

addCmd({
  name: "+advance/take",
  category: "Urban Shadows",
  help: "+advance/take <id>  —  Spend XP to take an Advance.",
  pattern: /^\+advance\/take\s+(\S+)$/i,
  exec: async (u) => {
    const advanceId = (u.cmd.args[0] ?? "").trim();

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send("%ch+advance/take:%cn  No approved character sheet found.");
      return;
    }

    const pb = getPlaybook(sheet.playbookId);
    if (!pb) {
      u.send("%ch+advance/take:%cn  Unknown playbook.");
      return;
    }

    const error = validateAdvance(sheet, advanceId, pb);
    if (error) {
      const msg: Record<string, string> = {
        "not-enough-xp":
          `You need ${XP_PER_ADVANCE} XP to advance (have ${sheet.xp}).`,
        "unknown-advance":
          `Unknown advance: '${advanceId}'. Use +advance to see options.`,
        "major-advance-locked":
          "Major advances require 5 regular advances first.",
        "advance-maxed":
          "You've already taken that advance the maximum number of times.",
        "stat-at-max": "That stat is already at its maximum (+2).",
        "circle-at-max": "That circle rating is already at its maximum.",
      };
      u.send(`%ch+advance/take:%cn  ${msg[error] ?? error}`);
      return;
    }

    const adv = pb.advances.find((a) => a.id === advanceId)!;

    const result = await sheets.atomicModify(u.me.id, (current: ICharSheet) => {
      const err = validateAdvance(current, advanceId, pb);
      if (err) return current;
      const applied = applyAdvance(current, adv);
      return {
        ...current,
        xp: applied.xp,
        takenAdvances: applied.takenAdvances,
        stats: applied.stats,
        updatedAt: Date.now(),
      };
    });

    u.send(
      `%ch+advance/take:%cn  Advance taken: %ch${adv.label}%cn. ` +
        `XP: ${xpBar(result.xp)}  (${result.xp}/${XP_PER_ADVANCE})`,
    );

    if (adv.major) {
      const job = await fileMajorAdvanceJob(result, adv);
      u.send(
        `%ch+advance/take:%cn  %cy%chThis is a major advance — staff has been notified (Job #${job.number}).%cn`,
      );
    }
  },
});

// ─── +advance/xp <player>=<amount> ───────────────────────────────────────────
//  Staff: set XP directly.

addCmd({
  name: "+advance/xp",
  category: "Urban Shadows",
  help: "+advance/xp <player>=<amount>  —  [Staff] Set a player's XP directly.",
  pattern: /^\+advance\/xp\s+(.+?)=(\d+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+advance/xp:%cn  Staff only.");
      return;
    }

    const targetName = (u.cmd.args[0] ?? "").trim();
    const amount = Math.min(
      XP_PER_ADVANCE,
      Math.max(0, parseInt(u.cmd.args[1] ?? "0", 10)),
    );

    const target = await sheets.queryOne(
      { name: targetName } as Parameters<typeof sheets.queryOne>[0],
    );
    if (!target) {
      u.send(`%ch+advance/xp:%cn  No sheet for '${targetName}'.`);
      return;
    }

    await sheets.modify(
      { id: (target as ICharSheet).id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { xp: amount, updatedAt: Date.now() },
    );

    u.send(`%ch+advance/xp:%cn  Set ${targetName}'s XP to ${amount}.`);
  },
});
