import { addCmd } from "ursamu/app";
import { mu } from "ursamu";
import { sheets } from "../playbooks/db.ts";
import { sessAnswers, sessions } from "./db.ts";
import {
  buildQuestionsForPlaybook,
  computeSessionXP,
  createAnswerRecord,
  scoreAnswers,
  unansweredQuestions,
} from "./logic.ts";
import { XP_PER_ADVANCE } from "../advancement/logic.ts";
import type { ICharSheet } from "../playbooks/schema.ts";
import type { ISession, ISessionAnswers } from "./schema.ts";

// --- Colour helpers -----------------------------------------------------------

const H = "%ch";
const N = "%cn";
const G = "%cg";
const Y = "%cy";
const R = "%cr";
const DIM = "%cx";

function bar(width = 60): string {
  return `${H}${"-".repeat(width)}${N}`;
}

function xpBar(xp: number, max = XP_PER_ADVANCE): string {
  return Array.from(
    { length: max },
    (_, i) => i < xp ? `${H}${G}(*)${N}` : "( )",
  ).join("");
}

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

// --- Helpers ------------------------------------------------------------------

async function activeSession(): Promise<ISession | null> {
  const all = await sessions.query(
    { status: "active" } as Parameters<typeof sessions.query>[0],
  );
  return (all[0] as ISession | undefined) ?? null;
}

async function endedSession(): Promise<ISession | null> {
  // Most recent ended session (the one players should be answering)
  const all = await sessions.query(
    { status: "ended" } as Parameters<typeof sessions.query>[0],
  );
  if (!all.length) return null;
  return (all as ISession[]).sort((a, b) =>
    (b.endedAt ?? 0) - (a.endedAt ?? 0)
  )[0];
}

async function currentAnswerRecord(
  playerId: string,
  sess: ISession,
): Promise<ISessionAnswers | null> {
  const rec = await sessAnswers.queryOne(
    {
      playerId,
      sessionId: sess.id,
    } as Parameters<typeof sessAnswers.queryOne>[0],
  );
  return rec ? (rec as ISessionAnswers) : null;
}

async function getOrCreateAnswerRecord(
  sheet: ICharSheet,
  sess: ISession,
): Promise<ISessionAnswers> {
  const existing = await currentAnswerRecord(sheet.id, sess);
  if (existing) return existing;

  const rec = createAnswerRecord({
    sessionId: sess.id,
    sessionNumber: sess.number,
    playerId: sheet.id,
    playerName: sheet.name,
    playbookId: sheet.playbookId,
  });
  await sessAnswers.create(rec);
  return rec;
}

async function nextSessionNumber(): Promise<number> {
  const all = await sessions.query() as ISession[];
  if (!all.length) return 1;
  return Math.max(...all.map((s) => s.number)) + 1;
}

// --- +session ----------------------------------------------------------------
//  Show current session status.

addCmd({
  name: "+session",
  category: "Urban Shadows",
  help: "+session  —  Show the current session status.",
  pattern: /^\+session$/i,
  exec: async (u) => {
    const active = await activeSession();
    const ended = active ? null : await endedSession();
    const sess = active ?? ended;

    if (!sess) {
      u.send(
        `${H}+session:${N}  No session is currently active. Staff can start one with ${H}+session/start${N}.`,
      );
      return;
    }

    const lines = [
      bar(),
      `  ${H}Session #${sess.number}${N}` +
      (sess.title ? `: ${sess.title}` : "") +
      `  — ${
        active ? `${G}${H}ACTIVE${N}` : `${Y}${H}ENDED — questions open${N}`
      }`,
      `  Started by ${H}${sess.startedByName}${N}  at ${
        new Date(sess.startedAt).toUTCString()
      }`,
    ];

    if (sess.status === "ended" && sess.endedAt) {
      lines.push(
        `  Ended by ${H}${sess.endedByName ?? "?"}${N}  at ${
          new Date(sess.endedAt).toUTCString()
        }`,
      );
      lines.push(
        `  Use ${H}+session/questions${N} to answer end-of-session questions and earn XP.`,
      );
    }

    lines.push(bar());
    u.send(lines.join("\n"));
  },
});

// --- +session/start [<title>] -------------------------------------------------
//  [Staff] Open a new session.

