import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { urbanShadowsSystem } from "../src/plugins/gm/systems/urban-shadows.ts";
import type { ICharSheet } from "../src/plugins/playbooks/schema.ts";

// ─── IGameSystem shape ────────────────────────────────────────────────────────

Deno.test("urbanShadowsSystem: has required id and name", () => {
  assertEquals(urbanShadowsSystem.id, "urban-shadows");
  assertEquals(typeof urbanShadowsSystem.name, "string");
});

Deno.test("urbanShadowsSystem: coreRulesPrompt is non-empty string", () => {
  assertEquals(typeof urbanShadowsSystem.coreRulesPrompt, "string");
  assertEquals(urbanShadowsSystem.coreRulesPrompt.length > 100, true);
});

Deno.test("urbanShadowsSystem: moveThresholds are correct PbtA values", () => {
  const t = urbanShadowsSystem.moveThresholds;
  assertEquals(t.fullSuccess, 10);
  assertEquals(t.partialSuccess, 7);
});

Deno.test("urbanShadowsSystem: stats array includes four core stats", () => {
  const stats = urbanShadowsSystem.stats;
  for (const s of ["blood", "heart", "mind", "spirit"]) {
    assertEquals(stats.includes(s), true, `Missing stat: ${s}`);
  }
});

Deno.test("urbanShadowsSystem: hardMoves array is non-empty", () => {
  assertEquals(Array.isArray(urbanShadowsSystem.hardMoves), true);
  assertEquals(urbanShadowsSystem.hardMoves.length > 0, true);
});

Deno.test("urbanShadowsSystem: softMoves array is non-empty", () => {
  assertEquals(Array.isArray(urbanShadowsSystem.softMoves), true);
  assertEquals(urbanShadowsSystem.softMoves.length > 0, true);
});

// ─── formatMoveResult ─────────────────────────────────────────────────────────

Deno.test("formatMoveResult: 10+ returns full success label", () => {
  const result = urbanShadowsSystem.formatMoveResult("Go Aggro", "blood", 10, [
    5,
    5,
  ]);
  assertStringIncludes(result, "10+");
});

Deno.test("formatMoveResult: 9 returns partial success label", () => {
  const result = urbanShadowsSystem.formatMoveResult("Go Aggro", "blood", 9, [
    4,
    4,
  ]);
  assertStringIncludes(result, "7-9");
});

Deno.test("formatMoveResult: 7 returns partial success label", () => {
  const result = urbanShadowsSystem.formatMoveResult("Go Aggro", "blood", 7, [
    3,
    3,
  ]);
  assertStringIncludes(result, "7-9");
});

Deno.test("formatMoveResult: 6 returns miss label", () => {
  const result = urbanShadowsSystem.formatMoveResult("Go Aggro", "blood", 6, [
    3,
    2,
  ]);
  assertStringIncludes(result, "6-");
});

Deno.test("formatMoveResult: 2 returns miss label", () => {
  const result = urbanShadowsSystem.formatMoveResult("Go Aggro", "blood", 2, [
    1,
    1,
  ]);
  assertStringIncludes(result, "6-");
});

// ─── formatCharacterContext ───────────────────────────────────────────────────

function makeSheet(overrides: Partial<ICharSheet> = {}): ICharSheet {
  return {
    id: "sheet-1",
    playerId: "player-1",
    name: "Vex",
    playbookId: "vamp",
    status: "approved",
    look: "pale, sharp-dressed",
    demeanor: "Composed",
    stats: { blood: 2, heart: 1, mind: 0, spirit: -1 },
    harm: { boxes: [false, false, false, false, false], armor: 0 },
    corruption: { marks: 2, advances: [] },
    circleRatings: { mortalis: 0, night: 1, power: 0, wild: 0 },
    circleStatus: { mortalis: 0, night: 1, power: 0, wild: 0 },
    debts: [],
    selectedMoves: ["Undying", "Feed"],
    xp: 3,
    gear: [],
    features: {},
    introAnswers: {},
    notes: "",
    takenAdvances: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

Deno.test("formatCharacterContext: includes character name", () => {
  const output = urbanShadowsSystem.formatCharacterContext(makeSheet());
  assertStringIncludes(output, "Vex");
});

Deno.test("formatCharacterContext: includes stats", () => {
  const output = urbanShadowsSystem.formatCharacterContext(makeSheet());
  assertStringIncludes(output, "blood");
  assertStringIncludes(output, "heart");
});

Deno.test("formatCharacterContext: includes moves", () => {
  const output = urbanShadowsSystem.formatCharacterContext(makeSheet());
  assertStringIncludes(output, "Undying");
});

// ─── adjudicationHint / missConsequenceHint ───────────────────────────────────

Deno.test("adjudicationHint: non-empty string", () => {
  assertEquals(typeof urbanShadowsSystem.adjudicationHint, "string");
  assertEquals(urbanShadowsSystem.adjudicationHint.length > 10, true);
});

Deno.test("missConsequenceHint: non-empty string", () => {
  assertEquals(typeof urbanShadowsSystem.missConsequenceHint, "string");
  assertEquals(urbanShadowsSystem.missConsequenceHint.length > 10, true);
});
