import { addCmd } from "ursamu/app";
import { jobHooks, jobs } from "ursamu/jobs";
import type { IJob } from "ursamu/jobs";

const H = "%ch";
const N = "%cn";
const G = "%cg";
const R = "%cr";
const Y = "%cy";
const DIM = "%cx";

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function myName(u: { me: { id: string } }): string {
  return (u.me as unknown as { name?: string }).name ?? u.me.id;
}

const STATUS_COLOR: Record<string, string> = {
  new: Y,
  open: G,
  resolved: G,
  closed: DIM,
};

const PRIORITY_COLOR: Record<string, string> = {
  low: DIM,
  normal: N,
  high: Y,
  critical: R,
};

function jobLine(j: IJob): string {
  const sc = STATUS_COLOR[j.status] ?? N;
  const pc = PRIORITY_COLOR[j.priority] ?? N;
  return (
    `  ${H}#${j.number}${N}  ${pc}${j.priority.padEnd(8)}${N}  ` +
    `${sc}${j.status.padEnd(8)}${N}  ${j.title}`
  );
}

async function findJob(
  fragment: string,
  playerId: string,
  staff: boolean,
): Promise<IJob | null> {
  const all = await jobs.all() as IJob[];
  const byNum = parseInt(fragment, 10);
  const job = !isNaN(byNum)
    ? all.find((j) => j.number === byNum)
    : all.find((j) => j.id.startsWith(fragment));

  if (!job) return null;
  if (!staff && job.submittedBy !== playerId) return null;
  return job;
}

// --- +jobs -------------------------------------------------------------------

addCmd({
  name: "+jobs",
  category: "Urban Shadows",
  help: "+jobs  —  View your open jobs. Staff sees all active jobs.",
  pattern: /^\+jobs$/i,
  exec: async (u) => {
    const all = await jobs.all() as IJob[];
    const staff = isStaff(u);

    const pool = staff
      ? all.filter((j) => j.status !== "closed" && j.status !== "resolved")
      : all.filter((j) => j.submittedBy === u.me.id && j.status !== "closed");

    pool.sort((a, b) => b.number - a.number);

    if (!pool.length) {
      u.send(
        staff ? "%ch+jobs:%cn  No active jobs." : "%ch+jobs:%cn  No open jobs.",
      );
      return;
    }

    const lines = [
      `${H}--- Jobs${
        staff ? " [all active]" : ""
      } (${pool.length}) ----------------------------${N}`,
    ];
    for (const j of pool) lines.push(jobLine(j));
    lines.push(`  Use +jobs/view <#> for full details.`);
    u.send(lines.join("\n"));
  },
});

// --- +jobs/all ---------------------------------------------------------------

addCmd({
  name: "+jobs/all",
  category: "Urban Shadows",
  help: "+jobs/all  —  [Staff] List all jobs including closed/resolved.",
  pattern: /^\+jobs\/all$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+jobs/all:%cn  Staff only.");
      return;
    }

    const all = (await jobs.all() as IJob[]).sort((a, b) =>
      b.number - a.number
    );
    if (!all.length) {
      u.send("%ch+jobs/all:%cn  No jobs exist yet.");
      return;
    }

    const lines = [
      `${H}--- All Jobs (${all.length}) ----------------------------------${N}`,
    ];
    for (const j of all) lines.push(jobLine(j));
    u.send(lines.join("\n"));
  },
});

// --- +jobs/view <#> ----------------------------------------------------------

addCmd({
  name: "+jobs/view",
  category: "Urban Shadows",
  help: "+jobs/view <#>  —  View full details of a job.",
  pattern: /^\+jobs\/view\s+(\S+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const staff = isStaff(u);
    const job = await findJob(fragment, u.me.id, staff);

    if (!job) {
      u.send(`%ch+jobs/view:%cn  No job found for '${fragment}'.`);
      return;
    }

    const sc = STATUS_COLOR[job.status] ?? N;
    const pc = PRIORITY_COLOR[job.priority] ?? N;
    const visComments = staff
      ? job.comments
      : job.comments.filter((c) => !c.staffOnly);

    const lines = [
      `${H}--- Job #${job.number}: ${job.title} ---${N}`,
      `  Status:    ${sc}${H}${job.status.toUpperCase()}${N}`,
      `  Priority:  ${pc}${job.priority.toUpperCase()}${N}`,
      `  Category:  ${job.category}`,
      `  Submitted: ${job.submitterName}`,
      `${H}--- Description -----------------------------------${N}`,
      `  ${job.description.replace(/\n/g, "\n  ")}`,
    ];

    if (visComments.length) {
      lines.push(
        `${H}--- Comments (${visComments.length}) ----------------------------${N}`,
      );
      for (const c of visComments) {
        const who = (c as unknown as { authorName?: string }).authorName ??
          (c as unknown as { author?: string }).author ??
          "?";
        lines.push(`  ${H}${who}${N}: ${c.text}`);
      }
    }
    u.send(lines.join("\n"));
  },
});

// --- +jobs/comment <#>=<text> ------------------------------------------------

