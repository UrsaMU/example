import { assertEquals, assertExists } from "@std/assert";
import { makeMovesRouter } from "../src/plugins/moves/router.ts";
import type { SheetStore } from "../src/plugins/moves/router.ts";
import type { ICharSheet } from "../src/plugins/playbooks/schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStore(sheet: ICharSheet | null): SheetStore {
  return {
    queryOne: () => Promise.resolve(sheet),
  };
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return await res.json();
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SHEET: ICharSheet = {
  id: "u1",
  playerId: "u1",
  playbookId: "aware",
  status: "approved",
  name: "Test",
  look: "",
  demeanor: "",
  stats: { blood: 0, heart: 1, mind: -1, spirit: 1 },
  circleRatings: { mortalis: 1, night: 0, power: 1, wild: -1 },
  circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 },
  harm: { boxes: [false, false, false, false, false], armor: 0 },
  corruption: { marks: 0, advances: [] },
  selectedMoves: ["aware-i-know-a-guy", "aware-the-lions-den", "hunter-deadly"],
  gear: [],
  features: {},
  introAnswers: {},
  debts: [],
  notes: "",
  xp: 0,
  takenAdvances: [],
  createdAt: 0,
  updatedAt: 0,
};

// ─── GET /api/v1/moves ────────────────────────────────────────────────────────

Deno.test("GET /api/v1/moves: returns all moves", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves"), null);
  assertEquals(res.status, 200);
  const data = await res.json() as unknown[];
  assertEquals(Array.isArray(data), true);
  assertEquals(data.length >= 60, true);
});

Deno.test("GET /api/v1/moves: each entry includes stat and isPassive fields", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves"), null);
  const data = await res.json() as Array<Record<string, unknown>>;
  for (const m of data) {
    assertExists(m.id);
    assertExists(m.name);
    assertExists(m.description);
    assertExists(m.playbookId);
    assertEquals(typeof m.isPassive, "boolean");
  }
});

Deno.test("GET /api/v1/moves?playbook=aware: filtered to aware only", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves?playbook=aware"), null);
  assertEquals(res.status, 200);
  const data = await res.json() as Array<Record<string, unknown>>;
  assertEquals(data.length > 0, true);
  assertEquals(data.every((m) => m.playbookId === "aware"), true);
});

Deno.test("GET /api/v1/moves?playbook=hunter: filtered to hunter only", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves?playbook=hunter"), null);
  const data = await res.json() as Array<Record<string, unknown>>;
  assertEquals(data.every((m) => m.playbookId === "hunter"), true);
});

// ─── GET /api/v1/moves/my ─────────────────────────────────────────────────────

Deno.test("GET /api/v1/moves/my: no auth → 401", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves/my"), null);
  assertEquals(res.status, 401);
});

Deno.test("GET /api/v1/moves/my: no sheet → 404", async () => {
  const handler = makeMovesRouter(makeStore(null));
  const res = await handler(req("GET", "/api/v1/moves/my"), "u1");
  assertEquals(res.status, 404);
});

Deno.test("GET /api/v1/moves/my: returns only sheet's selected moves", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves/my"), "u1");
  assertEquals(res.status, 200);
  const data = await res.json() as Array<Record<string, unknown>>;
  assertEquals(data.length, 3);
  const ids = data.map((m) => m.id);
  assertEquals(ids.includes("aware-i-know-a-guy"), true);
  assertEquals(ids.includes("aware-the-lions-den"), true);
  assertEquals(ids.includes("hunter-deadly"), true);
});

Deno.test("GET /api/v1/moves/my: cross-playbook move shows correct source", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("GET", "/api/v1/moves/my"), "u1");
  const data = await res.json() as Array<Record<string, unknown>>;
  const deadly = data.find((m) => m.id === "hunter-deadly");
  assertExists(deadly);
  assertEquals(deadly.playbookId, "hunter");
});

// ─── GET /api/v1/moves/:id ────────────────────────────────────────────────────

