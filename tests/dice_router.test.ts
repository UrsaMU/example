import { assertEquals } from "@std/assert";
import { makeDiceRouter } from "../src/plugins/dice/router.ts";
import type { SheetStore } from "../src/plugins/dice/router.ts";
import type { ICharSheet } from "../src/plugins/playbooks/schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = "POST", path = "/api/v1/roll"): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return await res.json();
}

// ─── Mock sheet store ─────────────────────────────────────────────────────────

function makeStore(sheet: Partial<ICharSheet> | null): SheetStore {
  return {
    queryOne: () => Promise.resolve(sheet as ICharSheet | null),
  };
}

const APPROVED_SHEET: Partial<ICharSheet> = {
  id: "player1",
  playerId: "player1",
  playbookId: "wolf",
  status: "approved",
  stats: { blood: 1, heart: 0, mind: -1, spirit: 1 },
  circleRatings: { mortalis: -1, night: 0, power: 1, wild: 1 },
  circleStatus: { mortalis: 0, night: 0, power: 1, wild: 0 },
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

Deno.test("POST /api/v1/roll: requires auth → 401", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const res = await handler(makeRequest({ stat: "blood" }), null);
  assertEquals(res.status, 401);
  const body = await json(res);
  assertEquals(body.error, "Unauthorized");
});

// ─── Input validation ─────────────────────────────────────────────────────────

Deno.test("POST /api/v1/roll: missing stat → 400", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const res = await handler(makeRequest({}), "player1");
  assertEquals(res.status, 400);
  const body = await json(res);
  assertEquals(typeof body.error, "string");
});

Deno.test("POST /api/v1/roll: invalid stat name → 400", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const res = await handler(makeRequest({ stat: "luck" }), "player1");
  assertEquals(res.status, 400);
  const body = await json(res);
  assertEquals(typeof body.error, "string");
});

Deno.test("POST /api/v1/roll: numeric stat field → 400", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const res = await handler(makeRequest({ stat: 3 }), "player1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/roll: empty string stat → 400", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const res = await handler(makeRequest({ stat: "" }), "player1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/roll: invalid JSON body → 400", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const req = new Request("http://localhost/api/v1/roll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  const res = await handler(req, "player1");
  assertEquals(res.status, 400);
});

// ─── Stat routing (uses sheet stats) ─────────────────────────────────────────

Deno.test("POST /api/v1/roll: uses blood stat from sheet", async () => {
  // Wolf sheet: blood=1. With [3,3] dice → total = 3+3+1 = 7 → weak
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const req = new Request("http://localhost/api/v1/roll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stat: "blood" }),
  });
  // We can't inject dice via the router directly, but we can verify the stat
  // is read correctly by checking sheetFound and statName in the response.
  const res = await handler(req, "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.statName, "blood");
  assertEquals(body.sheetFound, true);
  assertEquals(body.stat, 1); // wolf blood=1
  assertEquals(typeof (body.total), "number");
  assertEquals(typeof (body.outcome), "string");
});

Deno.test("POST /api/v1/roll: uses mind stat from sheet (negative)", async () => {
  // Wolf sheet: mind=-1.
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const req = new Request("http://localhost/api/v1/roll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stat: "mind" }),
  });
  const res = await handler(req, "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.stat, -1); // wolf mind=-1
  assertEquals(body.sheetFound, true);
});

Deno.test("POST /api/v1/roll: all four stat names are valid", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  for (const stat of ["blood", "heart", "mind", "spirit"]) {
    const res = await handler(makeRequest({ stat }), "player1");
    assertEquals(res.status, 200, `stat '${stat}' should be valid`);
  }
});

// ─── No sheet (stat defaults to 0) ───────────────────────────────────────────

Deno.test("POST /api/v1/roll: no sheet → stat defaults to 0, sheetFound=false", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const res = await handler(makeRequest({ stat: "heart" }), "no-sheet-player");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.stat, 0);
  assertEquals(body.sheetFound, false);
  assertEquals(body.statName, "heart");
});

// ─── Bonus modifier ───────────────────────────────────────────────────────────

