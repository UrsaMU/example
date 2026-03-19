import type { IDebtRecord } from "./schema.ts";

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

export interface DebtStore {
  query(q?: Partial<IDebtRecord>): Promise<IDebtRecord[]>;
  queryOne(
    q: Partial<IDebtRecord>,
  ): Promise<IDebtRecord | null | undefined | false>;
  create(record: IDebtRecord): Promise<IDebtRecord>;
  modify(
    q: Partial<IDebtRecord>,
    op: string,
    update: Partial<IDebtRecord>,
  ): Promise<void>;
  delete(q: Partial<IDebtRecord>): Promise<void>;
}

export interface PlayerStore {
  queryOne(
    q: Record<string, unknown>,
  ): Promise<
    | { flags?: string; data?: Record<string, unknown> }
    | null
    | undefined
    | false
  >;
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
//  GET    /api/v1/debts              — list my debts (?direction=owed|owes, ?active=true|false)
//  POST   /api/v1/debts              — create a debt record
//  GET    /api/v1/debts/all          — [staff] all debt records
//  GET    /api/v1/debts/:id          — get one (owner or staff)
//  PATCH  /api/v1/debts/:id          — edit description / otherName / otherId
//  POST   /api/v1/debts/:id/cashin   — mark as cashed in
//  DELETE /api/v1/debts/:id          — delete (owner or staff)

export function makeDebtsRouter(debtDb: DebtStore, playerDb: PlayerStore) {
  return async function debtsRouteHandler(
    req: Request,
    userId: string | null,
  ): Promise<Response> {
    if (!userId) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // ── GET /api/v1/debts ────────────────────────────────────────────────────

    if (path === "/api/v1/debts" && method === "GET") {
      let records = await debtDb.query({ ownerId: userId });

      const dir = url.searchParams.get("direction");
      if (dir === "owed" || dir === "owes") {
        records = records.filter((r) => r.direction === dir);
      }

      const activeParam = url.searchParams.get("active");
      if (activeParam === "true") {
        records = records.filter((r) => !r.cashedIn);
      } else if (activeParam === "false") {
        records = records.filter((r) => r.cashedIn);
      }

      return ok(records);
    }

    // ── POST /api/v1/debts ───────────────────────────────────────────────────

    if (path === "/api/v1/debts" && method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return err("Invalid JSON");
      }

      if (
        typeof body.direction !== "string" ||
        !["owed", "owes"].includes(body.direction)
      ) {
        return err("direction must be 'owed' or 'owes'");
      }
      if (typeof body.otherName !== "string" || !body.otherName.trim()) {
        return err("otherName is required");
      }
      if (typeof body.description !== "string" || !body.description.trim()) {
        return err("description is required");
      }

      // Resolve the owner's display name from their dbobj
      const player = await playerDb.queryOne({ id: userId });
      const ownerName = (player?.data?.name as string) || userId;

      const now = Date.now();
      const record: IDebtRecord = {
        id: crypto.randomUUID(),
        ownerId: userId,
        ownerName,
        direction: body.direction as "owed" | "owes",
        otherName: (body.otherName as string).trim(),
        otherId: typeof body.otherId === "string"
          ? body.otherId.trim()
          : undefined,
        description: (body.description as string).trim(),
        cashedIn: false,
        createdAt: now,
        updatedAt: now,
      };

      await debtDb.create(record);
      return ok(record, 201);
    }

    // ── GET /api/v1/debts/all ────────────────────────────────────────────────

    if (path === "/api/v1/debts/all" && method === "GET") {
      if (!(await isStaff(userId, playerDb))) return err("Forbidden", 403);
      const all = await debtDb.query();
      return ok(all);
    }

    // ── Debt record routes (:id) ─────────────────────────────────────────────

    const debtMatch = path.match(/^\/api\/v1\/debts\/([^/]+)$/);
    const cashinMatch = path.match(/^\/api\/v1\/debts\/([^/]+)\/cashin$/);

    // POST /api/v1/debts/:id/cashin
    if (cashinMatch && method === "POST") {
      const record = await debtDb.queryOne({ id: cashinMatch[1] });
      if (!record) return err("Debt not found", 404);
      if (record.ownerId !== userId && !(await isStaff(userId, playerDb))) {
        return err("Forbidden", 403);
      }
      if (record.cashedIn) return err("Debt already cashed in", 409);

      const now = Date.now();
      await debtDb.modify({ id: record.id }, "$set", {
        cashedIn: true,
        cashedInAt: now,
        updatedAt: now,
      });
      return ok({ message: "Debt cashed in." });
    }

    if (debtMatch) {
      const debtId = debtMatch[1];

      // GET /api/v1/debts/:id
      if (method === "GET") {
        const record = await debtDb.queryOne({ id: debtId });
        if (!record) return err("Debt not found", 404);
        if (record.ownerId !== userId && !(await isStaff(userId, playerDb))) {
          return err("Forbidden", 403);
        }
        return ok(record);
      }

      // PATCH /api/v1/debts/:id
      if (method === "PATCH") {
        const record = await debtDb.queryOne({ id: debtId });
        if (!record) return err("Debt not found", 404);
        if (record.ownerId !== userId && !(await isStaff(userId, playerDb))) {
          return err("Forbidden", 403);
        }
        if (record.cashedIn) return err("Cannot edit a cashed-in debt", 409);

        let body: Record<string, unknown>;
        try {
          body = await req.json();
        } catch {
          return err("Invalid JSON");
        }

        const update: Partial<IDebtRecord> = { updatedAt: Date.now() };
        if (typeof body.description === "string" && body.description.trim()) {
          update.description = body.description.trim();
        }
        if (typeof body.otherName === "string" && body.otherName.trim()) {
          update.otherName = body.otherName.trim();
        }
        if (typeof body.otherId === "string") {
          update.otherId = body.otherId.trim() || undefined;
        }

        if (Object.keys(update).length === 1) {
          return err("No valid fields to update");
        }

        await debtDb.modify({ id: debtId }, "$set", update);
        const updated = await debtDb.queryOne({ id: debtId });
        return ok(updated);
      }

      // DELETE /api/v1/debts/:id
      if (method === "DELETE") {
        const record = await debtDb.queryOne({ id: debtId });
        if (!record) return err("Debt not found", 404);
        if (record.ownerId !== userId && !(await isStaff(userId, playerDb))) {
          return err("Forbidden", 403);
        }
        await debtDb.delete({ id: debtId });
        return ok({ message: "Debt deleted." });
      }
    }

    return err("Not Found", 404);
  };
}
