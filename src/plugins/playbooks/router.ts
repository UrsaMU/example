import { getPlaybook, listPlaybooks } from "./data.ts";
import type { ChargenStatus, ICharSheet } from "./schema.ts";

// ─── Injectable store interfaces ─────────────────────────────────────────────

export interface SheetStore {
  query(q?: Partial<ICharSheet>): Promise<ICharSheet[]>;
  queryOne(
    q: Partial<ICharSheet>,
  ): Promise<ICharSheet | null | undefined | false>;
  create(record: ICharSheet): Promise<ICharSheet>;
  modify(
    q: Partial<ICharSheet>,
    op: string,
    update: Partial<ICharSheet>,
  ): Promise<void>;
  delete(q: Partial<ICharSheet>): Promise<void>;
}

export interface PlayerStore {
  queryOne(
    q: Record<string, unknown>,
  ): Promise<{ flags?: string; data?: unknown } | null | undefined | false>;
  modify(
    q: Record<string, unknown>,
    op: string,
    update: Record<string, unknown>,
  ): Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JSON_H = { "Content-Type": "application/json" };

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_H });
}

function err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: JSON_H,
  });
}

async function isStaff(
  userId: string,
  playerDb: PlayerStore,
): Promise<boolean> {
  const player = await playerDb.queryOne({ id: userId });
  if (!player) return false;
  const f = player.flags || "";
  return f.includes("admin") || f.includes("wizard") || f.includes("superuser");
}