Deno.test("POST /api/v1/roll: bonus is added to total", async () => {
  const handler = makeDiceRouter(makeStore(null)); // stat=0
  const res = await handler(makeRequest({ stat: "blood", bonus: 2 }), "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.bonus, 2);
  // total = dice + 0 + 2; at minimum dice=2 so total ≥ 4
  assertEquals((body.total as number) >= 4, true);
});

Deno.test("POST /api/v1/roll: bonus of 0 is fine", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const res = await handler(makeRequest({ stat: "spirit", bonus: 0 }), "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.bonus, 0);
});

Deno.test("POST /api/v1/roll: non-numeric bonus is ignored (defaults to 0)", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const res = await handler(makeRequest({ stat: "spirit", bonus: "big" }), "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.bonus, 0);
});

Deno.test("POST /api/v1/roll: fractional bonus is rounded", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const res = await handler(makeRequest({ stat: "spirit", bonus: 1.7 }), "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.bonus, 2);
});

// ─── Response shape ───────────────────────────────────────────────────────────

Deno.test("POST /api/v1/roll: response has all expected fields", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  const res = await handler(makeRequest({ stat: "heart" }), "player1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(typeof body.statName,     "string");
  assertEquals(typeof body.sheetFound,   "boolean");
  assertEquals(typeof body.stat,         "number");
  assertEquals(typeof body.bonus,        "number");
  assertEquals(typeof body.total,        "number");
  assertEquals(typeof body.outcome,      "string");
  assertEquals(typeof body.outcomeLabel, "string");
  assertEquals(Array.isArray(body.dice),  true);
  assertEquals((body.dice as number[]).length, 2);
});

Deno.test("POST /api/v1/roll: dice values are 1-6", async () => {
  const handler = makeDiceRouter(makeStore(null));
  for (let i = 0; i < 20; i++) {
    const res = await handler(makeRequest({ stat: "blood" }), "player1");
    const body = await json(res);
    const dice = body.dice as number[];
    assertEquals(dice[0] >= 1 && dice[0] <= 6, true, `d1=${dice[0]} out of range`);
    assertEquals(dice[1] >= 1 && dice[1] <= 6, true, `d2=${dice[1]} out of range`);
  }
});

Deno.test("POST /api/v1/roll: outcome is one of miss/weak/strong", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const validOutcomes = new Set(["miss", "weak", "strong"]);
  for (let i = 0; i < 20; i++) {
    const res = await handler(makeRequest({ stat: "blood" }), "player1");
    const body = await json(res);
    assertEquals(validOutcomes.has(body.outcome as string), true);
  }
});

Deno.test("POST /api/v1/roll: outcomeLabel matches outcome", async () => {
  const handler = makeDiceRouter(makeStore(null));
  for (let i = 0; i < 20; i++) {
    const res = await handler(makeRequest({ stat: "blood" }), "player1");
    const body = await json(res);
    if (body.outcome === "miss")   assertEquals(body.outcomeLabel, "6-");
    if (body.outcome === "weak")   assertEquals(body.outcomeLabel, "7-9");
    if (body.outcome === "strong") assertEquals(body.outcomeLabel, "10+");
  }
});

Deno.test("POST /api/v1/roll: total = dice[0] + dice[1] + stat + bonus", async () => {
  const handler = makeDiceRouter(makeStore(APPROVED_SHEET));
  for (let i = 0; i < 20; i++) {
    const res = await handler(makeRequest({ stat: "blood", bonus: 1 }), "player1");
    const body = await json(res);
    const dice = body.dice as number[];
    const expected = dice[0] + dice[1] + (body.stat as number) + (body.bonus as number);
    assertEquals(body.total, expected);
  }
});

// ─── Unknown routes ───────────────────────────────────────────────────────────

Deno.test("GET /api/v1/roll → 404 (wrong method)", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const req = new Request("http://localhost/api/v1/roll", { method: "GET" });
  const res = await handler(req, "player1");
  assertEquals(res.status, 404);
});

Deno.test("POST /api/v1/unknown → 404", async () => {
  const handler = makeDiceRouter(makeStore(null));
  const req = new Request("http://localhost/api/v1/unknown", {
    method: "POST",
    body: JSON.stringify({ stat: "blood" }),
  });
  const res = await handler(req, "player1");
  assertEquals(res.status, 404);
});
