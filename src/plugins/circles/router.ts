import type { ICharSheet } from "../playbooks/schema.ts";
import {
  CIRCLE_NAMES,
  CIRCLE_STATUS_MAX,
  CIRCLE_STATUS_MIN,
} from "./schema.ts";
import type { CircleName, IFactionEntry } from "./schema.ts";
import { adjustCircle, improveCircle, markCircle } from "./logic.ts";

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

function isCircleName(s: string): s is CircleName {
  return (CIRCLE_NAMES as readonly string[]).includes(s);
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

export interface FactionStore {
  query(q?: Partial<IFactionEntry>): Promise<IFactionEntry[]>;
  queryOne(
    q: unknown,
  ): Promise<IFactionEntry | undefined>;
  create(record: IFactionEntry): Promise<IFactionEntry>;
  modify(
    q: unknown,
    op: string,
    update: Partial<IFactionEntry>,
  ): Promise<unknown>;
  delete(q: unknown): Promise<unknown>;
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
//  GET    /api/v1/circles                    — my circle status + factions
//  POST   /api/v1/circles/mark               — mark a circle (-1 status)
//  POST   /api/v1/circles/improve            — improve a circle (+1 status)
//  POST   /api/v1/circles/adjust             — adjust a circle by ±N
//  GET    /api/v1/circles/factions           — list my factions
//  POST   /api/v1/circles/factions           — add a faction affiliation
//  PATCH  /api/v1/circles/factions/:id       — update faction status/notes
//  DELETE /api/v1/circles/factions/:id       — remove a faction
//  GET    /api/v1/circles/:id                — [staff or self] view any player
//  PATCH  /api/v1/circles/:id                — [staff] set circle status directly

export function makeCirclesRouter(
  sheetDb: SheetStore,
  factionDb: FactionStore,
  playerDb: PlayerStore,
) {
  return async function circlesRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    if (!userId) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    async function ownSheet(): Promise<ICharSheet | Response> {
      const s = await sheetDb.queryOne({ id: userId as string });
      if (!s) return err("No character sheet found", 404);
      return s as ICharSheet;
    }

    // ── GET /api/v1/circles ──────────────────────────────────────────────────

    if (path === "/api/v1/circles" && method === "GET") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      const myFactions = await factionDb.query({ playerId: userId });
      return ok({
        circleStatus: sheet.circleStatus,
        circleRatings: sheet.circleRatings,
        factions: myFactions,
      });
    }

    // ── POST /api/v1/circles/mark ────────────────────────────────────────────

    if (path === "/api/v1/circles/mark" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") {
        return err("Sheet must be approved", 403);
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const circle = typeof body.circle === "string" ? body.circle.trim() : "";
      if (!isCircleName(circle)) {
        return err(`circle must be one of: ${CIRCLE_NAMES.join(", ")}`);
      }

      const updated = markCircle(sheet.circleStatus, circle);
      if (!updated) {
        return err(
          `${circle} status is already at minimum (${CIRCLE_STATUS_MIN})`,
          409,
        );
      }

      await sheetDb.modify({ id: userId }, "$set", {
        circleStatus: updated,
        updatedAt: Date.now(),
      });
      return ok({ circleStatus: updated, marked: circle });
    }

    // ── POST /api/v1/circles/improve ─────────────────────────────────────────

    if (path === "/api/v1/circles/improve" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") {
        return err("Sheet must be approved", 403);
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const circle = typeof body.circle === "string" ? body.circle.trim() : "";
      if (!isCircleName(circle)) {
        return err(`circle must be one of: ${CIRCLE_NAMES.join(", ")}`);
      }

      const updated = improveCircle(sheet.circleStatus, circle);
      if (!updated) {
        return err(
          `${circle} status is already at maximum (${CIRCLE_STATUS_MAX})`,
          409,
        );
      }

      await sheetDb.modify({ id: userId }, "$set", {
        circleStatus: updated,
        updatedAt: Date.now(),
      });
      return ok({ circleStatus: updated, improved: circle });
    }

    // ── POST /api/v1/circles/adjust ──────────────────────────────────────────

    if (path === "/api/v1/circles/adjust" && method === "POST") {
      const sheet = await ownSheet();
      if (sheet instanceof Response) return sheet;
      if (sheet.status !== "approved") {
        return err("Sheet must be approved", 403);
      }

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const circle = typeof body.circle === "string" ? body.circle.trim() : "";
      if (!isCircleName(circle)) {
        return err(`circle must be one of: ${CIRCLE_NAMES.join(", ")}`);
      }

      if (typeof body.delta !== "number") return err("delta must be a number");
      const delta = Math.round(body.delta);

      const updated = adjustCircle(sheet.circleStatus, circle, delta);
      await sheetDb.modify({ id: userId }, "$set", {
        circleStatus: updated,
        updatedAt: Date.now(),
      });
      return ok({ circleStatus: updated, adjusted: circle, delta });
    }

    // ── Faction routes ────────────────────────────────────────────────────────

    if (path === "/api/v1/circles/factions" && method === "GET") {
      const myFactions = await factionDb.query({ playerId: userId });
      return ok(myFactions);
    }

    if (path === "/api/v1/circles/factions" && method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      const circle = typeof body.circle === "string" ? body.circle.trim() : "";
      if (!isCircleName(circle)) {
        return err(`circle must be one of: ${CIRCLE_NAMES.join(", ")}`);
      }

      if (typeof body.name !== "string" || !body.name.trim()) {
        return err("faction name is required");
      }

      const status = typeof body.status === "number"
        ? Math.max(
          CIRCLE_STATUS_MIN,
          Math.min(CIRCLE_STATUS_MAX, Math.round(body.status)),
        )
        : 0;

      const now = Date.now();
      const entry: IFactionEntry = {
        id: crypto.randomUUID(),
        playerId: userId,
        circle,
        name: (body.name as string).trim(),
        status,
        notes: typeof body.notes === "string" ? body.notes.trim() : "",
        createdAt: now,
        updatedAt: now,
      };

      await factionDb.create(entry);
      return ok(entry, 201);
    }

    const factionMatch = path.match(/^\/api\/v1\/circles\/factions\/([^/]+)$/);
    if (factionMatch) {
      const factionId = factionMatch[1];

      if (method === "PATCH") {
        const entry = await factionDb.queryOne({ id: factionId });
        if (!entry) return err("Faction not found", 404);
        if (
          (entry as IFactionEntry).playerId !== userId &&
          !(await isStaff(userId, playerDb))
        ) {
          return err("Forbidden", 403);
        }

        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          return err("Invalid JSON");
        }

        const update: Partial<IFactionEntry> = { updatedAt: Date.now() };
        if (typeof body.name === "string" && body.name.trim()) {
          update.name = body.name.trim();
        }
        if (typeof body.status === "number") {
          update.status = Math.max(
            CIRCLE_STATUS_MIN,
            Math.min(CIRCLE_STATUS_MAX, Math.round(body.status)),
          );
        }
        if (typeof body.notes === "string") {
          update.notes = body.notes.trim();
        }

        if (Object.keys(update).length === 1) {
          return err("No valid fields to update");
        }

        await factionDb.modify({ id: factionId }, "$set", update);
        const updated = await factionDb.queryOne({ id: factionId });
        return ok(updated);
      }

      if (method === "DELETE") {
        const entry = await factionDb.queryOne({ id: factionId });
        if (!entry) return err("Faction not found", 404);
        if (
          (entry as IFactionEntry).playerId !== userId &&
          !(await isStaff(userId, playerDb))
        ) {
          return err("Forbidden", 403);
        }
        await factionDb.delete({ id: factionId });
        return ok({ message: "Faction removed." });
      }
    }

    // ── Staff/self: GET/PATCH /api/v1/circles/:id ────────────────────────────

    const playerMatch = path.match(/^\/api\/v1\/circles\/([^/]+)$/);
    if (playerMatch) {
      const targetId = playerMatch[1];

      if (method === "GET") {
        if (targetId !== userId && !(await isStaff(userId, playerDb))) {
          return err("Forbidden", 403);
        }
        const sheet = await sheetDb.queryOne({ id: targetId });
        if (!sheet) return err("Sheet not found", 404);
        const theirFactions = await factionDb.query({ playerId: targetId });
        return ok({
          circleStatus: (sheet as ICharSheet).circleStatus,
          circleRatings: (sheet as ICharSheet).circleRatings,
          factions: theirFactions,
        });
      }

      if (method === "PATCH") {
        if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
        const sheet = await sheetDb.queryOne({ id: targetId });
        if (!sheet) return err("Sheet not found", 404);

        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          return err("Invalid JSON");
        }

        const update: Partial<ICharSheet> = { updatedAt: Date.now() };

        if (body.circleStatus && typeof body.circleStatus === "object") {
          const cs = body.circleStatus as Record<string, unknown>;
          update.circleStatus = {
            mortalis: typeof cs.mortalis === "number"
              ? Math.max(
                CIRCLE_STATUS_MIN,
                Math.min(CIRCLE_STATUS_MAX, Math.round(cs.mortalis)),
              )
              : (sheet as ICharSheet).circleStatus.mortalis,
            night: typeof cs.night === "number"
              ? Math.max(
                CIRCLE_STATUS_MIN,
                Math.min(CIRCLE_STATUS_MAX, Math.round(cs.night)),
              )
              : (sheet as ICharSheet).circleStatus.night,
            power: typeof cs.power === "number"
              ? Math.max(
                CIRCLE_STATUS_MIN,
                Math.min(CIRCLE_STATUS_MAX, Math.round(cs.power)),
              )
              : (sheet as ICharSheet).circleStatus.power,
            wild: typeof cs.wild === "number"
              ? Math.max(
                CIRCLE_STATUS_MIN,
                Math.min(CIRCLE_STATUS_MAX, Math.round(cs.wild)),
              )
              : (sheet as ICharSheet).circleStatus.wild,
          };
        }

        if (Object.keys(update).length === 1) {
          return err("No valid fields to update");
        }

        await sheetDb.modify({ id: targetId }, "$set", update);
        const updated = await sheetDb.queryOne({ id: targetId });
        const theirFactions = await factionDb.query({ playerId: targetId });
        return ok({
          circleStatus: (updated as ICharSheet).circleStatus,
          circleRatings: (updated as ICharSheet).circleRatings,
          factions: theirFactions,
        });
      }
    }

    return err("Not Found", 404);
  };
}