addCmd({
  name: "+jobs/comment",
  category: "Urban Shadows",
  help: "+jobs/comment <#>=<text>  —  Add a comment to a job.",
  pattern: /^\+jobs\/comment\s+(\S+)=(.+)$/i,
  exec: async (u) => {
    const fragment = (u.cmd.args[0] ?? "").trim();
    const text = (u.cmd.args[1] ?? "").trim();
    const staff = isStaff(u);

    if (!text) {
      u.send("%ch+jobs/comment:%cn  Comment cannot be blank.");
      return;
    }
    if (text.length > 2000) {
      u.send("%ch+jobs/comment:%cn  Comment cannot exceed 2000 characters.");
      return;
    }

    const job = await findJob(fragment, u.me.id, staff);
    if (!job) {
      u.send(`%ch+jobs/comment:%cn  No job found for '${fragment}'.`);
      return;
    }
    if (job.status === "closed" || job.status === "resolved") {
      u.send(
        `%ch+jobs/comment:%cn  Job #${job.number} is ${job.status} and cannot be commented on.`,
      );
      return;
    }

    const comment = {
      id: crypto.randomUUID(),
      author: u.me.id,
      authorName: myName(u),
      text,
      staffOnly: false,
      createdAt: Date.now(),
    };
    const newComments = [...job.comments, comment as IJob["comments"][number]];
    await jobs.modify(
      { id: job.id } as Parameters<typeof jobs.modify>[0],
      "$set",
      { comments: newComments, updatedAt: Date.now() },
    );
    u.send(`%ch+jobs/comment:%cn  Comment added to job #${job.number}.`);
  },
});

// --- +jobs/approve <#> -------------------------------------------------------

addCmd({
  name: "+jobs/approve",
  category: "Urban Shadows",
  help: "+jobs/approve <#>  —  [Staff] Approve/resolve a job.",
  pattern: /^\+jobs\/approve\s+(\S+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+jobs/approve:%cn  Staff only.");
      return;
    }

    const fragment = (u.cmd.args[0] ?? "").trim();
    const job = await findJob(fragment, u.me.id, true);
    if (!job) {
      u.send(`%ch+jobs/approve:%cn  No job found for '${fragment}'.`);
      return;
    }
    if (job.status === "resolved" || job.status === "closed") {
      u.send(
        `%ch+jobs/approve:%cn  Job #${job.number} is already ${job.status}.`,
      );
      return;
    }

    const now = Date.now();
    await jobs.modify(
      { id: job.id } as Parameters<typeof jobs.modify>[0],
      "$set",
      { status: "resolved", updatedAt: now },
    );
    const updated = { ...job, status: "resolved" as const, updatedAt: now };
    await jobHooks.emit("job:resolved", updated);
    u.send(
      `%ch+jobs/approve:%cn  ${G}${H}Resolved${N} job #${job.number}: "${job.title}"`,
    );
  },
});

// --- +jobs/reject <#>=<reason> -----------------------------------------------

addCmd({
  name: "+jobs/reject",
  category: "Urban Shadows",
  help: "+jobs/reject <#>=<reason>  —  [Staff] Reject a job with a reason.",
  pattern: /^\+jobs\/reject\s+(\S+)=(.+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+jobs/reject:%cn  Staff only.");
      return;
    }

    const fragment = (u.cmd.args[0] ?? "").trim();
    const reason = (u.cmd.args[1] ?? "").trim();

    if (!reason) {
      u.send("%ch+jobs/reject:%cn  Reason cannot be blank.");
      return;
    }
    if (reason.length > 2000) {
      u.send("%ch+jobs/reject:%cn  Reason cannot exceed 2000 characters.");
      return;
    }

    const job = await findJob(fragment, u.me.id, true);
    if (!job) {
      u.send(`%ch+jobs/reject:%cn  No job found for '${fragment}'.`);
      return;
    }
    if (job.status === "resolved" || job.status === "closed") {
      u.send(
        `%ch+jobs/reject:%cn  Job #${job.number} is already ${job.status}.`,
      );
      return;
    }

    const rejComment = {
      id: crypto.randomUUID(),
      author: u.me.id,
      authorName: myName(u),
      text: reason,
      staffOnly: false,
      createdAt: Date.now(),
    };
    const newComments = [
      ...job.comments,
      rejComment as IJob["comments"][number],
    ];
    const now = Date.now();
    await jobs.modify(
      { id: job.id } as Parameters<typeof jobs.modify>[0],
      "$set",
      { status: "closed", comments: newComments, updatedAt: now },
    );
    const updated = {
      ...job,
      status: "closed" as const,
      comments: newComments,
      updatedAt: now,
    };
    await jobHooks.emit("job:closed", updated);
    u.send(
      `%ch+jobs/reject:%cn  ${R}Closed${N} job #${job.number}: "${job.title}"\n  Reason: ${reason}`,
    );
  },
});

// --- +jobs/close <#> ---------------------------------------------------------

addCmd({
  name: "+jobs/close",
  category: "Urban Shadows",
  help: "+jobs/close <#>  —  [Staff] Close a job without a reason.",
  pattern: /^\+jobs\/close\s+(\S+)$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send("%ch+jobs/close:%cn  Staff only.");
      return;
    }

    const fragment = (u.cmd.args[0] ?? "").trim();
    const job = await findJob(fragment, u.me.id, true);
    if (!job) {
      u.send(`%ch+jobs/close:%cn  No job found for '${fragment}'.`);
      return;
    }
    if (job.status === "resolved" || job.status === "closed") {
      u.send(
        `%ch+jobs/close:%cn  Job #${job.number} is already ${job.status}.`,
      );
      return;
    }

    const now = Date.now();
    await jobs.modify(
      { id: job.id } as Parameters<typeof jobs.modify>[0],
      "$set",
      { status: "closed", updatedAt: now },
    );
    const updated = { ...job, status: "closed" as const, updatedAt: now };
    await jobHooks.emit("job:closed", updated);
    u.send(
      `%ch+jobs/close:%cn  ${DIM}Closed${N} job #${job.number}: "${job.title}"`,
    );
  },
});
