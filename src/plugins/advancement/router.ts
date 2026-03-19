import type { ICharSheet } from "../playbooks/schema.ts";
import { getPlaybook } from "../playbooks/data.ts";
import {
  applyAdvance,
  canTakeAdvance,
  markXP,
  validateAdvance,
} from "./logic.ts";

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

// ─── Injectable store interfaces ─────────────────────────────────────────────

export interface SheetStore {
  queryOne(
    q: unknown,
  ): Promise<ICharSheet | undefined>;
  modify(
    q: unknown,
    op: string,
    update: Partial<ICharSheet>,
  ): Promise<unknown>;
}

export interface PlayerStore {
  queryOne(
    q: Record<string, unknown>,
  ): Promise<{ flags?: string } | null | undefined | false>;
}

// ─── Staff check ──────────────────────────────────────────────────────────────

async function isStaff(userId: string, players: PlayerStore): Promise<boolean> {
  const p = await players.queryOne({ id: userId });
  if (!p) return false;
  const f = p.flags || "";
  return f.includes("admin") || f.includes("wizard") || f.includes("superuser");
}

// ─── Route Handler Factory ────────────────────────────────────────────────────
//
//  GET    /api/v1/advancement              — my XP + advances taken + available advances
//  POST   /api/v1/advancement/xp           — mark XP (optionally with a reason)
//  POST   /api/v1/advancement/advance      — spend 5 XP for an advance (body: { advanceId })
//  GET    /api/v1/advancement/all          — [staff] all sheets' xp/advances summary
//  GET    /api/v1/advancement/:id          — [staff or self] view any player's advancement
//  PATCH  /api/v1/advancement/:id          — [staff] set xp/takenAdvances directly

