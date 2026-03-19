import { assertEquals } from "@std/assert";
import { makeAdvancementRouter } from "../src/plugins/advancement/router.ts";
import type { SheetStore, PlayerStore } from "../src/plugins/advancement/router.ts";
import type { ICharSheet } from "../src/plugins/playbooks/schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return await res.json();
}

// ─── Mock stores ──────────────────────────────────────────────────────────────

function makeSheetStore(
  initial: Partial<ICharSheet> | null,
): SheetStore & { _sheet: Partial<ICharSheet> | null; query(): Promise<ICharSheet[]> } {
  const sheet = initial ? { ...initial } : null;
  return {
    get _sheet() { return sheet; },
    queryOne: () => Promise.resolve(sheet as ICharSheet | null),
    modify: (_q, _op, update) => { if (sheet) Object.assign(sheet, update); return Promise.resolve(); },
    query: () => Promise.resolve(sheet ? [sheet as ICharSheet] : []),
  };
}

function makePlayerStore(isStaff: boolean): PlayerStore {
  return { queryOne: () => Promise.resolve({ flags: isStaff ? "admin" : "player" }) };
}

const NORMAL = makePlayerStore(false);
const STAFF  = makePlayerStore(true);

// The "aware" playbook is in data.ts and has STANDARD_ADVANCES, so we can
// use it to exercise real advance validation.
function approvedSheet(overrides: Partial<ICharSheet> = {}): Partial<ICharSheet> {
  return {
    id: "p1",
    playerId: "p1",
    playbookId: "aware",
    status: "approved",
    name: "Talia",
    stats: { blood: 0, heart: 1, mind: -1, spirit: 1 },
    circleRatings: { mortalis: 1, night: 0, power: 1, wild: -1 },
    xp: 0,
    takenAdvances: [],
    ...overrides,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

Deno.test("all routes: no userId → 401", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet()), NORMAL);
  for (const r of [
    req("GET",  "/api/v1/advancement"),
    req("POST", "/api/v1/advancement/xp"),
    req("POST", "/api/v1/advancement/advance", { advanceId: "x" }),
    req("GET",  "/api/v1/advancement/p1"),
  ]) {
    const res = await handler(r, null);
    assertEquals(res.status, 401, `${r.method} ${new URL(r.url).pathname}`);
  }
});

// ─── GET /api/v1/advancement ──────────────────────────────────────────────────

Deno.test("GET /api/v1/advancement: returns xp + advances + availableAdvances", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.xp, 0);
  assertEquals(body.xpToAdvance, 5);
  assertEquals(body.readyToAdvance, false);
  assertEquals(Array.isArray(body.takenAdvances), true);
  assertEquals(Array.isArray(body.availableAdvances), true);
  assertEquals((body.availableAdvances as unknown[]).length > 0, true);
});

Deno.test("GET /api/v1/advancement: no sheet → 404", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement"), "p1");
  assertEquals(res.status, 404);
});

Deno.test("GET /api/v1/advancement: readyToAdvance=true at xp=5", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 5 })), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement"), "p1");
  const body = await json(res);
  assertEquals(body.readyToAdvance, true);
  assertEquals(body.xp, 5);
});

// ─── POST /api/v1/advancement/xp ─────────────────────────────────────────────

Deno.test("xp mark: increments xp", async () => {
  const store = makeSheetStore(approvedSheet({ xp: 2 }));
  const handler = makeAdvancementRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/xp"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.xp, 3);
  assertEquals(store._sheet!.xp, 3);
});

Deno.test("xp mark: readyToAdvance=true when xp reaches 5", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 4 })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/xp"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.xp, 5);
  assertEquals(body.readyToAdvance, true);
});

Deno.test("xp mark: 409 when already at max xp", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 5 })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/xp"), "p1");
  assertEquals(res.status, 409);
});

Deno.test("xp mark: optional reason stored in response", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 0 })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/xp", { reason: "Missed a roll" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.reason, "Missed a roll");
});

Deno.test("xp mark: no body is fine (reason optional)", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 0 })), NORMAL);
  const r = new Request("http://localhost/api/v1/advancement/xp", { method: "POST" });
  const res = await handler(r, "p1");
  assertEquals(res.status, 200);
});

Deno.test("xp mark: 403 if sheet not approved", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ status: "draft" })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/xp"), "p1");
  assertEquals(res.status, 403);
});

// ─── POST /api/v1/advancement/advance ────────────────────────────────────────

Deno.test("advance: takes a valid advance (spends XP, records it)", async () => {
  const store = makeSheetStore(approvedSheet({ xp: 5 }));
  const handler = makeAdvancementRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "move-own-1" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.xp, 0);
  assertEquals((body.takenAdvances as string[]).includes("move-own-1"), true);
  assertEquals(store._sheet!.xp, 0);
});

Deno.test("advance: stat boost updates stats", async () => {
  const store = makeSheetStore(approvedSheet({
    xp: 5,
    stats: { blood: 0, heart: 1, mind: -1, spirit: 1 },
  }));
  const handler = makeAdvancementRouter(store, NORMAL);
  const res = await handler(
    req("POST", "/api/v1/advancement/advance", { advanceId: "stat-blood" }),
    "p1",
  );
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.stats as Record<string, number>).blood, 1);
  assertEquals((store._sheet!.stats as Record<string, number>).blood, 1);
});

Deno.test("advance: 400 when advanceId missing", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 5 })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/advance", {}), "p1");
  assertEquals(res.status, 400);
});

