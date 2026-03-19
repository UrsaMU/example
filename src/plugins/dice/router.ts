import type { ICharSheet } from "../playbooks/schema.ts";
import { rollDice, STAT_NAMES } from "./logic.ts";
import type { StatName } from "./logic.ts";

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

// ─── Minimal sheet-store interface ────────────────────────────────────────────
// Using a structural type lets tests pass a plain in-memory mock.

export interface SheetStore {
  queryOne(
    query: Partial<ICharSheet>,
  ): Promise<ICharSheet | null | undefined | false>;
}

// ─── Route Handler Factory ────────────────────────────────────────────────────
//
//  POST  /api/v1/roll   — roll 2d6 + a named stat from the player's sheet
//
//  Request body:
//    { stat: "blood"|"heart"|"mind"|"spirit", bonus?: number }
//
//  Response:
//    { statName, dice, stat, bonus, total, outcome, outcomeLabel, sheetFound }

export function makeDiceRouter(sheetsDb: SheetStore) {
  return async function diceRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // ── POST /api/v1/roll ────────────────────────────────────────────────────

    if (path === "/api/v1/roll" && method === "POST") {
      if (!userId) return err("Unauthorized", 401);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const statName = typeof body.stat === "string" ? body.stat.trim() : "";
      if (!STAT_NAMES.includes(statName as StatName)) {
        return err(`stat must be one of: ${STAT_NAMES.join(", ")}`);
      }

      const bonus = typeof body.bonus === "number" ? Math.round(body.bonus) : 0;

      // Look up the player's sheet for their current stat value.
      // If they have no sheet yet (e.g. staff test roll), stat defaults to 0.
      const sheet = await sheetsDb.queryOne(
        { id: userId } as Partial<ICharSheet>,
      );
      const statValue: number = sheet
        ? (sheet.stats[statName as StatName] ?? 0)
        : 0;

      const result = rollDice(statValue, bonus);

      return ok({
        statName,
        sheetFound: !!sheet,
        ...result,
      });
    }

    return err("Not Found", 404);
  };
}