export function makeAdvancementRouter(
  sheetDb: SheetStore,
  playerDb: PlayerStore,
) {
  return async function advancementRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    if (!userId) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Helper: load a sheet or return 404
    async function loadSheet(id: string): Promise<ICharSheet | Response> {
      const s = await sheetDb.queryOne({ id } as Partial<ICharSheet>);
      if (!s) return err("No character sheet found", 404);
      return s as ICharSheet;
    }

    // Helper: build the full advancement view for a sheet
    function advancementView(sheet: ICharSheet) {
      const pb = getPlaybook(sheet.playbookId);
      return {
        xp: sheet.xp ?? 0,
        xpToAdvance: 5,
        readyToAdvance: canTakeAdvance(sheet.xp ?? 0),
        takenAdvances: sheet.takenAdvances ?? [],
        availableAdvances: pb?.advances ?? [],
      };
    }

    // ── GET /api/v1/advancement ──────────────────────────────────────────────

    if (path === "/api/v1/advancement" && method === "GET") {
      const sheet = await loadSheet(userId);
      if (sheet instanceof Response) return sheet;
      return ok(advancementView(sheet));
    }

    // ── POST /api/v1/advancement/xp ──────────────────────────────────────────

    if (path === "/api/v1/advancement/xp" && method === "POST") {
      const sheet = await loadSheet(userId);
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") {
        return err("Sheet must be approved to mark XP", 403);
      }

      // Optional reason in body (ignored if body is missing or malformed)
      let reason: string | undefined;
      try {
        const body = await req.json() as Record<string, unknown>;
        if (typeof body.reason === "string" && body.reason.trim()) {
          reason = body.reason.trim();
        }
      } catch { /* reason is optional */ }

      const currentXP = sheet.xp ?? 0;
      if (currentXP >= 5) {
        return err("XP already at max (5) — take an advance first", 409);
      }

      const newXP = markXP(currentXP);
      await sheetDb.modify({ id: userId }, "$set", {
        xp: newXP,
        updatedAt: Date.now(),
      });
      return ok({ xp: newXP, readyToAdvance: canTakeAdvance(newXP), reason });
    }

    // ── POST /api/v1/advancement/advance ─────────────────────────────────────

    if (path === "/api/v1/advancement/advance" && method === "POST") {
      const sheet = await loadSheet(userId);
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") {
        return err("Sheet must be approved to take advances", 403);
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      if (typeof body.advanceId !== "string" || !body.advanceId.trim()) {
        return err("advanceId is required");
      }

      const advanceId = (body.advanceId as string).trim();
      const pb = getPlaybook(sheet.playbookId);
      if (!pb) return err("Unknown playbook on sheet", 500);

      const safeSheet = {
        xp: sheet.xp ?? 0,
        takenAdvances: sheet.takenAdvances ?? [],
        stats: sheet.stats,
        circleRatings: sheet.circleRatings,
      };

      const validationError = validateAdvance(safeSheet, advanceId, pb);
      if (validationError) {
        const messages: Record<string, [string, number]> = {
          "not-enough-xp": ["Need 5 XP to take an advance", 409],
          "unknown-advance": [`Unknown advance: '${advanceId}'`, 400],
          "major-advance-locked": [
            "Major advances require 5 regular advances first",
            403,
          ],
          "advance-maxed": [
            "You have already taken this advance the maximum times",
            409,
          ],
          "stat-at-max": ["That stat is already at the maximum (+2)", 409],
          "circle-at-max": [
            "That circle rating is already at the maximum",
            409,
          ],
        };
        const [msg, status] = messages[validationError] ??
          ["Advance not allowed", 400];
        return err(msg, status);
      }

      const advance = pb.advances.find((a) => a.id === advanceId)!;
      const { xp, takenAdvances, stats } = applyAdvance(safeSheet, advance);

      const update: Partial<ICharSheet> = {
        xp,
        takenAdvances,
        updatedAt: Date.now(),
      };
      if (advance.statBoost) update.stats = stats;

      await sheetDb.modify({ id: userId }, "$set", update);
      return ok({ xp, takenAdvances, advance, stats: update.stats });
    }

    // ── GET /api/v1/advancement/all ──────────────────────────────────────────

    if (path === "/api/v1/advancement/all" && method === "GET") {
      if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
      // We can't query all sheets easily without a full query — rely on the
      // sheet store supporting an empty query.
      const all =
        await (sheetDb as unknown as { query(): Promise<ICharSheet[]> })
          .query();
      return ok(all.map((s) => ({
        playerId: s.playerId,
        name: s.name,
        playbookId: s.playbookId,
        xp: s.xp ?? 0,
        takenAdvances: s.takenAdvances ?? [],
      })));
    }

    // ── GET/PATCH /api/v1/advancement/:id ────────────────────────────────────

    const targetMatch = path.match(/^\/api\/v1\/advancement\/([^/]+)$/);
    if (targetMatch) {
      const targetId = targetMatch[1];

      if (method === "GET") {
        if (targetId !== userId && !(await isStaff(userId, playerDb))) {
          return err("Forbidden", 403);
        }
        const sheet = await loadSheet(targetId);
        if (sheet instanceof Response) return sheet;
        return ok(advancementView(sheet));
      }

      if (method === "PATCH") {
        if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
        const sheet = await loadSheet(targetId);
        if (sheet instanceof Response) return sheet;

        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          return err("Invalid JSON");
        }

        const update: Partial<ICharSheet> = { updatedAt: Date.now() };
        if (typeof body.xp === "number") {
          update.xp = Math.max(0, Math.min(5, Math.round(body.xp)));
        }
        if (Array.isArray(body.takenAdvances)) {
          update.takenAdvances = (body.takenAdvances as unknown[]).filter(
            (v) => typeof v === "string",
          ) as string[];
        }

        if (Object.keys(update).length === 1) {
          return err("No valid fields to update");
        }

        await sheetDb.modify({ id: targetId }, "$set", update);
        const updated = await loadSheet(targetId);
        if (updated instanceof Response) return updated;
        return ok(advancementView(updated));
      }
    }

    return err("Not Found", 404);
  };
}
