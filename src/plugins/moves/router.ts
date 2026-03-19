import type { ICharSheet } from "../playbooks/schema.ts";
import {
  buildMoveIndex,
  extractStat,
  findMove,
  getSheetMoves,
  resolveMove,
} from "./logic.ts";
import { rollDice } from "../dice/logic.ts";
import type { StatName } from "../dice/logic.ts";

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

// ─── Injectable store interfaces ──────────────────────────────────────────────

export interface SheetStore {
  queryOne(
    query: Partial<ICharSheet>,
  ): Promise<ICharSheet | null | undefined | false>;
}

// ─── Route Handler Factory ────────────────────────────────────────────────────
//
//  GET  /api/v1/moves              — list all moves (?playbook=<id> to filter)
//  GET  /api/v1/moves/my           — moves on the authenticated player's sheet
//  GET  /api/v1/moves/:id          — get a single move by ID or partial name
//  POST /api/v1/moves/resolve      — trigger a move (roll + text)
//
//  resolve request body:  { moveId: string, bonus?: number }
//  resolve response:      { move, stat, isPassive, statValue?, roll? }

export function makeMovesRouter(sheetsDb: SheetStore) {
  return async function movesRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // ── GET /api/v1/moves ─────────────────────────────────────────────────────

    if (path === "/api/v1/moves" && method === "GET") {
      const filter = url.searchParams.get("playbook");
      const index = buildMoveIndex();
      let moves = [...index.values()];

      if (filter) {
        moves = moves.filter((m) => m.playbookId === filter);
      }

      return ok(
        moves.map((m) => ({
          ...m,
          stat: extractStat(m.description),
          isPassive: !extractStat(m.description),
        })),
      );
    }

    // ── GET /api/v1/moves/my ──────────────────────────────────────────────────

    if (path === "/api/v1/moves/my" && method === "GET") {
      if (!userId) return err("Unauthorized", 401);

      const sheet = await sheetsDb.queryOne(
        { id: userId } as Partial<ICharSheet>,
      );
      if (!sheet) return err("No sheet found", 404);

      const moves = getSheetMoves(sheet as ICharSheet);
      return ok(
        moves.map((m) => ({
          ...m,
          stat: extractStat(m.description),
          isPassive: !extractStat(m.description),
        })),
      );
    }

    // ── POST /api/v1/moves/resolve ────────────────────────────────────────────

    if (path === "/api/v1/moves/resolve" && method === "POST") {
      if (!userId) return err("Unauthorized", 401);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const moveId = typeof body.moveId === "string" ? body.moveId.trim() : "";
      if (!moveId) return err("moveId is required");

      const move = findMove(moveId);
      if (!move) return err(`Move not found: ${moveId}`, 404);

      const bonus = typeof body.bonus === "number" ? Math.round(body.bonus) : 0;
      const stat = extractStat(move.description);

      // Passive — no roll
      if (!stat) {
        return ok({
          move,
          stat: null,
          isPassive: true,
          statValue: null,
          roll: null,
        });
      }

      // Look up the player's current stat value
      const sheet = await sheetsDb.queryOne(
        { id: userId } as Partial<ICharSheet>,
      );
      const statValue = sheet
        ? ((sheet as ICharSheet).stats[stat as StatName] ?? 0)
        : 0;
      const roll = rollDice(statValue, bonus);

      return ok({ move, stat, isPassive: false, statValue, roll });
    }

    // ── GET /api/v1/moves/:id ─────────────────────────────────────────────────

    const moveMatch = path.match(/^\/api\/v1\/moves\/([^/]+)$/);
    if (moveMatch && method === "GET") {
      const move = findMove(moveMatch[1]);
      if (!move) return err("Move not found", 404);

      return ok({
        ...move,
        stat: extractStat(move.description),
        isPassive: !extractStat(move.description),
      });
    }

    return err("Not Found", 404);
  };
}
