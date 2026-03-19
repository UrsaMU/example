import { assertEquals, assertExists } from "@std/assert";
import { makePlaybooksRouter } from "../src/plugins/playbooks/router.ts";
import type { SheetStore, PlayerStore } from "../src/plugins/playbooks/router.ts";
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
  initial?: Partial<ICharSheet> | null,
): SheetStore & { _sheet: Partial<ICharSheet> | null } {
  let sheet = initial !== undefined ? (initial ? { ...initial } : null) : null;
  return {
    get _sheet() { return sheet; },
    query: () => Promise.resolve(sheet ? [sheet as ICharSheet] : []),
    queryOne: () => Promise.resolve(sheet as ICharSheet | null),
    create: (r) => { sheet = { ...r }; return Promise.resolve(r); },
    modify: (_q, _op, update) => { if (sheet) Object.assign(sheet, update); return Promise.resolve(); },
    delete: () => { sheet = null; return Promise.resolve(); },
  };
}

function makePlayerStore(isStaff: boolean, name = "Talia"): PlayerStore & { _applied: Record<string, unknown> | null } {
  let applied: Record<string, unknown> | null = null;
  return {
    get _applied() { return applied; },
    queryOne: () => Promise.resolve({ flags: isStaff ? "admin" : "player", data: { name } }),
    modify: (_q, _op, update) => { applied = update; return Promise.resolve(); },
  };
}

const NORMAL = makePlayerStore(false);
const STAFF  = makePlayerStore(true);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Minimal sheet that passes validateSheet for "aware"
// Aware: baseStats {blood:0, heart:1, mind:-1, spirit:1}, moveCount:3, 5 introQuestions, 3 startingDebts
// featureDefs: kit (required), mortalRelationships (required)
function validAwareSheet(overrides: Partial<ICharSheet> = {}): Partial<ICharSheet> {
  return {
    id: "p1",
    playerId: "p1",
    playbookId: "aware",
    status: "draft",
    name: "Talia",
    look: "sharp eyes, worn jacket",
    demeanor: "composed",
    stats: { blood: 0, heart: 1, mind: 0, spirit: 1 }, // +1 to mind
    circleRatings: { mortalis: 2, night: 0, power: 1, wild: -1 }, // +1 to mortalis
    circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 },
    harm: { boxes: [false, false, false, false, false], armor: 0 },
    corruption: { marks: 0, advances: [] },
    selectedMoves: [
      "aware-i-know-a-guy",
      "aware-charming-not-sincere",
      "aware-the-lions-den",
    ],
    gear: ["Taser", "smartphone"],
    features: {
      kit: "forensics kit, camera, lockpicks",
      mortalRelationships: "1. Alex (sister) 2. Sam (partner) 3. Jo (neighbor)",
    },
    introAnswers: {
      "How did you discover the supernatural?": "I saw a ghost at my mother's funeral.",
      "How long have you been in the city?": "Three years.",
      "What mortal commitment keeps you from leaving your old life behind?": "My sister needs me.",
      "What mortal aspiration have you given up?": "A normal career.",
      "What powerful faction or person are you currently investigating?": "The Night Circle.",
    },
    debts: [
      { id: "d1", to: "Marcus", description: "He hid the truth from me for years.", direction: "owed" },
      { id: "d2", to: "Sarah",  description: "She answers my questions without judgment.", direction: "owes" },
      { id: "d3", to: "Jonas",  description: "I blackmailed him into helping me.", direction: "owes" },
    ],
    notes: "",
    xp: 0,
    takenAdvances: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── Public playbook routes (no auth needed) ──────────────────────────────────

Deno.test("GET /api/v1/playbooks: lists all playbooks", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(), NORMAL);
  const res = await handler(req("GET", "/api/v1/playbooks"), null);
  assertEquals(res.status, 200);
  const body = await json(res);
  assertExists((body as unknown as unknown[]).find((p: unknown) => (p as Record<string, unknown>).id === "aware"));
});

Deno.test("GET /api/v1/playbooks/:id: returns playbook", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(), NORMAL);
  const res = await handler(req("GET", "/api/v1/playbooks/aware"), null);
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.id, "aware");
  assertEquals(body.name, "The Aware");
});

Deno.test("GET /api/v1/playbooks/:id: 404 for unknown playbook", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(), NORMAL);
  const res = await handler(req("GET", "/api/v1/playbooks/unknown"), null);
  assertEquals(res.status, 404);
});

