import { assertEquals } from "@std/assert";
import { makeTrackerRouter } from "../src/plugins/tracker/router.ts";
import type { SheetStore, PlayerStore } from "../src/plugins/tracker/router.ts";
import type { ICharSheet, IHarm, ICorruption } from "../src/plugins/playbooks/schema.ts";

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

function makeSheetStore(initial: Partial<ICharSheet> | null): SheetStore & { _sheet: Partial<ICharSheet> | null } {
  const sheet = initial ? { ...initial } : null;
  return {
    get _sheet() { return sheet; },
    queryOne: () => Promise.resolve(sheet as ICharSheet | null),
    modify: (_q, _op, update) => {
      if (sheet) Object.assign(sheet, update);
      return Promise.resolve();
    },
  };
}

function makePlayerStore(isStaff: boolean): PlayerStore {
  return {
    queryOne: () => Promise.resolve({ flags: isStaff ? "admin" : "player" }),
  };
}

const PLAYERS_NORMAL = makePlayerStore(false);
const PLAYERS_STAFF  = makePlayerStore(true);

function baseSheet(overrides: Partial<ICharSheet> = {}): Partial<ICharSheet> {
  return {
    id: "p1",
    playerId: "p1",
    status: "approved",
    harm: { boxes: [false, false, false, false, false], armor: 0 },
    corruption: { marks: 0, advances: [] },
    ...overrides,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

Deno.test("all routes: no userId → 401", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const routes = [
    req("GET",   "/api/v1/tracker"),
    req("POST",  "/api/v1/tracker/harm/mark"),
    req("POST",  "/api/v1/tracker/harm/heal"),
    req("PATCH", "/api/v1/tracker/armor", { armor: 1 }),
    req("POST",  "/api/v1/tracker/corruption/mark"),
    req("POST",  "/api/v1/tracker/corruption/advance", { advance: "X" }),
    req("GET",   "/api/v1/tracker/p1"),
  ];
  for (const r of routes) {
    const res = await handler(r, null);
    assertEquals(res.status, 401, `${r.method} ${new URL(r.url).pathname}`);
  }
});

// ─── GET /api/v1/tracker ──────────────────────────────────────────────────────

Deno.test("GET /api/v1/tracker: returns harm + corruption", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("GET", "/api/v1/tracker"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(typeof body.harm,       "object");
  assertEquals(typeof body.corruption, "object");
});

Deno.test("GET /api/v1/tracker: no sheet → 404", async () => {
  const handler = makeTrackerRouter(makeSheetStore(null), PLAYERS_NORMAL);
  const res = await handler(req("GET", "/api/v1/tracker"), "p1");
  assertEquals(res.status, 404);
});

// ─── POST /api/v1/tracker/harm/mark ──────────────────────────────────────────

Deno.test("harm/mark: marks first box on empty harm", async () => {
  const store = makeSheetStore(baseSheet());
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/harm/mark"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  const harm = body.harm as IHarm;
  assertEquals(harm.boxes[0], true);
  assertEquals(harm.boxes[1], false);
  // Persisted
  assertEquals((store._sheet!.harm as IHarm).boxes[0], true);
});

Deno.test("harm/mark: 409 when all boxes filled", async () => {
  const handler = makeTrackerRouter(
    makeSheetStore(baseSheet({ harm: { boxes: [true, true, true, true, true], armor: 0 } })),
    PLAYERS_NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/tracker/harm/mark"), "p1");
  assertEquals(res.status, 409);
});

Deno.test("harm/mark: 403 if sheet not approved", async () => {
  const handler = makeTrackerRouter(
    makeSheetStore(baseSheet({ status: "draft" })),
    PLAYERS_NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/tracker/harm/mark"), "p1");
  assertEquals(res.status, 403);
});

Deno.test("harm/mark: 404 if no sheet", async () => {
  const handler = makeTrackerRouter(makeSheetStore(null), PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/harm/mark"), "p1");
  assertEquals(res.status, 404);
});

// ─── POST /api/v1/tracker/harm/heal ──────────────────────────────────────────

Deno.test("harm/heal: heals 1 box by default", async () => {
  const store = makeSheetStore(baseSheet({
    harm: { boxes: [true, true, true, false, false], armor: 0 },
  }));
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/harm/heal"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  const harm = body.harm as IHarm;
  assertEquals(harm.boxes, [true, true, false, false, false]);
});

Deno.test("harm/heal: heals count boxes", async () => {
  const store = makeSheetStore(baseSheet({
    harm: { boxes: [true, true, true, true, false], armor: 0 },
  }));
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/harm/heal", { count: 3 }), "p1");
  assertEquals(res.status, 200);
  const harm = (await json(res)).harm as IHarm;
  assertEquals(harm.boxes, [true, false, false, false, false]);
});

Deno.test("harm/heal: no body is fine (defaults to count=1)", async () => {
  const store = makeSheetStore(baseSheet({
    harm: { boxes: [true, false, false, false, false], armor: 0 },
  }));
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  // Send a request with no body
  const r = new Request("http://localhost/api/v1/tracker/harm/heal", { method: "POST" });
  const res = await handler(r, "p1");
  assertEquals(res.status, 200);
  const harm = (await json(res)).harm as IHarm;
  assertEquals(harm.boxes[0], false);
});

Deno.test("harm/heal: 403 if sheet not approved", async () => {
  const handler = makeTrackerRouter(
    makeSheetStore(baseSheet({ status: "pending" })),
    PLAYERS_NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/tracker/harm/heal"), "p1");
  assertEquals(res.status, 403);
});

// ─── PATCH /api/v1/tracker/armor ─────────────────────────────────────────────

Deno.test("armor: sets armor value", async () => {
  const store = makeSheetStore(baseSheet());
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("PATCH", "/api/v1/tracker/armor", { armor: 2 }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.harm as IHarm).armor, 2);
  assertEquals((store._sheet!.harm as IHarm).armor, 2);
});

Deno.test("armor: clamps to 0", async () => {
  const store = makeSheetStore(baseSheet());
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("PATCH", "/api/v1/tracker/armor", { armor: -5 }), "p1");
  assertEquals(res.status, 200);
  assertEquals(((await json(res)).harm as IHarm).armor, 0);
});

Deno.test("armor: clamps to ARMOR_MAX", async () => {
  const store = makeSheetStore(baseSheet());
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("PATCH", "/api/v1/tracker/armor", { armor: 99 }), "p1");
  assertEquals(res.status, 200);
  assertEquals(((await json(res)).harm as IHarm).armor, 3);
});

Deno.test("armor: missing armor field → 400", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("PATCH", "/api/v1/tracker/armor", {}), "p1");
  assertEquals(res.status, 400);
});

