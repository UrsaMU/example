// ─── Chargen ↔ Jobs Integration ───────────────────────────────────────────────
//
// When a player submits their chargen sheet:
//   → a job is filed automatically in the "app" category
//
// When staff resolves that job ("+job/complete #"):
//   → the sheet is auto-approved and sheet data is applied to the player's dbobj
//
// When staff closes that job ("+job/close #"):
//   → the sheet is auto-rejected; the last comment becomes the rejection reason
//
// Import path will become "ursamu/jobs" once the PR lands in the package.

import { jobHooks, jobs, getNextJobNumber } from "ursamu/jobs";
import { dbojs } from "ursamu";
import { sheets } from "./db.ts";
import { getPlaybook } from "./data.ts";
import type { ICharSheet } from "./schema.ts";
import type { IJob } from "ursamu/jobs";

// ─── Create a job when a sheet is submitted ───────────────────────────────────

export async function fileChargenJob(sheet: ICharSheet): Promise<IJob> {
  const pb = getPlaybook(sheet.playbookId);
  const number = await getNextJobNumber();

  const description = [
    `Character application for **${sheet.name}** (${pb?.name ?? sheet.playbookId}).`,
    ``,
    `**Stats:** Blood ${sheet.stats.blood >= 0 ? "+" : ""}${sheet.stats.blood}  Heart ${sheet.stats.heart >= 0 ? "+" : ""}${sheet.stats.heart}  Mind ${sheet.stats.mind >= 0 ? "+" : ""}${sheet.stats.mind}  Spirit ${sheet.stats.spirit >= 0 ? "+" : ""}${sheet.stats.spirit}`,
    `**Home Circle:** ${pb?.circle ?? "unknown"}`,
    `**Moves:** ${sheet.selectedMoves.length} selected`,
    `**Debts:** ${sheet.debts.length} recorded`,
    ``,
    `Review in-game with: +chargen/review ${sheet.name}`,
    `Approve with: +chargen/approve ${sheet.name}`,
    `Reject with:  +chargen/reject ${sheet.name}=<reason>`,
  ].join("\n");

  const now = Date.now();
  const job: IJob = {
    id: `job-${number}`,
    number,
    title: `App: ${sheet.name} (${pb?.name ?? sheet.playbookId})`,
    category: "app",
    priority: "normal",
    status: "new",
    submittedBy: sheet.playerId,
    submitterName: sheet.name,
    description,
    comments: [],
    staffOnly: false,
    createdAt: now,
    updatedAt: now,
  };

  await jobs.create(job);
  await jobHooks.emit("job:created", job);
  return job;
}

// ─── Hook: job resolved → auto-approve sheet ─────────────────────────────────

jobHooks.on("job:resolved", async (job) => {
  if (job.category !== "app") return;

  const sheet = await sheets.queryOne({ playerId: job.submittedBy } as Parameters<typeof sheets.queryOne>[0]) as ICharSheet | null;
  if (!sheet || sheet.status === "approved") return;

  await sheets.modify(
    { id: sheet.id } as Parameters<typeof sheets.modify>[0],
    "$set",
    { status: "approved", updatedAt: Date.now() },
  );

  // Apply sheet data to the player's world object
  const pb = getPlaybook(sheet.playbookId);
  const player = await dbojs.queryOne({ id: sheet.playerId });
  if (player) {
    const currentData = (player.data as Record<string, unknown>) || {};
    await dbojs.modify(
      { id: sheet.playerId },
      "$set",
      {
        data: {
          ...currentData,
          playbook: sheet.playbookId,
          playbookName: pb?.name,
          chargenStatus: "approved",
          stats: sheet.stats,
          circleRatings: sheet.circleRatings,
          circleStatus: sheet.circleStatus,
          harm: sheet.harm,
          corruption: sheet.corruption,
          selectedMoves: sheet.selectedMoves,
        },
      },
    );
  }

  console.log(`[chargen] Auto-approved sheet for ${sheet.name} (job #${job.number} resolved)`);
});

// ─── Hook: job closed → auto-reject sheet ────────────────────────────────────

jobHooks.on("job:closed", async (job) => {
  if (job.category !== "app") return;

  const sheet = await sheets.queryOne({ playerId: job.submittedBy } as Parameters<typeof sheets.queryOne>[0]) as ICharSheet | null;
  if (!sheet || sheet.status === "approved" || sheet.status === "rejected") return;

  // Use the last non-staff-only comment as the rejection reason, if any
  const publicComments = job.comments.filter((c) => !c.staffOnly);
  const reason = publicComments.length
    ? publicComments[publicComments.length - 1].text
    : "Application closed by staff.";

  await sheets.modify(
    { id: sheet.id } as Parameters<typeof sheets.modify>[0],
    "$set",
    { status: "rejected", rejectionReason: reason, updatedAt: Date.now() },
  );

  console.log(`[chargen] Auto-rejected sheet for ${sheet.name} (job #${job.number} closed)`);
});