function makeEmptySheet(
  playerId: string,
  playbookId: string,
  playerName: string,
): ICharSheet {
  const pb = getPlaybook(playbookId)!;
  const now = Date.now();
  return {
    id: playerId,
    playerId,
    playbookId,
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
}

// ─── Route Handler Factory ────────────────────────────────────────────────────
//
//  GET    /api/v1/playbooks              — list all playbooks (summary)
//  GET    /api/v1/playbooks/:id          — get full playbook definition
//  GET    /api/v1/chargen               — get current user's sheet
//  POST   /api/v1/chargen               — start chargen (pick playbook)
//  PATCH  /api/v1/chargen               — update sheet fields
//  DELETE /api/v1/chargen               — reset/abandon sheet (draft only)
//  POST   /api/v1/chargen/submit        — submit sheet for approval
//  GET    /api/v1/chargen/checklist     — chargen progress + circle status preview
//  GET    /api/v1/chargen/all           — [staff] list all sheets
//  GET    /api/v1/chargen/:id           — [staff] view any sheet
//  PATCH  /api/v1/chargen/:id/status    — [staff] approve or reject

export function makePlaybooksRouter(
  sheetDb: SheetStore,
  playerDb: PlayerStore,
) {
  return async function playbooksRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // ── Playbook catalogue (public) ────────────────────────────────────────

    if (path === "/api/v1/playbooks" && method === "GET") {
      return ok(listPlaybooks());
    }

    const pbMatch = path.match(/^\/api\/v1\/playbooks\/([^/]+)$/);
    if (pbMatch && method === "GET") {
      const pb = getPlaybook(pbMatch[1]);
      if (!pb) return err("Playbook not found", 404);
      return ok(pb);
    }

    // All chargen routes require auth
    if (!userId) return err("Unauthorized", 401);

    // ── Chargen checklist (progress + circle status preview) ───────────────

    if (path === "/api/v1/chargen/checklist" && method === "GET") {
      const sheet = await sheetDb.queryOne({ id: userId });
      if (!sheet) {
        return ok({
          complete: false,
          problems: ["No sheet started — POST /api/v1/chargen to begin"],
        });
      }
      const problems = validateSheet(sheet);
      const pb = getPlaybook(sheet.playbookId);
      return ok({
        complete: problems.length === 0,
        status: sheet.status,
        problems,
        circleStatus: sheet.circleStatus,
        circleRatings: sheet.circleRatings,
        homeCircle: pb?.circle ?? null,
      });
    }

    // ── Staff: all sheets ──────────────────────────────────────────────────

    if (path === "/api/v1/chargen/all" && method === "GET") {
      if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
      const all = await sheetDb.query();
      return ok(all);
    }

    // ── Submit for approval ────────────────────────────────────────────────

    if (path === "/api/v1/chargen/submit" && method === "POST") {
      const sheet = await sheetDb.queryOne({ id: userId });
      if (!sheet) return err("No character sheet found", 404);
      if (sheet.status !== "draft") {
        return err("Sheet is not in draft status", 400);
      }

      const problems = validateSheet(sheet);
      if (problems.length) {
        return err(`Sheet incomplete: ${problems.join("; ")}`, 422);
      }

      await sheetDb.modify({ id: userId }, "$set", {
        status: "pending",
        updatedAt: Date.now(),
      });
      return ok({ message: "Sheet submitted for staff approval." });
    }

    // ── Staff: view specific sheet / approve / reject ──────────────────────

    const sheetStatusMatch = path.match(
      /^\/api\/v1\/chargen\/([^/]+)\/status$/,
    );
    const sheetIdMatch = path.match(/^\/api\/v1\/chargen\/([^/]+)$/);

    if (sheetStatusMatch && method === "PATCH") {
      if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
      const targetId = sheetStatusMatch[1];
      const sheet = await sheetDb.queryOne({ id: targetId });
      if (!sheet) return err("Sheet not found", 404);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const newStatus = body.status as ChargenStatus;
      if (!["approved", "rejected"].includes(newStatus)) {
        return err("status must be 'approved' or 'rejected'");
      }

      const update: Partial<ICharSheet> = {
        status: newStatus,
        updatedAt: Date.now(),
      };
      if (newStatus === "rejected" && typeof body.reason === "string") {
        update.rejectionReason = body.reason;
      }

      await sheetDb.modify({ id: targetId }, "$set", update);

      if (newStatus === "approved") {
        await applySheetToPlayer(targetId, sheet, playerDb);
      }

      return ok({ message: `Sheet ${newStatus}.` });
    }

    if (sheetIdMatch && method === "GET") {
      const targetId = sheetIdMatch[1];
      if (targetId !== userId && !(await isStaff(userId, playerDb))) {
        return err("Forbidden", 403);
      }
      const sheet = await sheetDb.queryOne({ id: targetId });
      if (!sheet) return err("Sheet not found", 404);
      return ok(sheet);
    }

    // ── Current user's sheet ───────────────────────────────────────────────

    if (path === "/api/v1/chargen" && method === "GET") {
      const sheet = await sheetDb.queryOne({ id: userId });
      return ok(sheet ?? null);
    }

    if (path === "/api/v1/chargen" && method === "POST") {
      const existing = await sheetDb.queryOne({ id: userId });
      if (existing && existing.status !== "rejected") {
        return err(
          "You already have a character sheet. PATCH to update or DELETE to reset.",
          409,
        );
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const playbookId = typeof body.playbookId === "string"
        ? body.playbookId.trim()
        : "";
      if (!getPlaybook(playbookId)) {
        return err(`Unknown playbook: '${playbookId}'`);
      }

      const player = await playerDb.queryOne({ id: userId });
      const playerName =
        (player?.data as Record<string, unknown>)?.name as string || userId;

      const sheet = makeEmptySheet(userId, playbookId, playerName);
      await sheetDb.create(sheet);
      return ok(sheet, 201);
    }

    if (path === "/api/v1/chargen" && method === "PATCH") {
      const sheet = await sheetDb.queryOne({ id: userId });
      if (!sheet) return err("No character sheet found. POST first.", 404);
      if (sheet.status === "approved") {
        return err("Approved sheets cannot be edited.", 403);
      }
      if (sheet.status === "pending") {
        return err(
          "Sheet is pending review. Contact staff to make changes.",
          403,
        );
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const update = buildUpdate(sheet, body);
      if (!update) return err("No valid fields to update");

      update.updatedAt = Date.now();
      if (sheet.status === "rejected") update.status = "draft";

      await sheetDb.modify({ id: userId }, "$set", update);
      const updated = await sheetDb.queryOne({ id: userId });
      return ok(updated);
    }

    if (path === "/api/v1/chargen" && method === "DELETE") {
      const sheet = await sheetDb.queryOne({ id: userId });
      if (!sheet) return err("No sheet to delete", 404);
      if (sheet.status === "approved") {
        return err("Cannot delete an approved sheet", 403);
      }
      await sheetDb.delete({ id: userId });
      return ok({ message: "Sheet deleted." });
    }

    return err("Not Found", 404);
  };
}

// ─── Field update builder ─────────────────────────────────────────────────────
// Only allows safe, schema-defined fields to be updated

function buildUpdate(
  sheet: ICharSheet,
  body: Record<string, unknown>,
): Partial<ICharSheet> | null {
  const update: Partial<ICharSheet> = {};
  const pb = getPlaybook(sheet.playbookId)!;

  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.look === "string") update.look = body.look.trim();
  if (typeof body.demeanor === "string") {
    if (!pb.demeanors.includes(body.demeanor)) return null; // invalid
    update.demeanor = body.demeanor;
  }

  // Stats — player adds +1 to exactly one base stat
  if (body.stats && typeof body.stats === "object") {
    const incoming = body.stats as Record<string, number>;
    const base = pb.baseStats;
    const updated = { ...sheet.stats };
    let bonusCount = 0;

    for (const key of ["blood", "heart", "mind", "spirit"] as const) {
      if (typeof incoming[key] === "number") {
        updated[key] = incoming[key];
        if (incoming[key] !== base[key]) bonusCount++;
      }
    }

    if (bonusCount > 1) return null; // can only boost one stat
    update.stats = updated;
  }

  // Circle ratings — player adds +1 to exactly one
  if (body.circleRatings && typeof body.circleRatings === "object") {
    const incoming = body.circleRatings as Record<string, number>;
    const base = pb.circleRatings;
    const updated = { ...sheet.circleRatings };
    let bonusCount = 0;

    for (const key of ["mortalis", "night", "power", "wild"] as const) {
      if (typeof incoming[key] === "number") {
        updated[key] = incoming[key];
        if (incoming[key] !== base[key]) bonusCount++;
      }
    }

    if (bonusCount > 1) return null;
    update.circleRatings = updated;
  }

  // Selected moves — must include all required moves
  if (Array.isArray(body.selectedMoves)) {
    const validIds = new Set(pb.moves.map((m) => m.id));
    const requiredIds = pb.moves.filter((m) => m.required).map((m) => m.id);
    const selected = body.selectedMoves as string[];

    if (!selected.every((id) => validIds.has(id))) return null; // unknown move
    if (!requiredIds.every((id) => selected.includes(id))) return null; // missing required

    update.selectedMoves = selected;
  }

  if (Array.isArray(body.gear)) {
    update.gear = (body.gear as unknown[]).filter((g) =>
      typeof g === "string"
    ) as string[];
  }

  if (body.features && typeof body.features === "object") {
    update.features = body.features as Record<string, unknown>;
  }

  if (body.introAnswers && typeof body.introAnswers === "object") {
    update.introAnswers = body.introAnswers as Record<string, string>;
  }

  if (Array.isArray(body.debts)) {
    update.debts = body.debts as ICharSheet["debts"];
  }

  if (typeof body.notes === "string") update.notes = body.notes;

  return Object.keys(update).length ? update : null;
}

// ─── Sheet validation ─────────────────────────────────────────────────────────

function validateSheet(sheet: ICharSheet): string[] {
  const problems: string[] = [];
  const pb = getPlaybook(sheet.playbookId);
  if (!pb) {
    problems.push("Unknown playbook");
    return problems;
  }

  // Identity
  if (!sheet.name.trim()) problems.push("name is required");
  if (!sheet.look.trim()) problems.push("look is required");
  if (!pb.demeanors.includes(sheet.demeanor)) {
    problems.push("demeanor must be chosen from the playbook list");
  }

  // Stats: exactly one +1 applied
  const statKeys = ["blood", "heart", "mind", "spirit"] as const;
  const boosted =
    statKeys.filter((k) => sheet.stats[k] !== pb.baseStats[k]).length;
  if (boosted === 0) problems.push("you must boost one stat by +1");
  if (boosted > 1) problems.push("only one stat may be boosted");
  // Stat values must be base + 0 or base + 1 only
  for (const k of statKeys) {
    const diff = sheet.stats[k] - pb.baseStats[k];
    if (diff !== 0 && diff !== 1) problems.push(`invalid value for stat ${k}`);
  }

  // Circle ratings: exactly one +1 applied
  const circleKeys = ["mortalis", "night", "power", "wild"] as const;
  const circBoosted =
    circleKeys.filter((k) => sheet.circleRatings[k] !== pb.circleRatings[k])
      .length;
  if (circBoosted === 0) {
    problems.push("you must boost one circle rating by +1");
  }
  if (circBoosted > 1) problems.push("only one circle rating may be boosted");
  for (const k of circleKeys) {
    const diff = sheet.circleRatings[k] - pb.circleRatings[k];
    if (diff !== 0 && diff !== 1) {
      problems.push(`invalid value for circle rating ${k}`);
    }
  }

  // Moves: all required present, exact total count
  const requiredMoves = pb.moves.filter((m) => m.required).map((m) => m.id);
  for (const id of requiredMoves) {
    if (!sheet.selectedMoves.includes(id)) {
      problems.push(`required move missing: ${id}`);
    }
  }
  if (sheet.selectedMoves.length !== pb.moveCount) {
    problems.push(
      `must select exactly ${pb.moveCount} move(s) (have ${sheet.selectedMoves.length})`,
    );
  }

  // Gear: at least one entry
  if (!sheet.gear.length) problems.push("gear must be filled in");

  // Intro questions: all must be answered
  for (const q of pb.introQuestions) {
    const answer = sheet.introAnswers[q];
    if (!answer || !answer.trim()) {
      problems.push(`intro question unanswered: "${q}"`);
    }
  }

  // Starting debts: at least as many debts as the playbook lists
  if (sheet.debts.length < pb.startingDebts.length) {
    problems.push(
      `must have at least ${pb.startingDebts.length} starting debt(s) (have ${sheet.debts.length})`,
    );
  }
  // Each debt must have a target and description
  for (let i = 0; i < sheet.debts.length; i++) {
    const d = sheet.debts[i];
    if (!d.to?.trim()) problems.push(`debt ${i + 1}: 'to' field is required`);
    if (!d.description?.trim()) {
      problems.push(`debt ${i + 1}: description is required`);
    }
    if (!["owed", "owes"].includes(d.direction)) {
      problems.push(`debt ${i + 1}: direction must be 'owed' or 'owes'`);
    }
  }

  // Playbook features: required feature defs must be filled
  for (const def of pb.featureDefs) {
    if (!def.required) continue;
    const val = sheet.features[def.key];
    const empty = val === undefined || val === null || val === "" ||
      (Array.isArray(val) && val.length === 0);
    if (empty) problems.push(`feature required: ${def.label}`);
  }

  return problems;
}

// ─── Apply approved sheet to player dbobj ────────────────────────────────────

async function applySheetToPlayer(
  playerId: string,
  sheet: ICharSheet,
  playerDb: PlayerStore,
): Promise<void> {
  const player = await playerDb.queryOne({ id: playerId });
  if (!player) return;

  const pb = getPlaybook(sheet.playbookId);
  const currentData = (player.data as Record<string, unknown>) || {};

  await playerDb.modify(
    { id: playerId },
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