Deno.test("GET /api/v1/moves/:id: found by exact ID", async () => {
  const handler = makeMovesRouter(makeStore(null));
  const res = await handler(
    req("GET", "/api/v1/moves/aware-i-know-a-guy"),
    null,
  );
  assertEquals(res.status, 200);
  const data = await json(res);
  assertEquals(data.id, "aware-i-know-a-guy");
  assertEquals(data.stat, "heart");
  assertEquals(data.isPassive, false);
});

Deno.test("GET /api/v1/moves/:id: passive move shows isPassive=true and stat=null", async () => {
  const handler = makeMovesRouter(makeStore(null));
  const res = await handler(req("GET", "/api/v1/moves/hunter-deadly"), null);
  assertEquals(res.status, 200);
  const data = await json(res);
  assertEquals(data.isPassive, true);
  assertEquals(data.stat, null);
});

Deno.test("GET /api/v1/moves/:id: not found → 404", async () => {
  const handler = makeMovesRouter(makeStore(null));
  const res = await handler(req("GET", "/api/v1/moves/bogus-id"), null);
  assertEquals(res.status, 404);
});

// ─── POST /api/v1/moves/resolve ───────────────────────────────────────────────

Deno.test("POST /api/v1/moves/resolve: no auth → 401", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(
    req("POST", "/api/v1/moves/resolve", { moveId: "aware-i-know-a-guy" }),
    null,
  );
  assertEquals(res.status, 401);
});

Deno.test("POST /api/v1/moves/resolve: missing moveId → 400", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(req("POST", "/api/v1/moves/resolve", {}), "u1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/moves/resolve: invalid JSON → 400", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(
    new Request("http://localhost/api/v1/moves/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }),
    "u1",
  );
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/moves/resolve: unknown moveId → 404", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(
    req("POST", "/api/v1/moves/resolve", { moveId: "bogus-id" }),
    "u1",
  );
  assertEquals(res.status, 404);
});

Deno.test("POST /api/v1/moves/resolve: rolling move returns roll data", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(
    req("POST", "/api/v1/moves/resolve", { moveId: "aware-i-know-a-guy" }),
    "u1",
  );
  assertEquals(res.status, 200);
  const data = await json(res);
  assertEquals(data.stat, "heart");
  assertEquals(data.isPassive, false);
  assertEquals(data.statValue, 1); // heart: 1 on SHEET
  assertExists(data.roll);
  const roll = data.roll as Record<string, unknown>;
  assertEquals(typeof roll.total, "number");
  assertEquals(
    ["miss", "weak", "strong"].includes(roll.outcome as string),
    true,
  );
});

Deno.test("POST /api/v1/moves/resolve: passive move returns null roll", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  const res = await handler(
    req("POST", "/api/v1/moves/resolve", { moveId: "hunter-deadly" }),
    "u1",
  );
  assertEquals(res.status, 200);
  const data = await json(res);
  assertEquals(data.isPassive, true);
  assertEquals(data.stat, null);
  assertEquals(data.roll, null);
});

Deno.test("POST /api/v1/moves/resolve: bonus is forwarded to roll", async () => {
  const handler = makeMovesRouter(makeStore(SHEET));
  // Run 20 times; with +2 bonus the minimum total is 2+2+1+2 = 7 (weak at worst)
  for (let i = 0; i < 20; i++) {
    const res = await handler(
      req("POST", "/api/v1/moves/resolve", {
        moveId: "aware-i-know-a-guy",
        bonus: 5,
      }),
      "u1",
    );
    const data = await json(res);
    const roll = data.roll as Record<string, unknown>;
    assertEquals(roll.bonus, 5);
  }
});

Deno.test("POST /api/v1/moves/resolve: no sheet defaults stat to 0", async () => {
  const handler = makeMovesRouter(makeStore(null));
  const res = await handler(
    req("POST", "/api/v1/moves/resolve", { moveId: "aware-i-know-a-guy" }),
    "u1",
  );
  assertEquals(res.status, 200);
  const data = await json(res);
  assertEquals(data.statValue, 0);
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

Deno.test("unknown route → 404", async () => {
  const handler = makeMovesRouter(makeStore(null));
  const res = await handler(req("GET", "/api/v1/unknown"), null);
  assertEquals(res.status, 404);
});
