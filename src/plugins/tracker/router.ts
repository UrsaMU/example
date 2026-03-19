import type { ICharSheet } from "../playbooks/schema.ts";
import {
  markHarm,
  healHarm,
  setArmor,
  markCorruption,
  takeCorruptionAdvance,
  ARMOR_MAX,
} from "./logic.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JSON_H = { "Content-Type": "application/json" };

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_H });
}

function err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_H });
}

// ─── Injectable store interfaces ─────────────────────────────────────────────

export interface SheetStore {
  queryOne(q: Partial<ICharSheet>): Promise<ICharSheet | null | undefined | false>;
  modify(q: Partial<ICharSheet>, op: string, update: Partial<ICharSheet>): Promise<void>;
}

export interface PlayerStore {
  queryOne(q: Record<string, unknown>): Promise<{ flags?: string } | null | undefined | false>;
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
//  GET    /api/v1/tracker              — my harm + corruption state
//  POST   /api/v1/tracker/harm/mark    — mark next harm box
//  POST   /api/v1/tracker/harm/heal    — heal harm boxes (body: { count?: number })
//  PATCH  /api/v1/tracker/armor        — set armor (body: { armor: number })
//  POST   /api/v1/tracker/corruption/mark    — add a corruption mark
//  POST   /api/v1/tracker/corruption/advance — take a corruption advance
//                                             (body: { advance: string })
//  GET    /api/v1/tracker/:id          — [staff] view any player's tracker
//  PATCH  /api/v1/tracker/:id          — [staff] set harm/corruption directly

export function makeTrackerRouter(sheetDb: SheetStore, playerDb: PlayerStore) {
  return async function trackerRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    if (!userId) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Helper: load own sheet or 404
    async function ownSheet(): Promise<ICharSheet | Response> {
      const sheet = await sheetDb.queryOne({ id: userId as string });
      if (!sheet) return err("No character sheet found", 404);
      return sheet as ICharSheet;
    }

    // ── GET /api/v1/tracker ──────────────────────────────────────────────────

    if (path === "/api/v1/tracker" && method === "GET") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      return ok({ harm: sheet.harm, corruption: sheet.corruption });
    }

    // ── POST /api/v1/tracker/harm/mark ───────────────────────────────────────

    if (path === "/api/v1/tracker/harm/mark" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") return err("Sheet must be approved to track harm", 403);

      const updated = markHarm(sheet.harm);
      if (!updated) return err("All harm boxes are already marked (incapacitated)", 409);

      await sheetDb.modify({ id: userId }, "$set", { harm: updated, updatedAt: Date.now() });
      return ok({ harm: updated });
    }

    // ── POST /api/v1/tracker/harm/heal ───────────────────────────────────────

    if (path === "/api/v1/tracker/harm/heal" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") return err("Sheet must be approved to track harm", 403);

      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* count is optional */ }

      const count = typeof body.count === "number" && body.count > 0
        ? Math.round(body.count)
        : 1;

      const updated = healHarm(sheet.harm, count);
      await sheetDb.modify({ id: userId }, "$set", { harm: updated, updatedAt: Date.now() });
      return ok({ harm: updated });
    }

    // ── PATCH /api/v1/tracker/armor ──────────────────────────────────────────

    if (path === "/api/v1/tracker/armor" && method === "PATCH") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") return err("Sheet must be approved to set armor", 403);

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return err("Invalid JSON"); }

      if (typeof body.armor !== "number") {
        return err(`armor must be a number (0–${ARMOR_MAX})`);
      }

      const updated = setArmor(sheet.harm, body.armor);
      await sheetDb.modify({ id: userId }, "$set", { harm: updated, updatedAt: Date.now() });
      return ok({ harm: updated });
    }

    // ── POST /api/v1/tracker/corruption/mark ─────────────────────────────────

    if (path === "/api/v1/tracker/corruption/mark" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") return err("Sheet must be approved to track corruption", 403);

      const { corruption, advanceTriggered } = markCorruption(sheet.corruption);
      await sheetDb.modify({ id: userId }, "$set", { corruption, updatedAt: Date.now() });
      return ok({ corruption, advanceTriggered });
    }

    // ── POST /api/v1/tracker/corruption/advance ──────────────────────────────

    if (path === "/api/v1/tracker/corruption/advance" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") return err("Sheet must be approved to take advances", 403);

      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return err("Invalid JSON"); }

      if (typeof body.advance !== "string" || !body.advance.trim()) {
        return err("advance name is required");
      }

      const corruption = takeCorruptionAdvance(sheet.corruption, body.advance as string);
      await sheetDb.modify({ id: userId }, "$set", { corruption, updatedAt: Date.now() });
      return ok({ corruption });
    }

    // ── Staff routes — GET/PATCH /api/v1/tracker/:id ─────────────────────────

    const targetMatch = path.match(/^\/api\/v1\/tracker\/([^/]+)$/);
    if (targetMatch) {
      const targetId = targetMatch[1];

      if (method === "GET") {
        if (targetId !== userId && !(await isStaff(userId, playerDb))) {
          return err("Forbidden", 403);
        }
        const sheet = await sheetDb.queryOne({ id: targetId });
        if (!sheet) return err("Sheet not found", 404);
        return ok({ harm: (sheet as ICharSheet).harm, corruption: (sheet as ICharSheet).corruption });
      }

      if (method === "PATCH") {
        if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
        const sheet = await sheetDb.queryOne({ id: targetId });
        if (!sheet) return err("Sheet not found", 404);

        let body: Record<string, unknown>;
        try { body = await req.json(); } catch { return err("Invalid JSON"); }

        const update: Partial<ICharSheet> = { updatedAt: Date.now() };

        if (body.harm && typeof body.harm === "object") {
          update.harm = body.harm as ICharSheet["harm"];
        }
        if (body.corruption && typeof body.corruption === "object") {
          update.corruption = body.corruption as ICharSheet["corruption"];
        }

        if (Object.keys(update).length === 1) return err("No valid fields to update");

        await sheetDb.modify({ id: targetId }, "$set", update);
        const updated = await sheetDb.queryOne({ id: targetId });
        return ok({
          harm: (updated as ICharSheet).harm,
          corruption: (updated as ICharSheet).corruption,
        });
      }
    }

    return err("Not Found", 404);
  };
}
