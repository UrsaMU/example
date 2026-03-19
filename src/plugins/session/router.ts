import type { ISession, ISessionAnswers, QuestionAnswer } from "./schema.ts";
import type { ICharSheet } from "../playbooks/schema.ts";
import {
  buildQuestionsForPlaybook,
  scoreAnswers,
  computeSessionXP,
  createAnswerRecord,
  blankAnswers,
} from "./logic.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JSON_H = { "Content-Type": "application/json" };

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_H });
}

function err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_H });
}

// ─── Injectable store interfaces ──────────────────────────────────────────────

export interface SessionStore {
  query(q?: Partial<ISession>): Promise<ISession[]>;
  queryOne(q: Partial<ISession>): Promise<ISession | null | undefined | false>;
  create(record: ISession): Promise<ISession>;
  modify(q: Partial<ISession>, op: string, update: Partial<ISession>): Promise<void>;
}

export interface AnswerStore {
  query(q?: Partial<ISessionAnswers>): Promise<ISessionAnswers[]>;
  queryOne(q: Partial<ISessionAnswers>): Promise<ISessionAnswers | null | undefined | false>;
  create(record: ISessionAnswers): Promise<ISessionAnswers>;
  modify(q: Partial<ISessionAnswers>, op: string, update: Partial<ISessionAnswers>): Promise<void>;
}

export interface SheetStore {
  queryOne(q: Partial<ICharSheet>): Promise<ICharSheet | null | undefined | false>;
  modify(q: Partial<ICharSheet>, op: string, update: Partial<ICharSheet>): Promise<void>;
}

export interface PlayerStore {
  queryOne(q: Record<string, unknown>): Promise<{ flags?: string; data?: Record<string, unknown> } | null | undefined | false>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isStaff(userId: string, players: PlayerStore): Promise<boolean> {
  const p = await players.queryOne({ id: userId });
  if (!p) return false;
  const f = p.flags ?? "";
  return f.includes("admin") || f.includes("wizard") || f.includes("superuser");
}

async function getActiveSession(sessDb: SessionStore): Promise<ISession | null> {
  const all = await sessDb.query({ status: "active" });
  return (all[0] as ISession | undefined) ?? null;
}

async function getEndedSession(sessDb: SessionStore): Promise<ISession | null> {
  const all = await sessDb.query({ status: "ended" });
  if (!all.length) return null;
  return (all as ISession[]).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
}

async function nextSessionNumber(sessDb: SessionStore): Promise<number> {
  const all = await sessDb.query() as ISession[];
  if (!all.length) return 1;
  return Math.max(...all.map((s) => s.number)) + 1;
}

// ─── Route Handler Factory ────────────────────────────────────────────────────
//
//  GET  /api/v1/sessions                — list all sessions (staff) or last 10
//  GET  /api/v1/sessions/current        — active session (or most recent ended)
//  POST /api/v1/sessions                — [staff] start a new session
//  POST /api/v1/sessions/:id/end        — [staff] end a session
//  GET  /api/v1/sessions/:id/answers/my — my answer record for a session
//  POST /api/v1/sessions/:id/answers    — create/update my answers
//  POST /api/v1/sessions/:id/submit     — submit answers and collect XP

export function makeSessionRouter(
  sessDb: SessionStore,
  answerDb: AnswerStore,
  sheetDb: SheetStore,
  playerDb: PlayerStore,
) {
  return async function sessionRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    if (!userId) return err("Unauthorized", 401);

    const url    = new URL(req.url);
    const path   = url.pathname;
    const method = req.method;
    const staff  = await isStaff(userId, playerDb);

    // ── GET /api/v1/sessions ─────────────────────────────────────────────────

    if (path === "/api/v1/sessions" && method === "GET") {
      const all = (await sessDb.query() as ISession[]).sort((a, b) => b.number - a.number);
      return ok(staff ? all : all.slice(0, 10));
    }

    // ── GET /api/v1/sessions/current ─────────────────────────────────────────

    if (path === "/api/v1/sessions/current" && method === "GET") {
      const sess = (await getActiveSession(sessDb)) ?? (await getEndedSession(sessDb));
      if (!sess) return err("No current session", 404);
      return ok(sess);
    }

    // ── POST /api/v1/sessions ────────────────────────────────────────────────

    if (path === "/api/v1/sessions" && method === "POST") {
      if (!staff) return err("Forbidden", 403);

      const existing = await getActiveSession(sessDb);
      if (existing) return err(`Session #${existing.number} is already active`, 409);

      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* title is optional */ }

      const title  = typeof body.title === "string" ? body.title.trim() : "";
      const number = await nextSessionNumber(sessDb);
      const now    = Date.now();

      const sess: ISession = {
        id: crypto.randomUUID(),
        number,
        title,
        status: "active",
        startedAt: now,
        startedBy: userId,
        startedByName: typeof body.startedByName === "string" ? body.startedByName : userId,
      };

      await sessDb.create(sess);
      return ok(sess, 201);
    }

    // ── /api/v1/sessions/:id routes ──────────────────────────────────────────