// ─── Auth guard ───────────────────────────────────────────────────────────────

Deno.test("chargen routes: no userId → 401", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(), NORMAL);
  for (const r of [
    req("GET",    "/api/v1/chargen"),
    req("POST",   "/api/v1/chargen", { playbookId: "aware" }),
    req("PATCH",  "/api/v1/chargen", { name: "X" }),
    req("DELETE", "/api/v1/chargen"),
    req("POST",   "/api/v1/chargen/submit"),
    req("GET",    "/api/v1/chargen/checklist"),
    req("GET",    "/api/v1/chargen/all"),
  ]) {
    const res = await handler(r, null);
    assertEquals(res.status, 401, `${r.method} ${new URL(r.url).pathname}`);
  }
});

// ─── GET /api/v1/chargen ──────────────────────────────────────────────────────

Deno.test("GET /api/v1/chargen: returns null when no sheet", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen"), "p1");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), null);
});

Deno.test("GET /api/v1/chargen: returns existing sheet", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.playbookId, "aware");
  assertEquals(body.name, "Talia");
});

// ─── POST /api/v1/chargen ─────────────────────────────────────────────────────

Deno.test("POST /api/v1/chargen: creates sheet with playbook defaults", async () => {
  const store = makeSheetStore(null);
  const players = makePlayerStore(false, "Talia");
  const handler = makePlaybooksRouter(store, players);
  const res = await handler(req("POST", "/api/v1/chargen", { playbookId: "aware" }), "p1");
  assertEquals(res.status, 201);
  const body = await json(res);
  assertEquals(body.playbookId, "aware");
  assertEquals(body.status, "draft");
  // circleStatus seeded from playbook
  assertEquals((body.circleStatus as Record<string, number>).mortalis, 1);
  assertEquals((body.circleStatus as Record<string, number>).night, 0);
  // name taken from playerDb
  assertEquals(body.name, "Talia");
});

Deno.test("POST /api/v1/chargen: rejects unknown playbook", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen", { playbookId: "unknown" }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("POST /api/v1/chargen: 409 if sheet already exists", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen", { playbookId: "aware" }), "p1");
  assertEquals(res.status, 409);
});

Deno.test("POST /api/v1/chargen: allows re-start after rejection", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "rejected" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen", { playbookId: "aware" }), "p1");
  assertEquals(res.status, 201);
});

// ─── PATCH /api/v1/chargen ────────────────────────────────────────────────────

Deno.test("PATCH /api/v1/chargen: updates name and look", async () => {
  const store = makeSheetStore(validAwareSheet());
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", { name: "Nova", look: "hooded" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.name, "Nova");
  assertEquals(body.look, "hooded");
});

Deno.test("PATCH /api/v1/chargen: rejects boosting more than one stat", async () => {
  const store = makeSheetStore(validAwareSheet());
  const handler = makePlaybooksRouter(store, NORMAL);
  // base {blood:0, heart:1, mind:-1, spirit:1}, send two boosts
  const res = await handler(req("PATCH", "/api/v1/chargen", {
    stats: { blood: 1, heart: 2, mind: -1, spirit: 1 },
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("PATCH /api/v1/chargen: rejects boosting more than one circle rating", async () => {
  const store = makeSheetStore(validAwareSheet());
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", {
    circleRatings: { mortalis: 2, night: 1, power: 1, wild: -1 },
  }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("PATCH /api/v1/chargen: rejects invalid demeanor", async () => {
  const store = makeSheetStore(validAwareSheet());
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", { demeanor: "reckless" }), "p1");
  assertEquals(res.status, 400);
});

Deno.test("PATCH /api/v1/chargen: 404 if no sheet", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", { name: "X" }), "p1");
  assertEquals(res.status, 404);
});

Deno.test("PATCH /api/v1/chargen: 403 if approved", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "approved" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", { name: "X" }), "p1");
  assertEquals(res.status, 403);
});

Deno.test("PATCH /api/v1/chargen: 403 if pending", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "pending" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", { name: "X" }), "p1");
  assertEquals(res.status, 403);
});

Deno.test("PATCH /api/v1/chargen: resets rejected sheet to draft", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "rejected" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen", { name: "Nova" }), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.status, "draft");
});

// ─── DELETE /api/v1/chargen ───────────────────────────────────────────────────

Deno.test("DELETE /api/v1/chargen: removes draft sheet", async () => {
  const store = makeSheetStore(validAwareSheet());
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("DELETE", "/api/v1/chargen"), "p1");
  assertEquals(res.status, 200);
  assertEquals(store._sheet, null);
});

Deno.test("DELETE /api/v1/chargen: 404 if no sheet", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("DELETE", "/api/v1/chargen"), "p1");
  assertEquals(res.status, 404);
});

