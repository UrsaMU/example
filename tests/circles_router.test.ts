import { assertEquals } from "@std/assert";
import { makeCirclesRouter } from "../src/plugins/circles/router.ts";
import type {
  FactionStore,
  PlayerStore,
  SheetStore,
} from "../src/plugins/circles/router.ts";
import type { ICharSheet } from "../src/plugins/playbooks/schema.ts";
import type { IFactionEntry } from "../src/plugins/circles/schema.ts";

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
): SheetStore & { _sheet: Partial<ICharSheet> | null } {
  const sheet = initial ? { ...initial } : null;
  return {
    get _sheet() {
      return sheet;
    },
    queryOne: () => Promise.resolve(sheet as ICharSheet | null),
    modify: (_q, _op, update) => {
      if (sheet) Object.assign(sheet, update);
      return Promise.resolve();
    },
  };
}

function makeFactionStore(
  initial: IFactionEntry[] = [],
): FactionStore & { _records: IFactionEntry[] } {
  const records: IFactionEntry[] = [...initial];
  return {
    _records: records,
    query: (q?) => {
      if (!q || !Object.keys(q).length) return Promise.resolve([...records]);
      return Promise.resolve(
        records.filter((r) =>
          Object.entries(q).every(([k, v]) =>
            (r as Record<string, unknown>)[k] === v
          )
        ),
      );
    },
    queryOne: (q) =>
      Promise.resolve(
        records.find((r) =>
          Object.entries(q).every(([k, v]) =>
            (r as Record<string, unknown>)[k] === v
          )
        ) ?? null,
      ),
    create: (e) => {
      records.push({ ...e });
      return Promise.resolve(e);
    },
    modify: (q, _op, update) => {
      const idx = records.findIndex((r) =>
        Object.entries(q).every(([k, v]) =>
          (r as Record<string, unknown>)[k] === v
        )
      );
      if (idx !== -1) Object.assign(records[idx], update);
      return Promise.resolve();
    },
    delete: (q) => {
      const idx = records.findIndex((r) =>
        Object.entries(q).every(([k, v]) =>
          (r as Record<string, unknown>)[k] === v
        )
      );
      if (idx !== -1) records.splice(idx, 1);
      return Promise.resolve();
    },
  };
}

function makePlayerStore(staff: boolean): PlayerStore {
  return {
    queryOne: () => Promise.resolve({ flags: staff ? "admin" : "player" }),
  };
}

const NORMAL = makePlayerStore(false);
const STAFF = makePlayerStore(true);

function approvedSheet(
  overrides: Partial<ICharSheet> = {},
): Partial<ICharSheet> {
  return {
    id: "p1",
    playerId: "p1",
    playbookId: "wolf",
    status: "approved",
    circleStatus: { mortalis: 0, night: 1, power: -1, wild: 2 },
    circleRatings: { mortalis: -1, night: 0, power: 1, wild: 1 },
    ...overrides,
  };
}

function seedFaction(overrides: Partial<IFactionEntry> = {}): IFactionEntry {
  return {
    id: "f1",
    playerId: "p1",
    circle: "night",
    name: "The Undying Court",
    status: 1,
    notes: "",
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

Deno.test("all routes: no userId → 401", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const routes = [
    req("GET", "/api/v1/circles"),
    req("POST", "/api/v1/circles/mark", { circle: "night" }),
    req("POST", "/api/v1/circles/improve", { circle: "night" }),
    req("POST", "/api/v1/circles/adjust", { circle: "night", delta: 1 }),
    req("GET", "/api/v1/circles/factions"),
    req("POST", "/api/v1/circles/factions", { circle: "night", name: "X" }),
    req("GET", "/api/v1/circles/p1"),
  ];
  for (const r of routes) {
    const res = await handler(r, null);
    assertEquals(res.status, 401, `${r.method} ${new URL(r.url).pathname}`);
  }
});

// ─── GET /api/v1/circles ──────────────────────────────────────────────────────

Deno.test("GET /api/v1/circles: returns status, ratings, and factions", async () => {
  const fac = makeFactionStore([seedFaction()]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(req("GET", "/api/v1/circles"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(typeof body.circleStatus, "object");
  assertEquals(typeof body.circleRatings, "object");
  assertEquals(Array.isArray(body.factions), true);
  assertEquals((body.factions as unknown[]).length, 1);
});

Deno.test("GET /api/v1/circles: no sheet → 404", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(null),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(req("GET", "/api/v1/circles"), "p1");
  assertEquals(res.status, 404);
});

// ─── POST /api/v1/circles/mark ───────────────────────────────────────────────

Deno.test("mark: decrements circle status by 1", async () => {
  const store = makeSheetStore(
    approvedSheet({
      circleStatus: { mortalis: 0, night: 2, power: -1, wild: 1 },
    }),
  );
  const handler = makeCirclesRouter(store, makeFactionStore(), NORMAL);
  const res = await handler(
    req("POST", "/api/v1/circles/mark", { circle: "night" }),
    "p1",
  );
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.circleStatus as Record<string, number>).night, 1);
  assertEquals((store._sheet!.circleStatus as Record<string, number>).night, 1);
});

Deno.test("mark: 409 when circle already at minimum", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(
      approvedSheet({
        circleStatus: { mortalis: -3, night: 0, power: 0, wild: 0 },
      }),
    ),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/mark", { circle: "mortalis" }),
    "p1",
  );
  assertEquals(res.status, 409);
});