    const endMatch    = path.match(/^\/api\/v1\/sessions\/([^/]+)\/end$/);
    const myAnsMatch  = path.match(/^\/api\/v1\/sessions\/([^/]+)\/answers\/my$/);
    const ansMatch    = path.match(/^\/api\/v1\/sessions\/([^/]+)\/answers$/);
    const submitMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)\/submit$/);
    const sessMatch   = path.match(/^\/api\/v1\/sessions\/([^/]+)$/);

    // POST /api/v1/sessions/:id/end
    if (endMatch && method === "POST") {
      if (!staff) return err("Forbidden", 403);
      const sess = await sessDb.queryOne({ id: endMatch[1] }) as ISession | null;
      if (!sess) return err("Session not found", 404);
      if (sess.status !== "active") return err("Session is not active", 409);

      const now = Date.now();
      await sessDb.modify({ id: sess.id }, "$set", {
        status: "ended",
        endedAt: now,
        endedBy: userId,
      });
      return ok({ message: "Session ended." });
    }

    // GET /api/v1/sessions/:id/answers/my
    if (myAnsMatch && method === "GET") {
      const sess = await sessDb.queryOne({ id: myAnsMatch[1] }) as ISession | null;
      if (!sess) return err("Session not found", 404);

      const rec = await answerDb.queryOne({ playerId: userId, sessionId: sess.id });
      if (!rec) return err("No answer record for this session", 404);
      return ok(rec);
    }

    // POST /api/v1/sessions/:id/answers  — create or update answer record
    if (ansMatch && method === "POST") {
      const sess = await answerDb.queryOne ? // guard so test mocks work
        await sessDb.queryOne({ id: ansMatch[1] }) as ISession | null
        : null;
      if (!sess) return err("Session not found", 404);
      if (sess.status !== "ended") return err("Session is not in ended state", 409);

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return err("Invalid JSON"); }

      const sheet = await sheetDb.queryOne({ id: userId });
      if (!sheet) return err("No character sheet found", 404);
      const typedSheet = sheet as ICharSheet;

      // Get or create answer record
      let rec = await answerDb.queryOne({ playerId: userId, sessionId: sess.id }) as ISessionAnswers | null;
      if (!rec) {
        rec = createAnswerRecord({
          sessionId: sess.id,
          sessionNumber: sess.number,
          playerId: userId,
          playerName: typedSheet.name,
          playbookId: typedSheet.playbookId,
        });
        await answerDb.create(rec);
      }

      if (rec.submittedAt) return err("Answers already submitted", 409);

      // Validate and merge incoming answers
      const questions  = buildQuestionsForPlaybook(typedSheet.playbookId);
      const validIds   = new Set(questions.map((q) => q.id));
      const incoming   = body.answers as Record<string, unknown> | undefined;
      if (!incoming || typeof incoming !== "object") return err("answers object is required");

      const merged = { ...rec.answers };
      for (const [qId, val] of Object.entries(incoming)) {
        if (!validIds.has(qId)) return err(`Unknown question id: ${qId}`);
        if (val !== true && val !== false) return err(`Answer for ${qId} must be true or false`);
        merged[qId] = val as boolean;
      }

      await answerDb.modify(
        { id: rec.id },
        "$set",
        { answers: merged, updatedAt: Date.now() },
      );

      const updatedRec = { ...rec, answers: merged };
      return ok(updatedRec);
    }

    // POST /api/v1/sessions/:id/submit — submit and collect XP
    if (submitMatch && method === "POST") {
      const sess = await sessDb.queryOne({ id: submitMatch[1] }) as ISession | null;
      if (!sess) return err("Session not found", 404);
      if (sess.status !== "ended") return err("Session has not ended yet", 409);

      const sheet = await sheetDb.queryOne({ id: userId }) as ICharSheet | null;
      if (!sheet) return err("No character sheet found", 404);

      let rec = await answerDb.queryOne({ playerId: userId, sessionId: sess.id }) as ISessionAnswers | null;
      if (!rec) {
        // Create with all-null answers (player submitting with no answers = 0 XP)
        rec = createAnswerRecord({
          sessionId: sess.id,
          sessionNumber: sess.number,
          playerId: userId,
          playerName: sheet.name,
          playbookId: sheet.playbookId,
        });
        await answerDb.create(rec);
      }

      if (rec.submittedAt) return err("Answers already submitted", 409);

      const questions = buildQuestionsForPlaybook(sheet.playbookId);
      const xpEarned  = computeSessionXP(questions, rec.answers, sheet.xp);
      const newXP     = sheet.xp + xpEarned;
      const now       = Date.now();

      await answerDb.modify(
        { id: rec.id },
        "$set",
        { xpEarned, submittedAt: now, updatedAt: now },
      );

      if (xpEarned > 0) {
        await sheetDb.modify({ id: userId }, "$set", { xp: newXP, updatedAt: now });
      }

      return ok({ xpEarned, newXP, sessionNumber: sess.number });
    }

    // GET /api/v1/sessions/:id
    if (sessMatch && method === "GET") {
      const sess = await sessDb.queryOne({ id: sessMatch[1] }) as ISession | null;
      if (!sess) return err("Session not found", 404);
      return ok(sess);
    }

    return err("Not Found", 404);
  };
}