Deno.test("DELETE /api/v1/chargen: 403 if approved", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "approved" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("DELETE", "/api/v1/chargen"), "p1");
  assertEquals(res.status, 403);
});

// ─── POST /api/v1/chargen/submit ──────────────────────────────────────────────

Deno.test("submit: valid sheet → pending", async () => {
  const store = makeSheetStore(validAwareSheet());
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 200);
  assertEquals((store._sheet as ICharSheet).status, "pending");
});

Deno.test("submit: incomplete sheet → 422 with problems", async () => {
  const store = makeSheetStore(validAwareSheet({ name: "" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
  const body = await json(res);
  assertExists((body.error as string).includes("name is required"));
});

Deno.test("submit: already-pending sheet → 400", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "pending" }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 400);
});

Deno.test("submit: no sheet → 404", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 404);
});

// Validation problems that block submit

Deno.test("submit: missing stat boost → 422", async () => {
  // stats equal to playbook base — no boost
  const store = makeSheetStore(validAwareSheet({
    stats: { blood: 0, heart: 1, mind: -1, spirit: 1 },
  }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

Deno.test("submit: missing circle rating boost → 422", async () => {
  const store = makeSheetStore(validAwareSheet({
    circleRatings: { mortalis: 1, night: 0, power: 1, wild: -1 },
  }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

Deno.test("submit: wrong move count → 422", async () => {
  const store = makeSheetStore(validAwareSheet({
    selectedMoves: ["aware-i-know-a-guy"],
  }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

Deno.test("submit: missing gear → 422", async () => {
  const store = makeSheetStore(validAwareSheet({ gear: [] }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

Deno.test("submit: unanswered intro question → 422", async () => {
  const store = makeSheetStore(validAwareSheet({
    introAnswers: {
      "How did you discover the supernatural?": "I saw a ghost.",
    },
  }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

Deno.test("submit: too few debts → 422", async () => {
  const store = makeSheetStore(validAwareSheet({ debts: [
    { id: "d1", to: "Marcus", description: "He hid the truth.", direction: "owed" },
  ]}));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

Deno.test("submit: required feature missing → 422", async () => {
  const store = makeSheetStore(validAwareSheet({ features: { mortalRelationships: "friend" } }));
  const handler = makePlaybooksRouter(store, NORMAL);
  const res = await handler(req("POST", "/api/v1/chargen/submit"), "p1");
  assertEquals(res.status, 422);
});

// ─── GET /api/v1/chargen/checklist ───────────────────────────────────────────

Deno.test("checklist: no sheet → incomplete with prompt", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen/checklist"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.complete, false);
  assertExists((body.problems as string[])[0]);
});

Deno.test("checklist: valid sheet → complete + circle info", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen/checklist"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.complete, true);
  assertEquals((body.problems as string[]).length, 0);
  // Circle status preview exposed on checklist
  assertExists(body.circleStatus);
  assertExists(body.circleRatings);
  assertEquals(body.homeCircle, "mortalis");
});

Deno.test("checklist: incomplete sheet → problems list + circle info", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet({ name: "" })), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen/checklist"), "p1");
  assertEquals(res.status, 200);
  const body = await json(res);
  assertEquals(body.complete, false);
  assertExists(body.circleStatus); // circle info still present even when incomplete
});

// ─── GET /api/v1/chargen/all (staff) ─────────────────────────────────────────

Deno.test("chargen/all: staff sees all sheets", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), STAFF);
  const res = await handler(req("GET", "/api/v1/chargen/all"), "admin1");
  assertEquals(res.status, 200);
  const body = await res.json() as unknown[];
  assertEquals(body.length, 1);
});

Deno.test("chargen/all: non-staff → 403", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen/all"), "p1");
  assertEquals(res.status, 403);
});

// ─── GET /api/v1/chargen/:id (staff or self) ─────────────────────────────────

Deno.test("chargen/:id: player can view own sheet", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen/p1"), "p1");
  assertEquals(res.status, 200);
});

Deno.test("chargen/:id: non-staff cannot view others", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), NORMAL);
  const res = await handler(req("GET", "/api/v1/chargen/p1"), "other");
  assertEquals(res.status, 403);
});

Deno.test("chargen/:id: staff can view any sheet", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet()), STAFF);
  const res = await handler(req("GET", "/api/v1/chargen/p1"), "admin1");
  assertEquals(res.status, 200);
});

Deno.test("chargen/:id: 404 if sheet not found", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), STAFF);
  const res = await handler(req("GET", "/api/v1/chargen/missing"), "admin1");
  assertEquals(res.status, 404);
});

// ─── PATCH /api/v1/chargen/:id/status ────────────────────────────────────────

Deno.test("status PATCH: non-staff → 403", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet({ status: "pending" })), NORMAL);
  const res = await handler(req("PATCH", "/api/v1/chargen/p1/status", { status: "approved" }), "p1");
  assertEquals(res.status, 403);
});

Deno.test("status PATCH: staff rejects sheet", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "pending" }));
  const handler = makePlaybooksRouter(store, STAFF);
  const res = await handler(req("PATCH", "/api/v1/chargen/p1/status", { status: "rejected", reason: "needs more detail" }), "admin1");
  assertEquals(res.status, 200);
  assertEquals((store._sheet as ICharSheet).status, "rejected");
  assertEquals((store._sheet as ICharSheet).rejectionReason, "needs more detail");
});