Deno.test("armor: string armor field → 400", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("PATCH", "/api/v1/tracker/armor", { armor: "heavy" }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("armor: 403 if sheet not approved", async () => {
  const handler = makeTrackerRouter(
    makeSheetStore(baseSheet({ status: "rejected" })),
    PLAYERS_NORMAL,
  );
  const res = await handler(req("PATCH", "/api/v1/tracker/armor", { armor: 1 }), "p1");
  assertEquals(res.status, 403);
});

// ─── POST /api/v1/tracker/corruption/mark ────────────────────────────────────

Deno.test("corruption/mark: increments marks", async () => {
  const store = makeSheetStore(baseSheet());
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/mark"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.corruption as ICorruption).marks, 1);
  assertEquals(body.advanceTriggered, false);
});

Deno.test("corruption/mark: triggers advance at 5 marks", async () => {
  const store = makeSheetStore(baseSheet({ corruption: { marks: 4, advances: [] } }));
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/mark"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.advanceTriggered, true);
  assertEquals((body.corruption as ICorruption).marks, 5); // stays at max until advance taken
});

Deno.test("corruption/mark: persists to sheet store", async () => {
  const store = makeSheetStore(baseSheet());
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  await handler(req("POST", "/api/v1/tracker/corruption/mark"), "p1");
  assertEquals((store._sheet!.corruption as ICorruption).marks, 1);
});

Deno.test("corruption/mark: 403 if sheet not approved", async () => {
  const handler = makeTrackerRouter(
    makeSheetStore(baseSheet({ status: "draft" })),
    PLAYERS_NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/tracker/corruption/mark"), "p1");
  assertEquals(res.status, 403);
});

Deno.test("corruption/mark: 404 if no sheet", async () => {
  const handler = makeTrackerRouter(makeSheetStore(null), PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/mark"), "p1");
  assertEquals(res.status, 404);
});

// ─── POST /api/v1/tracker/corruption/advance ─────────────────────────────────

Deno.test("corruption/advance: records advance name", async () => {
  const store = makeSheetStore(baseSheet({ corruption: { marks: 0, advances: [] } }));
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/advance", { advance: "Dark Power" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.corruption as ICorruption).advances, ["Dark Power"]);
  assertEquals((body.corruption as ICorruption).marks, 0);
});

Deno.test("corruption/advance: appends to existing advances", async () => {
  const store = makeSheetStore(baseSheet({ corruption: { marks: 0, advances: ["First"] } }));
  const handler = makeTrackerRouter(store, PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/advance", { advance: "Second" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.corruption as ICorruption).advances, ["First", "Second"]);
});

Deno.test("corruption/advance: missing advance name → 400", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/advance", {}), "p1");
  assertEquals(res.status, 400);
});

Deno.test("corruption/advance: blank advance name → 400", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("POST", "/api/v1/tracker/corruption/advance", { advance: "  " }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("corruption/advance: 403 if sheet not approved", async () => {
  const handler = makeTrackerRouter(
    makeSheetStore(baseSheet({ status: "pending" })),
    PLAYERS_NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/tracker/corruption/advance", { advance: "X" }), "p1");
  assertEquals(res.status, 403);
});

// ─── GET /api/v1/tracker/:id ─────────────────────────────────────────────────

Deno.test("tracker/:id: player can view own tracker", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("GET", "/api/v1/tracker/p1"), "p1");
  assertEquals(res.status, 200);
});

Deno.test("tracker/:id: staff can view any tracker", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet({ id: "p2" })), PLAYERS_STAFF);
  const res = await handler(req("GET", "/api/v1/tracker/p2"), "staff1");
  assertEquals(res.status, 200);
});

Deno.test("tracker/:id: non-staff viewing other player → 403", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet({ id: "p2" })), PLAYERS_NORMAL);
  const res = await handler(req("GET", "/api/v1/tracker/p2"), "p1");
  assertEquals(res.status, 403);
});

