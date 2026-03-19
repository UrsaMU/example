import { assertEquals, assertExists } from "@std/assert";
import {
  buildMoveIndex,
  extractStat,
  findMove,
  getSheetMoves,
  resolveMove,
} from "../src/plugins/moves/logic.ts";
import { seqRoller } from "../src/plugins/dice/logic.ts";
import type { ICharSheet } from "../src/plugins/playbooks/schema.ts";

// ─── extractStat ──────────────────────────────────────────────────────────────

Deno.test("extractStat: 'roll with Heart' → heart", () => {
  assertEquals(extractStat("roll with Heart"), "heart");
});

Deno.test("extractStat: 'roll with Blood' → blood", () => {
  assertEquals(
    extractStat("When you lead allies, roll with Blood. On a 10+..."),
    "blood",
  );
});

Deno.test("extractStat: 'roll with Mind' → mind", () => {
  assertEquals(
    extractStat("When you infiltrate, roll with Mind. On a 10+..."),
    "mind",
  );
});

Deno.test("extractStat: 'roll with Spirit' → spirit", () => {
  assertEquals(
    extractStat("When you reach out, roll with Spirit. On a 10+..."),
    "spirit",
  );
});

Deno.test("extractStat: case-insensitive match", () => {
  assertEquals(extractStat("roll with HEART"), "heart");
  assertEquals(extractStat("roll with Heart"), "heart");
});

Deno.test("extractStat: no roll → null (passive)", () => {
  assertEquals(
    extractStat("Your attacks gain +1 harm against supernatural creatures."),
    null,
  );
});

Deno.test("extractStat: 'roll with Heart instead of Mind' → heart", () => {
  // Moves that substitute one stat for another still trigger on Heart
  assertEquals(
    extractStat("When you mislead someone, roll with Heart instead of Mind."),
    "heart",
  );
});

// ─── findMove ─────────────────────────────────────────────────────────────────

Deno.test("findMove: exact ID match", () => {
  const move = findMove("aware-i-know-a-guy");
  assertExists(move);
  assertEquals(move.id, "aware-i-know-a-guy");
  assertEquals(move.playbookId, "aware");
});

Deno.test("findMove: exact ID match for fae required move", () => {
  const move = findMove("fae-faerie-magic");
  assertExists(move);
  assertEquals(move.id, "fae-faerie-magic");
  assertEquals(move.playbookId, "fae");
});

Deno.test("findMove: partial name match (case insensitive)", () => {
  const move = findMove("lion's den");
  assertExists(move);
  assertEquals(move.id, "aware-the-lions-den");
});

Deno.test("findMove: partial name lowercase matches", () => {
  const move = findMove("deadly");
  assertExists(move);
  assertEquals(move.id, "hunter-deadly");
});

Deno.test("findMove: unknown query → null", () => {
  assertEquals(findMove("absolutely-not-a-move"), null);
  assertEquals(findMove(""), null);
});

// ─── buildMoveIndex ───────────────────────────────────────────────────────────

Deno.test("buildMoveIndex: contains moves from all 12 playbooks", () => {
  const index = buildMoveIndex();
  // 12 playbooks × ~5-6 moves each ≥ 60 total
  assertEquals(index.size >= 60, true);
});

Deno.test("buildMoveIndex: each entry includes playbookId and playbookName", () => {
  const index = buildMoveIndex();
  for (const move of index.values()) {
    assertExists(move.playbookId);
    assertExists(move.playbookName);
    assertExists(move.id);
    assertExists(move.name);
    assertExists(move.description);
  }
});

Deno.test("buildMoveIndex: spot-check known moves exist", () => {
  const index = buildMoveIndex();
  assertExists(index.get("fae-faerie-magic"));
  assertExists(index.get("hunter-deadly"));
  assertExists(index.get("aware-i-know-a-guy"));
});

// ─── getSheetMoves ────────────────────────────────────────────────────────────