Deno.test("mark: invalid circle name → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/mark", { circle: "fire" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

Deno.test("mark: missing circle → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(req("POST", "/api/v1/circles/mark", {}), "p1");
  assertEquals(res.status, 400);
});

Deno.test("mark: 403 if sheet not approved", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet({ status: "draft" })),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/mark", { circle: "night" }),
    "p1",
  );
  assertEquals(res.status, 403);
});

Deno.test("mark: all four circles are valid", async () => {
  for (const circle of ["mortalis", "night", "power", "wild"]) {
    const store = makeSheetStore(
      approvedSheet({
        circleStatus: { mortalis: 0, night: 0, power: 0, wild: 0 },
      }),
    );
    const handler = makeCirclesRouter(store, makeFactionStore(), NORMAL);
    const res = await handler(
      req("POST", "/api/v1/circles/mark", { circle }),
      "p1",
    );
    assertEquals(res.status, 200, `circle '${circle}' should be valid`);
  }
});

// ─── POST /api/v1/circles/improve ────────────────────────────────────────────

Deno.test("improve: increments circle status by 1", async () => {
  const store = makeSheetStore(
    approvedSheet({
      circleStatus: { mortalis: 0, night: 0, power: 0, wild: 1 },
    }),
  );
  const handler = makeCirclesRouter(store, makeFactionStore(), NORMAL);
  const res = await handler(
    req("POST", "/api/v1/circles/improve", { circle: "wild" }),
    "p1",
  );
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals((body.circleStatus as Record<string, number>).wild, 2);
  assertEquals((store._sheet!.circleStatus as Record<string, number>).wild, 2);
});

Deno.test("improve: 409 when circle already at maximum", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(
      approvedSheet({
        circleStatus: { mortalis: 3, night: 0, power: 0, wild: 0 },
      }),
    ),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/improve", { circle: "mortalis" }),
    "p1",
  );
  assertEquals(res.status, 409);
});