Deno.test("tracker/:id: not found → 404", async () => {
  const handler = makeTrackerRouter(makeSheetStore(null), PLAYERS_STAFF);
  const res = await handler(req("GET", "/api/v1/tracker/nobody"), "staff1");
  assertEquals(res.status, 404);
});

// ─── PATCH /api/v1/tracker/:id (staff) ───────────────────────────────────────

Deno.test("tracker/:id PATCH: staff can set harm directly", async () => {
  const store = makeSheetStore(baseSheet({ id: "p2" }));
  const handler = makeTrackerRouter(store, PLAYERS_STAFF);
  const newHarm: IHarm = { boxes: [true, true, false, false, false], armor: 1 };
  const res = await handler(req("PATCH", "/api/v1/tracker/p2", { harm: newHarm }), "staff1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.harm as IHarm).boxes, [true, true, false, false, false]);
  assertEquals((body.harm as IHarm).armor, 1);
});

Deno.test("tracker/:id PATCH: staff can set corruption directly", async () => {
  const store = makeSheetStore(baseSheet({ id: "p2" }));
  const handler = makeTrackerRouter(store, PLAYERS_STAFF);
  const newCorruption: ICorruption = { marks: 3, advances: ["Dark Power"] };
  const res = await handler(req("PATCH", "/api/v1/tracker/p2", { corruption: newCorruption }), "staff1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.corruption as ICorruption).marks, 3);
  assertEquals((body.corruption as ICorruption).advances, ["Dark Power"]);
});

Deno.test("tracker/:id PATCH: non-staff → 403", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet({ id: "p2" })), PLAYERS_NORMAL);
  const res = await handler(req("PATCH", "/api/v1/tracker/p2", { harm: baseSheet().harm }), "p1");
  assertEquals(res.status, 403);
});

Deno.test("tracker/:id PATCH: no valid fields → 400", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet({ id: "p2" })), PLAYERS_STAFF);
  const res = await handler(req("PATCH", "/api/v1/tracker/p2", { color: "red" }), "staff1");
  assertEquals(res.status, 400);
});

Deno.test("tracker/:id PATCH: not found → 404", async () => {
  const handler = makeTrackerRouter(makeSheetStore(null), PLAYERS_STAFF);
  const res = await handler(req("PATCH", "/api/v1/tracker/nobody", { harm: {} }), "staff1");
  assertEquals(res.status, 404);
});

// ─── Unknown routes ───────────────────────────────────────────────────────────

Deno.test("DELETE /api/v1/tracker → 404", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("DELETE", "/api/v1/tracker"), "p1");
  assertEquals(res.status, 404);
});

Deno.test("GET /api/v1/tracker/id/extra → 404", async () => {
  const handler = makeTrackerRouter(makeSheetStore(baseSheet()), PLAYERS_NORMAL);
  const res = await handler(req("GET", "/api/v1/tracker/p1/extra"), "p1");
  assertEquals(res.status, 404);
});