const STUB_SHEET: ICharSheet = {
  id: "p1",
  playerId: "p1",
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

Deno.test("getSheetMoves: returns resolved moves for all selectedMoves", () => {
  const moves = getSheetMoves(STUB_SHEET);
  assertEquals(moves.length, 3);
  assertEquals(moves[0].id, "aware-i-know-a-guy");
  assertEquals(moves[1].id, "aware-the-lions-den");
  assertEquals(moves[2].id, "hunter-deadly");
});

Deno.test("getSheetMoves: cross-playbook move (hunter-deadly on aware sheet) is resolved", () => {
  const moves = getSheetMoves(STUB_SHEET);
  const deadly = moves.find((m) => m.id === "hunter-deadly");
  assertExists(deadly);
  assertEquals(deadly.playbookId, "hunter");
  assertEquals(deadly.playbookName, "The Hunter");
});

Deno.test("getSheetMoves: unknown move IDs are filtered out gracefully", () => {
  const sheet: ICharSheet = {
    ...STUB_SHEET,
    selectedMoves: ["aware-i-know-a-guy", "bogus-move-id"],
  };
  const moves = getSheetMoves(sheet);
  assertEquals(moves.length, 1);
  assertEquals(moves[0].id, "aware-i-know-a-guy");
});

// ─── resolveMove ─────────────────────────────────────────────────────────────

Deno.test("resolveMove: passive move (hunter-deadly) → no roll", () => {
  const move = findMove("hunter-deadly")!;
  const result = resolveMove(move, 1);
  assertEquals(result.isPassive, true);
  assertEquals(result.stat, null);
  assertEquals(result.roll, undefined);
});

Deno.test("resolveMove: rolling move (aware-i-know-a-guy) rolls Heart", () => {
  const move = findMove("aware-i-know-a-guy")!;
  const roller = seqRoller([5, 5]); // 5 + 5 + stat(1) = 11 → strong
  const result = resolveMove(move, 1, 0, roller);
  assertEquals(result.isPassive, false);
  assertEquals(result.stat, "heart");
  assertExists(result.roll);
  assertEquals(result.roll!.dice, [5, 5]);
  assertEquals(result.roll!.total, 11);
  assertEquals(result.roll!.outcome, "strong");
});

Deno.test("resolveMove: rolling move with negative stat → miss", () => {
  const move = findMove("aware-the-lions-den")!; // rolls Mind
  const roller = seqRoller([2, 2]); // 2 + 2 + stat(-1) = 3 → miss
  const result = resolveMove(move, -1, 0, roller);
  assertEquals(result.stat, "mind");
  assertExists(result.roll);
  assertEquals(result.roll!.total, 3);
  assertEquals(result.roll!.outcome, "miss");
});

Deno.test("resolveMove: bonus is applied correctly", () => {
  const move = findMove("hunter-this-way")!; // rolls Blood
  const roller = seqRoller([3, 3]); // 3 + 3 + stat(1) + bonus(2) = 9 → weak
  const result = resolveMove(move, 1, 2, roller);
  assertExists(result.roll);
  assertEquals(result.roll!.total, 9);
  assertEquals(result.roll!.outcome, "weak");
});

Deno.test("resolveMove: stat 0 with dice [4,4] → 8 → weak", () => {
  const move = findMove("fae-faerie-magic")!; // rolls Spirit
  const roller = seqRoller([4, 4]);
  const result = resolveMove(move, 0, 0, roller);
  assertExists(result.roll);
  assertEquals(result.roll!.total, 8);
  assertEquals(result.roll!.outcome, "weak");
});

// ─── Stat coverage across playbooks ──────────────────────────────────────────

Deno.test("at least one move rolls each of the four stats", () => {
  const index = buildMoveIndex();
  const stats = new Set<string>();
  for (const move of index.values()) {
    const s = extractStat(move.description);
    if (s) stats.add(s);
  }
  assertEquals(stats.has("blood"), true);
  assertEquals(stats.has("heart"), true);
  assertEquals(stats.has("mind"), true);
  assertEquals(stats.has("spirit"), true);
});