Deno.test("improve: invalid circle name → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/improve", { circle: "shadow" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

// ─── POST /api/v1/circles/adjust ─────────────────────────────────────────────

Deno.test("adjust: positive delta increases status", async () => {
  const store = makeSheetStore(
    approvedSheet({
      circleStatus: { mortalis: 0, night: -1, power: 0, wild: 0 },
    }),
  );
  const handler = makeCirclesRouter(store, makeFactionStore(), NORMAL);
  const res = await handler(
    req("POST", "/api/v1/circles/adjust", { circle: "night", delta: 2 }),
    "p1",
  );
  assertEquals(res.status, 200);
  assertEquals((await json(res)).adjusted, "night");
  assertEquals((store._sheet!.circleStatus as Record<string, number>).night, 1);
});

Deno.test("adjust: negative delta decreases status", async () => {
  const store = makeSheetStore(
    approvedSheet({
      circleStatus: { mortalis: 2, night: 0, power: 0, wild: 0 },
    }),
  );
  const handler = makeCirclesRouter(store, makeFactionStore(), NORMAL);
  await handler(
    req("POST", "/api/v1/circles/adjust", { circle: "mortalis", delta: -3 }),
    "p1",
  );
  assertEquals(
    (store._sheet!.circleStatus as Record<string, number>).mortalis,
    -1,
  );
});

Deno.test("adjust: clamps to bounds", async () => {
  const store = makeSheetStore(
    approvedSheet({
      circleStatus: { mortalis: 2, night: 0, power: 0, wild: 0 },
    }),
  );
  const handler = makeCirclesRouter(store, makeFactionStore(), NORMAL);
  await handler(
    req("POST", "/api/v1/circles/adjust", { circle: "mortalis", delta: 99 }),
    "p1",
  );
  assertEquals(
    (store._sheet!.circleStatus as Record<string, number>).mortalis,
    3,
  );
});

Deno.test("adjust: missing delta → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/adjust", { circle: "night" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

Deno.test("adjust: string delta → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/adjust", { circle: "night", delta: "big" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

// ─── GET /api/v1/circles/factions ────────────────────────────────────────────

Deno.test("GET factions: returns only player's factions", async () => {
  const fac = makeFactionStore([
    seedFaction({ id: "f1", playerId: "p1" }),
    seedFaction({ id: "f2", playerId: "p2" }),
  ]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(req("GET", "/api/v1/circles/factions"), "p1");
  assertEquals(res.status, 200);
  const body = await res.json() as IFactionEntry[];
  assertEquals(body.length, 1);
  assertEquals(body[0].id, "f1");
});

Deno.test("GET factions: empty list when none", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(req("GET", "/api/v1/circles/factions"), "p1");
  assertEquals(await res.json(), []);
});

// ─── POST /api/v1/circles/factions ───────────────────────────────────────────

Deno.test("POST factions: creates faction entry", async () => {
  const fac = makeFactionStore();
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/factions", {
      circle: "night",
      name: "The Undying Court",
      status: 1,
      notes: "They owe me",
    }),
    "p1",
  );
  assertEquals(res.status, 201);
  const body = await json(res);
  assertEquals(body.circle, "night");
  assertEquals(body.name, "The Undying Court");
  assertEquals(body.status, 1);
  assertEquals(body.playerId, "p1");
  assertEquals(fac._records.length, 1);
});

Deno.test("POST factions: status defaults to 0 if omitted", async () => {
  const fac = makeFactionStore();
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/factions", {
      circle: "mortalis",
      name: "City Hall",
    }),
    "p1",
  );
  assertEquals(res.status, 201);
  assertEquals((await json(res)).status, 0);
});

Deno.test("POST factions: status is clamped to range", async () => {
  const fac = makeFactionStore();
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/factions", {
      circle: "power",
      name: "X",
      status: 99,
    }),
    "p1",
  );
  assertEquals(res.status, 201);
  assertEquals((await json(res)).status, 3);
});

Deno.test("POST factions: invalid circle → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/factions", { circle: "chaos", name: "X" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

Deno.test("POST factions: missing name → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/factions", { circle: "night" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

Deno.test("POST factions: blank name → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("POST", "/api/v1/circles/factions", { circle: "night", name: "  " }),
    "p1",
  );
  assertEquals(res.status, 400);
});

// ─── PATCH /api/v1/circles/factions/:id ──────────────────────────────────────

Deno.test("PATCH factions/:id: updates name", async () => {
  const fac = makeFactionStore([seedFaction()]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/factions/f1", {
      name: "The Dusk Parliament",
    }),
    "p1",
  );
  assertEquals(res.status, 200);
  assertEquals(fac._records[0].name, "The Dusk Parliament");
});

Deno.test("PATCH factions/:id: updates status", async () => {
  const fac = makeFactionStore([seedFaction()]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/factions/f1", { status: -2 }),
    "p1",
  );
  assertEquals(res.status, 200);
  assertEquals(fac._records[0].status, -2);
});

Deno.test("PATCH factions/:id: updates notes", async () => {
  const fac = makeFactionStore([seedFaction()]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  await handler(
    req("PATCH", "/api/v1/circles/factions/f1", { notes: "New notes" }),
    "p1",
  );
  assertEquals(fac._records[0].notes, "New notes");
});

Deno.test("PATCH factions/:id: no valid fields → 400", async () => {
  const fac = makeFactionStore([seedFaction()]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/factions/f1", { color: "red" }),
    "p1",
  );
  assertEquals(res.status, 400);
});

Deno.test("PATCH factions/:id: not owner → 403", async () => {
  const fac = makeFactionStore([seedFaction({ playerId: "p2" })]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/factions/f1", { name: "X" }),
    "p1",
  );
  assertEquals(res.status, 403);
});

Deno.test("PATCH factions/:id: staff can edit any", async () => {
  const fac = makeFactionStore([seedFaction({ playerId: "p2" })]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    STAFF,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/factions/f1", { name: "X" }),
    "staff1",
  );
  assertEquals(res.status, 200);
});

Deno.test("PATCH factions/:id: not found → 404", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/factions/no-id", { name: "X" }),
    "p1",
  );
  assertEquals(res.status, 404);
});

// ─── DELETE /api/v1/circles/factions/:id ──────────────────────────────────────

