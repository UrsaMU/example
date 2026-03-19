import { assertEquals } from "@std/assert";
import { makeDebtsRouter } from "../src/plugins/debts/router.ts";
import type { DebtStore, PlayerStore } from "../src/plugins/debts/router.ts";
import type { IDebtRecord } from "../src/plugins/debts/schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function req(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Request {
  const url = new URL(`http://localhost${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return await res.json();
}

// ─── Mock stores ──────────────────────────────────────────────────────────────

function makePlayerStore(players: Record<string, { flags?: string; data?: Record<string, unknown> }>): PlayerStore {
  return {
    queryOne: (q) => {
      const id = (q as Record<string, unknown>).id as string;
      return Promise.resolve(players[id] ?? null);
    },
  };
}

const PLAYERS = makePlayerStore({
  "p1": { flags: "player", data: { name: "Roxanne" } },
  "p2": { flags: "player", data: { name: "Dorian" } },
  "staff1": { flags: "player admin", data: { name: "Staffperson" } },
});

function makeDebtStore(initial: IDebtRecord[] = []): DebtStore & { _records: IDebtRecord[] } {
  const records: IDebtRecord[] = [...initial];

  return {
    _records: records,

    query: (q?: Partial<IDebtRecord>) => {
      if (!q || Object.keys(q).length === 0) return Promise.resolve([...records]);
      return Promise.resolve(records.filter((r) =>
        Object.entries(q).every(([k, v]) => (r as Record<string, unknown>)[k] === v)
      ));
    },

    queryOne: (q: Partial<IDebtRecord>) => {
      return Promise.resolve(records.find((r) =>
        Object.entries(q).every(([k, v]) => (r as Record<string, unknown>)[k] === v)
      ) ?? null);
    },

    create: (record: IDebtRecord) => {
      records.push({ ...record });
      return Promise.resolve(record);
    },

    modify: (q: Partial<IDebtRecord>, _op: string, update: Partial<IDebtRecord>) => {
      const idx = records.findIndex((r) =>
        Object.entries(q).every(([k, v]) => (r as Record<string, unknown>)[k] === v)
      );
      if (idx !== -1) Object.assign(records[idx], update);
      return Promise.resolve();
    },

    delete: (q: Partial<IDebtRecord>) => {
      const idx = records.findIndex((r) =>
        Object.entries(q).every(([k, v]) => (r as Record<string, unknown>)[k] === v)
      );
      if (idx !== -1) records.splice(idx, 1);
      return Promise.resolve();
    },
  };
}

function seedDebt(overrides: Partial<IDebtRecord> = {}): IDebtRecord {
  return {
    id: crypto.randomUUID(),
    ownerId: "p1",
    ownerName: "Roxanne",
    direction: "owed",
    otherName: "Viktor",
    description: "Viktor owes me for hiding the body",
    cashedIn: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

Deno.test("all routes: no userId → 401", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const routes = [
    req("GET", "/api/v1/debts"),
    req("POST", "/api/v1/debts", { direction: "owed", otherName: "X", description: "Y" }),
    req("GET", "/api/v1/debts/all"),
    req("GET", "/api/v1/debts/fake-id"),
    req("PATCH", "/api/v1/debts/fake-id", { description: "new" }),
    req("POST", "/api/v1/debts/fake-id/cashin"),
    req("DELETE", "/api/v1/debts/fake-id"),
  ];
  for (const r of routes) {
    const res = await handler(r, null);
    assertEquals(res.status, 401, `${r.method} ${new URL(r.url).pathname} should be 401`);
  }
});

// ─── GET /api/v1/debts ────────────────────────────────────────────────────────

Deno.test("GET /api/v1/debts: returns only owner's records", async () => {
  const store = makeDebtStore([
    seedDebt({ ownerId: "p1", id: "d1" }),
    seedDebt({ ownerId: "p2", id: "d2" }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts"), "p1");
  assertEquals(res.status, 200);
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 1);
  assertEquals(body[0].id, "d1");
});

Deno.test("GET /api/v1/debts: empty list when no debts", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts"), "p1");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), []);
});

Deno.test("GET /api/v1/debts?direction=owed: filters to owed debts", async () => {
  const store = makeDebtStore([
    seedDebt({ id: "d1", direction: "owed" }),
    seedDebt({ id: "d2", direction: "owes" }),
    seedDebt({ id: "d3", direction: "owed" }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts", undefined, { direction: "owed" }), "p1");
  assertEquals(res.status, 200);
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 2);
  assertEquals(body.every((r) => r.direction === "owed"), true);
});

Deno.test("GET /api/v1/debts?direction=owes: filters to owes debts", async () => {
  const store = makeDebtStore([
    seedDebt({ id: "d1", direction: "owed" }),
    seedDebt({ id: "d2", direction: "owes" }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts", undefined, { direction: "owes" }), "p1");
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 1);
  assertEquals(body[0].direction, "owes");
});

Deno.test("GET /api/v1/debts?active=true: returns only uncashed debts", async () => {
  const store = makeDebtStore([
    seedDebt({ id: "d1", cashedIn: false }),
    seedDebt({ id: "d2", cashedIn: true }),
    seedDebt({ id: "d3", cashedIn: false }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts", undefined, { active: "true" }), "p1");
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 2);
  assertEquals(body.every((r) => !r.cashedIn), true);
});

Deno.test("GET /api/v1/debts?active=false: returns only cashed-in debts", async () => {
  const store = makeDebtStore([
    seedDebt({ id: "d1", cashedIn: false }),
    seedDebt({ id: "d2", cashedIn: true }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts", undefined, { active: "false" }), "p1");
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 1);
  assertEquals(body[0].cashedIn, true);
});

Deno.test("GET /api/v1/debts: direction + active filters combine", async () => {
  const store = makeDebtStore([
    seedDebt({ id: "d1", direction: "owed", cashedIn: false }),
    seedDebt({ id: "d2", direction: "owed", cashedIn: true }),
    seedDebt({ id: "d3", direction: "owes", cashedIn: false }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts", undefined, { direction: "owed", active: "true" }), "p1");
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 1);
  assertEquals(body[0].id, "d1");
});

// ─── POST /api/v1/debts ───────────────────────────────────────────────────────

Deno.test("POST /api/v1/debts: creates a debt record", async () => {
  const store = makeDebtStore();
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owed",
    otherName: "Viktor",
    description: "He owes me for the safehouse",
  }), "p1");
  assertEquals(res.status, 201);
  const body = await json(res);
  assertEquals(body.ownerId, "p1");
  assertEquals(body.ownerName, "Roxanne");
  assertEquals(body.direction, "owed");
  assertEquals(body.otherName, "Viktor");
  assertEquals(body.description, "He owes me for the safehouse");
  assertEquals(body.cashedIn, false);
  assertEquals(typeof body.id, "string");
  assertEquals(typeof body.createdAt, "number");
  // Verify it was persisted
  assertEquals(store._records.length, 1);
});

Deno.test("POST /api/v1/debts: creates 'owes' direction", async () => {
  const store = makeDebtStore();
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owes",
    otherName: "The Magistrate",
    description: "I owe the Magistrate for getting me out of jail",
  }), "p1");
  assertEquals(res.status, 201);
  const body = await json(res);
  assertEquals(body.direction, "owes");
});

Deno.test("POST /api/v1/debts: optional otherId is stored", async () => {
  const store = makeDebtStore();
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owed",
    otherName: "Dorian",
    otherId: "p2",
    description: "PC-to-PC debt",
  }), "p1");
  assertEquals(res.status, 201);
  const body = await json(res);
  assertEquals(body.otherId, "p2");
});

Deno.test("POST /api/v1/debts: missing direction → 400", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    otherName: "Viktor", description: "test",
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/debts: invalid direction → 400", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "maybe", otherName: "Viktor", description: "test",
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/debts: missing otherName → 400", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owed", description: "test",
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/debts: blank otherName → 400", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owed", otherName: "  ", description: "test",
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/debts: missing description → 400", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owed", otherName: "Viktor",
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/debts: invalid JSON → 400", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const r = new Request("http://localhost/api/v1/debts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not json",
  });
  const res = await handler(r, "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/debts: ownerName falls back to userId when no player record", async () => {
  const noPlayerStore = makePlayerStore({});
  const store = makeDebtStore();
  const handler = makeDebtsRouter(store, noPlayerStore);
  const res = await handler(req("POST", "/api/v1/debts", {
    direction: "owed", otherName: "X", description: "Y",
  }), "ghost-id");
  assertEquals(res.status, 201);
  const body = await json(res);
  assertEquals(body.ownerName, "ghost-id");
});

// ─── GET /api/v1/debts/all (staff) ───────────────────────────────────────────

Deno.test("GET /api/v1/debts/all: staff sees all records", async () => {
  const store = makeDebtStore([
    seedDebt({ ownerId: "p1", id: "d1" }),
    seedDebt({ ownerId: "p2", id: "d2" }),
  ]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/all"), "staff1");
  assertEquals(res.status, 200);
  const body = await res.json() as IDebtRecord[];
  assertEquals(body.length, 2);
});

Deno.test("GET /api/v1/debts/all: non-staff → 403", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/all"), "p1");
  assertEquals(res.status, 403);
});

// ─── GET /api/v1/debts/:id ────────────────────────────────────────────────────

Deno.test("GET /api/v1/debts/:id: owner can view own debt", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/d1"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.id, "d1");
});

Deno.test("GET /api/v1/debts/:id: staff can view any debt", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/d1"), "staff1");
  assertEquals(res.status, 200);
});

Deno.test("GET /api/v1/debts/:id: other player → 403", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/d1"), "p2");
  assertEquals(res.status, 403);
});

Deno.test("GET /api/v1/debts/:id: not found → 404", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/no-such-id"), "p1");
  assertEquals(res.status, 404);
});

// ─── PATCH /api/v1/debts/:id ─────────────────────────────────────────────────

Deno.test("PATCH /api/v1/debts/:id: updates description", async () => {
  const debt = seedDebt({ id: "d1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { description: "Updated context" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.description, "Updated context");
});

Deno.test("PATCH /api/v1/debts/:id: updates otherName", async () => {
  const debt = seedDebt({ id: "d1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { otherName: "Marcus" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.otherName, "Marcus");
});

Deno.test("PATCH /api/v1/debts/:id: updates otherId", async () => {
  const debt = seedDebt({ id: "d1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { otherId: "p2" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.otherId, "p2");
});

Deno.test("PATCH /api/v1/debts/:id: no valid fields → 400", async () => {
  const debt = seedDebt({ id: "d1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { color: "red" }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("PATCH /api/v1/debts/:id: cashed-in debt → 409", async () => {
  const debt = seedDebt({ id: "d1", cashedIn: true });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { description: "new" }), "p1");
  assertEquals(res.status, 409);
});

Deno.test("PATCH /api/v1/debts/:id: not owner → 403", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { description: "hack" }), "p2");
  assertEquals(res.status, 403);
});

Deno.test("PATCH /api/v1/debts/:id: staff can edit", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/d1", { description: "staff edit" }), "staff1");
  assertEquals(res.status, 200);
});

Deno.test("PATCH /api/v1/debts/:id: not found → 404", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("PATCH", "/api/v1/debts/no-id", { description: "x" }), "p1");
  assertEquals(res.status, 404);
});

// ─── POST /api/v1/debts/:id/cashin ───────────────────────────────────────────

Deno.test("POST /api/v1/debts/:id/cashin: marks debt as cashed in", async () => {
  const debt = seedDebt({ id: "d1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts/d1/cashin"), "p1");
  assertEquals(res.status, 200);
  // Verify the record was mutated
  assertEquals(store._records[0].cashedIn, true);
  assertEquals(typeof store._records[0].cashedInAt, "number");
});

Deno.test("POST /api/v1/debts/:id/cashin: already cashed in → 409", async () => {
  const debt = seedDebt({ id: "d1", cashedIn: true });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts/d1/cashin"), "p1");
  assertEquals(res.status, 409);
});

Deno.test("POST /api/v1/debts/:id/cashin: not owner → 403", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts/d1/cashin"), "p2");
  assertEquals(res.status, 403);
});

Deno.test("POST /api/v1/debts/:id/cashin: staff can cash in any debt", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts/d1/cashin"), "staff1");
  assertEquals(res.status, 200);
  assertEquals(store._records[0].cashedIn, true);
});

Deno.test("POST /api/v1/debts/:id/cashin: not found → 404", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("POST", "/api/v1/debts/no-id/cashin"), "p1");
  assertEquals(res.status, 404);
});

// ─── DELETE /api/v1/debts/:id ─────────────────────────────────────────────────

Deno.test("DELETE /api/v1/debts/:id: owner can delete", async () => {
  const debt = seedDebt({ id: "d1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("DELETE", "/api/v1/debts/d1"), "p1");
  assertEquals(res.status, 200);
  assertEquals(store._records.length, 0);
});

Deno.test("DELETE /api/v1/debts/:id: staff can delete any", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const store = makeDebtStore([debt]);
  const handler = makeDebtsRouter(store, PLAYERS);
  const res = await handler(req("DELETE", "/api/v1/debts/d1"), "staff1");
  assertEquals(res.status, 200);
  assertEquals(store._records.length, 0);
});

Deno.test("DELETE /api/v1/debts/:id: other player → 403", async () => {
  const debt = seedDebt({ id: "d1", ownerId: "p1" });
  const handler = makeDebtsRouter(makeDebtStore([debt]), PLAYERS);
  const res = await handler(req("DELETE", "/api/v1/debts/d1"), "p2");
  assertEquals(res.status, 403);
});

Deno.test("DELETE /api/v1/debts/:id: not found → 404", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("DELETE", "/api/v1/debts/no-id"), "p1");
  assertEquals(res.status, 404);
});

// ─── Unknown routes ───────────────────────────────────────────────────────────

Deno.test("PUT /api/v1/debts → 404", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("PUT", "/api/v1/debts", {}), "p1");
  assertEquals(res.status, 404);
});

Deno.test("GET /api/v1/debts/unknown/path → 404", async () => {
  const handler = makeDebtsRouter(makeDebtStore(), PLAYERS);
  const res = await handler(req("GET", "/api/v1/debts/id/unknown"), "p1");
  assertEquals(res.status, 404);
});