addCmd({
  name: "+session/start",
  category: "Urban Shadows",
  help: "+session/start [title]  —  [Staff] Open a new session.",
  pattern: /^\+session\/start(?:\s+(.+))?$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+session/start:${N}  Staff only.`);
      return;
    }

    const existing = await activeSession();
    if (existing) {
      u.send(
        `${H}+session/start:${N}  Session #${existing.number} is already active. End it first with ${H}+session/end${N}.`,
      );
      return;
    }

    const title = (u.cmd.args[0] ?? "").trim();
    const number = await nextSessionNumber();
    const now = Date.now();

    const sess: ISession = {
      id: crypto.randomUUID(),
      number,
      title,
      status: "active",
      startedAt: now,
      startedBy: u.me.id,
      startedByName: u.me.name ?? u.me.id,
    };

    await sessions.create(sess);

    const announce = title
      ? `${H}Session #${number}${N} has begun: ${H}${title}${N}`
      : `${H}Session #${number}${N} has begun.`;

    mu().game.broadcast(announce);
    u.send(`${H}+session/start:${N}  ${G}${H}Session #${number} started.${N}`);
  },
});

// --- +session/end -------------------------------------------------------------
//  [Staff] End the current session and prompt players to answer questions.

addCmd({
  name: "+session/end",
  category: "Urban Shadows",
  help:
    "+session/end  —  [Staff] End the current session and open end-of-session questions.",
  pattern: /^\+session\/end$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+session/end:${N}  Staff only.`);
      return;
    }

    const sess = await activeSession();
    if (!sess) {
      u.send(
        `${H}+session/end:${N}  No active session. Start one with ${H}+session/start${N}.`,
      );
      return;
    }

    const now = Date.now();
    await sessions.modify(
      { id: sess.id } as Parameters<typeof sessions.modify>[0],
      "$set",
      {
        status: "ended",
        endedAt: now,
        endedBy: u.me.id,
        endedByName: u.me.name ?? u.me.id,
      },
    );

    mu().game.broadcast(
      `${H}Session #${sess.number}${N} has ended. ` +
        `Use ${H}+session/questions${N} to answer end-of-session questions and earn XP!`,
    );
    u.send(
      `${H}+session/end:${N}  ${Y}${H}Session #${sess.number} ended.${N}  Players have been notified.`,
    );
  },
});

// --- +session/questions -------------------------------------------------------
//  Show your end-of-session questions with current answers.

addCmd({
  name: "+session/questions",
  category: "Urban Shadows",
  help: "+session/questions  —  View and answer end-of-session XP questions.",
  pattern: /^\+session\/questions$/i,
  exec: async (u) => {
    const sess = await endedSession();
    if (!sess) {
      u.send(
        `${H}+session/questions:${N}  No session is awaiting answers right now.`,
      );
      return;
    }

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send(
        `${H}+session/questions:${N}  You need an approved character to answer session questions.`,
      );
      return;
    }

    const rec = await getOrCreateAnswerRecord(sheet, sess);
    const questions = buildQuestionsForPlaybook(sheet.playbookId);

    if (rec.submittedAt) {
      u.send(
        `${H}+session/questions:${N}  You already submitted answers for Session #${sess.number}. ` +
          `XP earned: ${G}${H}+${rec.xpEarned}${N}  ${xpBar(sheet.xp)}`,
      );
      return;
    }

    const yesCount = scoreAnswers(questions, rec.answers);
    const lines = [
      bar(),
      `  ${H}End-of-Session Questions — Session #${sess.number}${N}`,
      `  Answer with ${H}+session/answer <#>=yes${N} or ${H}+session/answer <#>=no${N}`,
      `  When done, use ${H}+session/done${N} to collect XP.`,
      bar(),
    ];

    questions.forEach((q, i) => {
      const ans = rec.answers[q.id];
      const marker = ans === true
        ? `${G}${H}[YES]${N}`
        : ans === false
        ? `${R}[NO] ${N}`
        : `${DIM}[???]${N}`;
      lines.push(`  ${marker} ${H}${i + 1}.${N} ${q.text}`);
    });

    lines.push(bar());
    lines.push(
      `  ${H}${yesCount}${N} yes answer(s) so far  — potential +${yesCount} XP`,
    );
    lines.push(bar());

    u.send(lines.join("\n"));
  },
});

// --- +session/answer <n>=yes|no -----------------------------------------------
//  Answer an end-of-session question by number.