Deno.test("advance: 400 for unknown advance id", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 5 })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "fly-to-moon" }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("advance: 409 when not enough XP", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 4 })), NORMAL);
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "move-own-1" }), "p1");
  assertEquals(res.status, 409);
});

Deno.test("advance: 409 when advance already maxed out", async () => {
  const handler = makeAdvancementRouter(
    makeSheetStore(approvedSheet({ xp: 5, takenAdvances: ["move-own-1"] })),
    NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "move-own-1" }), "p1");
  assertEquals(res.status, 409);
});

Deno.test("advance: 409 when stat already at max", async () => {
  const handler = makeAdvancementRouter(
    makeSheetStore(approvedSheet({
      xp: 5,
      stats: { blood: 2, heart: 1, mind: -1, spirit: 1 },
    })),
    NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "stat-blood" }), "p1");
  assertEquals(res.status, 409);
});

Deno.test("advance: 403 major advance locked until 5 regular advances", async () => {
  const handler = makeAdvancementRouter(
    makeSheetStore(approvedSheet({ xp: 5, takenAdvances: ["move-own-1"] })),
    NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "retire" }), "p1");
  assertEquals(res.status, 403);
});

Deno.test("advance: 403 if sheet not approved", async () => {
  const handler = makeAdvancementRouter(
    makeSheetStore(approvedSheet({ xp: 5, status: "pending" })),
    NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/advancement/advance", { advanceId: "move-own-1" }), "p1");
  assertEquals(res.status, 403);
});

// ─── GET /api/v1/advancement/all (staff) ─────────────────────────────────────

Deno.test("GET /api/v1/advancement/all: staff gets summary of all sheets", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 3 })), STAFF);
  const res = await handler(req("GET", "/api/v1/advancement/all"), "staff1");
  assertEquals(res.status, 200);
  const body = await res.json() as Array<Record<string, unknown>>;
  assertEquals(body.length, 1);
  assertEquals(body[0].xp, 3);
  assertEquals(body[0].playerId, "p1");
});

Deno.test("GET /api/v1/advancement/all: non-staff → 403", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement/all"), "p1");
  assertEquals(res.status, 403);
});

// ─── GET /api/v1/advancement/:id ─────────────────────────────────────────────

Deno.test("GET /api/v1/advancement/:id: player views own advancement", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ xp: 2 })), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement/p1"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.xp, 2);
});

Deno.test("GET /api/v1/advancement/:id: staff views any", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ id: "p2" })), STAFF);
  const res = await handler(req("GET", "/api/v1/advancement/p2"), "staff1");
  assertEquals(res.status, 200);
});

Deno.test("GET /api/v1/advancement/:id: non-staff views other → 403", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ id: "p2" })), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement/p2"), "p1");
  assertEquals(res.status, 403);
});

Deno.test("GET /api/v1/advancement/:id: not found → 404", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(null), STAFF);
  const res = await handler(req("GET", "/api/v1/advancement/nobody"), "staff1");
  assertEquals(res.status, 404);
});

// ─── PATCH /api/v1/advancement/:id (staff) ───────────────────────────────────

Deno.test("PATCH /api/v1/advancement/:id: staff sets xp directly", async () => {
  const store = makeSheetStore(approvedSheet({ id: "p2" }));
  const handler = makeAdvancementRouter(store, STAFF);
  const res = await handler(req("PATCH", "/api/v1/advancement/p2", { xp: 3 }), "staff1");
  assertEquals(res.status, 200);
  assertEquals(store._sheet!.xp, 3);
});

Deno.test("PATCH /api/v1/advancement/:id: xp is clamped to 0–5", async () => {
  const store = makeSheetStore(approvedSheet({ id: "p2" }));
  const handler = makeAdvancementRouter(store, STAFF);
  await handler(req("PATCH", "/api/v1/advancement/p2", { xp: 99 }), "staff1");
  assertEquals(store._sheet!.xp, 5);
});

Deno.test("PATCH /api/v1/advancement/:id: staff sets takenAdvances directly", async () => {
  const store = makeSheetStore(approvedSheet({ id: "p2" }));
  const handler = makeAdvancementRouter(store, STAFF);
  const res = await handler(req("PATCH", "/api/v1/advancement/p2", { takenAdvances: ["move-own-1"] }), "staff1");
  assertEquals(res.status, 200);
  assertEquals(store._sheet!.takenAdvances, ["move-own-1"]);
});

Deno.test("PATCH /api/v1/advancement/:id: non-staff → 403", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ id: "p2" })), NORMAL);
  const res = await handler(req("PATCH", "/api/v1/advancement/p2", { xp: 3 }), "p1");
  assertEquals(res.status, 403);
});

Deno.test("PATCH /api/v1/advancement/:id: no valid fields → 400", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet({ id: "p2" })), STAFF);
  const res = await handler(req("PATCH", "/api/v1/advancement/p2", { color: "purple" }), "staff1");
  assertEquals(res.status, 400);
});

// ─── Unknown routes ───────────────────────────────────────────────────────────

Deno.test("DELETE /api/v1/advancement → 404", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet()), NORMAL);
  const res = await handler(req("DELETE", "/api/v1/advancement"), "p1");
  assertEquals(res.status, 404);
});

Deno.test("GET /api/v1/advancement/id/extra → 404", async () => {
  const handler = makeAdvancementRouter(makeSheetStore(approvedSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/advancement/p1/extra"), "p1");
  assertEquals(res.status, 404);
});