Deno.test("DELETE factions/:id: owner removes faction", async () => {
  const fac = makeFactionStore([seedFaction()]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(req("DELETE", "/api/v1/circles/factions/f1"), "p1");
  assertEquals(res.status, 200);
  assertEquals(fac._records.length, 0);
});

Deno.test("DELETE factions/:id: staff removes any", async () => {
  const fac = makeFactionStore([seedFaction({ playerId: "p2" })]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    STAFF,
  );
  const res = await handler(
    req("DELETE", "/api/v1/circles/factions/f1"),
    "staff1",
  );
  assertEquals(res.status, 200);
  assertEquals(fac._records.length, 0);
});

Deno.test("DELETE factions/:id: not owner → 403", async () => {
  const fac = makeFactionStore([seedFaction({ playerId: "p2" })]);
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    fac,
    NORMAL,
  );
  const res = await handler(req("DELETE", "/api/v1/circles/factions/f1"), "p1");
  assertEquals(res.status, 403);
});

Deno.test("DELETE factions/:id: not found → 404", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("DELETE", "/api/v1/circles/factions/no-id"),
    "p1",
  );
  assertEquals(res.status, 404);
});

// ─── GET /api/v1/circles/:id ─────────────────────────────────────────────────

Deno.test("GET circles/:id: player views own", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(req("GET", "/api/v1/circles/p1"), "p1");
  assertEquals(res.status, 200);
});

Deno.test("GET circles/:id: staff views any", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet({ id: "p2" })),
    makeFactionStore(),
    STAFF,
  );
  const res = await handler(req("GET", "/api/v1/circles/p2"), "staff1");
  assertEquals(res.status, 200);
});

Deno.test("GET circles/:id: non-staff views other → 403", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet({ id: "p2" })),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(req("GET", "/api/v1/circles/p2"), "p1");
  assertEquals(res.status, 403);
});

Deno.test("GET circles/:id: not found → 404", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(null),
    makeFactionStore(),
    STAFF,
  );
  const res = await handler(req("GET", "/api/v1/circles/nobody"), "staff1");
  assertEquals(res.status, 404);
});

// ─── PATCH /api/v1/circles/:id (staff) ───────────────────────────────────────

Deno.test("PATCH circles/:id: staff sets all circle statuses", async () => {
  const store = makeSheetStore(approvedSheet({ id: "p2" }));
  const handler = makeCirclesRouter(store, makeFactionStore(), STAFF);
  const res = await handler(
    req("PATCH", "/api/v1/circles/p2", {
      circleStatus: { mortalis: 2, night: -1, power: 0, wild: 3 },
    }),
    "staff1",
  );
  assertEquals(res.status, 200);
  const cs = store._sheet!.circleStatus as Record<string, number>;
  assertEquals(cs.mortalis, 2);
  assertEquals(cs.night, -1);
  assertEquals(cs.power, 0);
  assertEquals(cs.wild, 3);
});

Deno.test("PATCH circles/:id: staff values are clamped", async () => {
  const store = makeSheetStore(approvedSheet({ id: "p2" }));
  const handler = makeCirclesRouter(store, makeFactionStore(), STAFF);
  await handler(
    req("PATCH", "/api/v1/circles/p2", {
      circleStatus: { mortalis: 99, night: -99, power: 0, wild: 0 },
    }),
    "staff1",
  );
  const cs = store._sheet!.circleStatus as Record<string, number>;
  assertEquals(cs.mortalis, 3);
  assertEquals(cs.night, -3);
});

Deno.test("PATCH circles/:id: non-staff → 403", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet({ id: "p2" })),
    makeFactionStore(),
    NORMAL,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/p2", {
      circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 },
    }),
    "p1",
  );
  assertEquals(res.status, 403);
});

Deno.test("PATCH circles/:id: no valid fields → 400", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet({ id: "p2" })),
    makeFactionStore(),
    STAFF,
  );
  const res = await handler(
    req("PATCH", "/api/v1/circles/p2", { color: "red" }),
    "staff1",
  );
  assertEquals(res.status, 400);
});

// ─── Unknown routes ───────────────────────────────────────────────────────────

Deno.test("DELETE /api/v1/circles → 404", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  assertEquals(
    (await handler(req("DELETE", "/api/v1/circles"), "p1")).status,
    404,
  );
});

Deno.test("GET /api/v1/circles/id/extra → 404", async () => {
  const handler = makeCirclesRouter(
    makeSheetStore(approvedSheet()),
    makeFactionStore(),
    NORMAL,
  );
  assertEquals(
    (await handler(req("GET", "/api/v1/circles/p1/extra"), "p1")).status,
    404,
  );
});