addCmd({
  name: "+session/answer",
  category: "Urban Shadows",
  help:
    "+session/answer <#>=yes|no  —  Answer an end-of-session question by number.",
  pattern: /^\+session\/answer\s+(\d+)=(yes|no)$/i,
  exec: async (u) => {
    const n = parseInt(u.cmd.args[0] ?? "0", 10);
    const ans = (u.cmd.args[1] ?? "").toLowerCase() === "yes";

    const sess = await endedSession();
    if (!sess) {
      u.send(
        `${H}+session/answer:${N}  No session is awaiting answers right now.`,
      );
      return;
    }

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send(
        `${H}+session/answer:${N}  You need an approved character to answer session questions.`,
      );
      return;
    }

    const rec = await getOrCreateAnswerRecord(sheet, sess);

    if (rec.submittedAt) {
      u.send(
        `${H}+session/answer:${N}  You've already submitted answers for this session.`,
      );
      return;
    }

    const questions = buildQuestionsForPlaybook(sheet.playbookId);
    const question = questions[n - 1];

    if (!question) {
      u.send(
        `${H}+session/answer:${N}  No question #${n}. Use ${H}+session/questions${N} to see the list.`,
      );
      return;
    }

    const updatedAnswers = { ...rec.answers, [question.id]: ans };
    await sessAnswers.modify(
      { id: rec.id } as Parameters<typeof sessAnswers.modify>[0],
      "$set",
      { answers: updatedAnswers, updatedAt: Date.now() },
    );

    const marker = ans ? `${G}${H}YES${N}` : `${R}NO${N}`;
    u.send(
      `${H}+session/answer:${N}  Q${n} — ${marker}. Use ${H}+session/done${N} when finished.`,
    );
  },
});

// --- +session/done ------------------------------------------------------------
//  Submit answers and collect XP.

addCmd({
  name: "+session/done",
  category: "Urban Shadows",
  help: "+session/done  —  Submit end-of-session answers and collect your XP.",
  pattern: /^\+session\/done$/i,
  exec: async (u) => {
    const sess = await endedSession();
    if (!sess) {
      u.send(
        `${H}+session/done:${N}  No session is awaiting answers right now.`,
      );
      return;
    }

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send(
        `${H}+session/done:${N}  You need an approved character to collect session XP.`,
      );
      return;
    }

    const rec = await currentAnswerRecord(sheet.id, sess);
    if (!rec) {
      u.send(
        `${H}+session/done:${N}  Use ${H}+session/questions${N} to answer questions first.`,
      );
      return;
    }

    if (rec.submittedAt) {
      u.send(
        `${H}+session/done:${N}  Already submitted for Session #${sess.number}. You earned ${G}${H}+${rec.xpEarned} XP${N}.`,
      );
      return;
    }

    const questions = buildQuestionsForPlaybook(sheet.playbookId);
    const unanswered = unansweredQuestions(questions, rec.answers);

    if (unanswered.length) {
      const nums = unanswered.map((q) => questions.indexOf(q) + 1).join(", ");
      u.send(
        `${H}+session/done:${N}  ${unanswered.length} question(s) unanswered (${nums}). ` +
          `Answer them or they count as No.  ` +
          `Use ${H}+session/done/force${N} to submit now treating blanks as No.`,
      );
      return;
    }

    await _submitAnswers(u, sheet, rec, questions, sess);
  },
});

// --- +session/done/force ------------------------------------------------------
//  Submit even with unanswered questions (blanks count as No).

addCmd({
  name: "+session/done/force",
  category: "Urban Shadows",
  help: "+session/done/force  —  Submit now; unanswered questions count as No.",
  pattern: /^\+session\/done\/force$/i,
  exec: async (u) => {
    const sess = await endedSession();
    if (!sess) {
      u.send(`${H}+session/done/force:${N}  No session awaiting answers.`);
      return;
    }

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    ) as ICharSheet | null;
    if (!sheet || sheet.status !== "approved") {
      u.send(`${H}+session/done/force:${N}  You need an approved character.`);
      return;
    }

    const rec = await getOrCreateAnswerRecord(sheet, sess);
    if (rec.submittedAt) {
      u.send(
        `${H}+session/done/force:${N}  Already submitted for Session #${sess.number}.`,
      );
      return;
    }

    const questions = buildQuestionsForPlaybook(sheet.playbookId);
    await _submitAnswers(u, sheet, rec, questions, sess);
  },
});

// --- Shared submission logic --------------------------------------------------