Deno.test("status PATCH: staff approves sheet → applies to player", async () => {
  const store = makeSheetStore(validAwareSheet({ status: "pending" }));
  const players = makePlayerStore(true);
  const handler = makePlaybooksRouter(store, players);
  const res = await handler(req("PATCH", "/api/v1/chargen/p1/status", { status: "approved" }), "admin1");
  assertEquals(res.status, 200);
  assertEquals((store._sheet as ICharSheet).status, "approved");
  // applySheetToPlayer was called
  assertExists(players._applied);
  const data = (players._applied as Record<string, unknown>).data as Record<string, unknown>;
  assertEquals(data.chargenStatus, "approved");
  assertEquals(data.playbookName, "The Aware");
  assertExists(data.circleStatus);
  assertExists(data.circleRatings);
});

Deno.test("status PATCH: invalid status → 400", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(validAwareSheet({ status: "pending" })), STAFF);
  const res = await handler(req("PATCH", "/api/v1/chargen/p1/status", { status: "limbo" }), "admin1");
  assertEquals(res.status, 400);
});

Deno.test("status PATCH: sheet not found → 404", async () => {
  const handler = makePlaybooksRouter(makeSheetStore(null), STAFF);
  const res = await handler(req("PATCH", "/api/v1/chargen/missing/status", { status: "approved" }), "admin1");
  assertEquals(res.status, 404);
});

// ─── circleStatus seeding from playbook ──────────────────────────────────────

Deno.test("new sheet: circleStatus seeded from playbook defaults", async () => {
  const store = makeSheetStore(null);
  const players = makePlayerStore(false, "Alex");
  const handler = makePlaybooksRouter(store, players);
  await handler(req("POST", "/api/v1/chargen", { playbookId: "aware" }), "p2");
  const sheet = store._sheet as ICharSheet;
  // Aware circleStatus: { mortalis: 1, night: 0, power: 0, wild: 0 }
  assertEquals(sheet.circleStatus.mortalis, 1);
  assertEquals(sheet.circleStatus.night, 0);
  assertEquals(sheet.circleStatus.power, 0);
  assertEquals(sheet.circleStatus.wild, 0);
});

Deno.test("approval: circleStatus copied to player data", async () => {
  const store = makeSheetStore(validAwareSheet({
    status: "pending",
    circleStatus: { mortalis: 2, night: 0, power: 0, wild: 0 },
  }));
  const players = makePlayerStore(true);
  const handler = makePlaybooksRouter(store, players);
  await handler(req("PATCH", "/api/v1/chargen/p1/status", { status: "approved" }), "admin1");
  const data = (players._applied as Record<string, unknown>).data as Record<string, unknown>;
  const cs = data.circleStatus as Record<string, number>;
  assertEquals(cs.mortalis, 2);
});