async function _submitAnswers(
  u: { me: { id: string; name?: string }; send(m: string): void },
  sheet: ICharSheet,
  rec: ISessionAnswers,
  questions: ReturnType<typeof buildQuestionsForPlaybook>,
  sess: ISession,
): Promise<void> {
  const xpEarned = computeSessionXP(questions, rec.answers, sheet.xp);
  const newXP = sheet.xp + xpEarned;
  const now = Date.now();

  // Persist the answer record
  await sessAnswers.modify(
    { id: rec.id } as Parameters<typeof sessAnswers.modify>[0],
    "$set",
    { xpEarned, submittedAt: now, updatedAt: now },
  );

  // Award XP on the sheet
  if (xpEarned > 0) {
    await sheets.modify(
      { id: sheet.id } as Parameters<typeof sheets.modify>[0],
      "$set",
      { xp: newXP, updatedAt: now },
    );
  }

  const yesCount = scoreAnswers(questions, rec.answers);
  const xpDisplay = xpEarned > 0
    ? `${G}${H}+${xpEarned} XP!${N}  ${xpBar(newXP)}`
    : `${DIM}+0 XP${N}  (XP bar full or no yes answers)`;

  u.send(
    [
      bar(),
      `  ${H}Session #${sess.number} — Answers submitted${N}`,
      `  ${yesCount} yes answer(s) -> ${xpDisplay}  (${newXP}/${XP_PER_ADVANCE})`,
      newXP >= XP_PER_ADVANCE
        ? `  ${G}${H}You can spend XP! Use +advance to see options.${N}`
        : "",
      bar(),
    ].filter(Boolean).join("\n"),
  );
}

// --- +session/list ------------------------------------------------------------
//  [Staff] List recent sessions.

addCmd({
  name: "+session/list",
  category: "Urban Shadows",
  help: "+session/list  —  [Staff] List all sessions.",
  pattern: /^\+session\/list$/i,
  exec: async (u) => {
    if (!isStaff(u)) {
      u.send(`${H}+session/list:${N}  Staff only.`);
      return;
    }

    const all = (await sessions.query() as ISession[]).sort((a, b) =>
      b.number - a.number
    );
    if (!all.length) {
      u.send(`${H}+session/list:${N}  No sessions recorded yet.`);
      return;
    }

    const lines = [bar(), `  ${H}Sessions${N}`, bar()];
    for (const s of all.slice(0, 20)) {
      const statusTag = s.status === "active"
        ? `${G}${H}active${N}`
        : `${DIM}ended${N}`;
      const title = s.title ? ` "${s.title}"` : "";
      lines.push(
        `  ${H}#${s.number}${N}${title}  ${statusTag}  ${DIM}${
          new Date(s.startedAt).toUTCString()
        }${N}`,
      );
    }
    lines.push(bar());
    u.send(lines.join("\n"));
  },
});

// --- +session/answers [<player>] ---------------------------------------------
//  View answer records. Staff can view any player's. Players see their own.

addCmd({
  name: "+session/answers",
  category: "Urban Shadows",
  help:
    "+session/answers [<player>]  —  View session answer history. Staff can specify a player.",
  pattern: /^\+session\/answers(?:\s+(.+))?$/i,
  exec: async (u) => {
    const targetName = (u.cmd.args[0] ?? "").trim();
    let targetId = u.me.id;

    if (targetName) {
      if (!isStaff(u)) {
        u.send(
          `${H}+session/answers:${N}  Only staff can view other players' answers.`,
        );
        return;
      }
      const target = await sheets.queryOne(
        { name: targetName } as Parameters<typeof sheets.queryOne>[0],
      ) as ICharSheet | null;
      if (!target) {
        u.send(`${H}+session/answers:${N}  No sheet for '${targetName}'.`);
        return;
      }
      targetId = target.id;
    }

    const records = (await sessAnswers.query(
      { playerId: targetId } as Parameters<typeof sessAnswers.query>[0],
    ) as ISessionAnswers[])
      .sort((a, b) => b.sessionNumber - a.sessionNumber);

    if (!records.length) {
      u.send(`${H}+session/answers:${N}  No session answers recorded yet.`);
      return;
    }

    const lines = [bar(), `  ${H}Session Answer History${N}`, bar()];
    for (const r of records.slice(0, 10)) {
      const submitted = r.submittedAt
        ? `${G}+${r.xpEarned} XP${N}`
        : `${Y}pending${N}`;
      lines.push(`  ${H}Session #${r.sessionNumber}${N}  ${submitted}`);
    }
    lines.push(bar());
    u.send(lines.join("\n"));
  },
});
