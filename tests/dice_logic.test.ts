import { assertEquals } from "@std/assert";
import {
  computeOutcome,
  rollDice,
  seqRoller,
  STAT_NAMES,
} from "../src/plugins/dice/logic.ts";

// ─── computeOutcome ───────────────────────────────────────────────────────────

Deno.test("computeOutcome: 2 → miss", () => {
  const r = computeOutcome(2);
  assertEquals(r.outcome, "miss");
  assertEquals(r.outcomeLabel, "6-");
});

Deno.test("computeOutcome: 6 → miss (boundary)", () => {
  const r = computeOutcome(6);
  assertEquals(r.outcome, "miss");
  assertEquals(r.outcomeLabel, "6-");
});

Deno.test("computeOutcome: 7 → weak (boundary)", () => {
  const r = computeOutcome(7);
  assertEquals(r.outcome, "weak");
  assertEquals(r.outcomeLabel, "7-9");
});

Deno.test("computeOutcome: 9 → weak (boundary)", () => {
  const r = computeOutcome(9);
  assertEquals(r.outcome, "weak");
  assertEquals(r.outcomeLabel, "7-9");
});

Deno.test("computeOutcome: 10 → strong (boundary)", () => {
  const r = computeOutcome(10);
  assertEquals(r.outcome, "strong");
  assertEquals(r.outcomeLabel, "10+");
});

Deno.test("computeOutcome: 14 → strong (max roll + best stat)", () => {
  const r = computeOutcome(14);
  assertEquals(r.outcome, "strong");
  assertEquals(r.outcomeLabel, "10+");
});

Deno.test("computeOutcome: 0 → miss (negative total possible with -1 stat)", () => {
  const r = computeOutcome(0);
  assertEquals(r.outcome, "miss");
  assertEquals(r.outcomeLabel, "6-");
});

// ─── rollDice ─────────────────────────────────────────────────────────────────

Deno.test("rollDice: dice values are recorded correctly", () => {
  const roller = seqRoller([3, 4]);
  const result = rollDice(0, 0, roller);
  assertEquals(result.dice, [3, 4]);
});

Deno.test("rollDice: total = d1 + d2 + stat + bonus", () => {
  const roller = seqRoller([3, 4]); // 7
  const result = rollDice(1, 1, roller); // 7 + 1 + 1 = 9
  assertEquals(result.total, 9);
  assertEquals(result.stat, 1);
  assertEquals(result.bonus, 1);
});

Deno.test("rollDice: stat=0, bonus=0, dice=[3,3] → total=6 → miss", () => {
  const result = rollDice(0, 0, seqRoller([3, 3]));
  assertEquals(result.total, 6);
  assertEquals(result.outcome, "miss");
  assertEquals(result.outcomeLabel, "6-");
});

Deno.test("rollDice: stat=1, dice=[3,3] → total=7 → weak", () => {
  const result = rollDice(1, 0, seqRoller([3, 3]));
  assertEquals(result.total, 7);
  assertEquals(result.outcome, "weak");
  assertEquals(result.outcomeLabel, "7-9");
});

Deno.test("rollDice: stat=1, bonus=1, dice=[4,4] → total=10 → strong", () => {
  const result = rollDice(1, 1, seqRoller([4, 4]));
  assertEquals(result.total, 10);
  assertEquals(result.outcome, "strong");
  assertEquals(result.outcomeLabel, "10+");
});

Deno.test("rollDice: negative stat shifts outcome down", () => {
  // 4+4=8, stat=-1 → total=7 → weak (not strong)
  const result = rollDice(-1, 0, seqRoller([4, 4]));
  assertEquals(result.total, 7);
  assertEquals(result.outcome, "weak");
});

Deno.test("rollDice: bonus=2 pushes weak into strong", () => {
  // 3+3=6, stat=0, bonus=2 → total=8 → weak
  const r1 = rollDice(0, 2, seqRoller([3, 3]));
  assertEquals(r1.total, 8);
  assertEquals(r1.outcome, "weak");

  // 4+4=8, stat=0, bonus=2 → total=10 → strong
  const r2 = rollDice(0, 2, seqRoller([4, 4]));
  assertEquals(r2.total, 10);
  assertEquals(r2.outcome, "strong");
});

Deno.test("rollDice: worst roll — dice=[1,1], stat=-1, bonus=0 → total=1 → miss", () => {
  const result = rollDice(-1, 0, seqRoller([1, 1]));
  assertEquals(result.total, 1);
  assertEquals(result.outcome, "miss");
});

Deno.test("rollDice: best roll — dice=[6,6], stat=2, bonus=0 → total=14 → strong", () => {
  const result = rollDice(2, 0, seqRoller([6, 6]));
  assertEquals(result.total, 14);
  assertEquals(result.outcome, "strong");
});

Deno.test("rollDice: bonus defaults to 0", () => {
  const result = rollDice(1, undefined, seqRoller([3, 3]));
  assertEquals(result.bonus, 0);
  assertEquals(result.total, 7);
});

// ─── seqRoller ────────────────────────────────────────────────────────────────

Deno.test("seqRoller: cycles through values", () => {
  const roller = seqRoller([1, 2, 3]);
  assertEquals(roller(), 1);
  assertEquals(roller(), 2);
  assertEquals(roller(), 3);
  assertEquals(roller(), 1); // wraps
  assertEquals(roller(), 2);
});

Deno.test("seqRoller: single value repeats", () => {
  const roller = seqRoller([5]);
  assertEquals(roller(), 5);
  assertEquals(roller(), 5);
  assertEquals(roller(), 5);
});

// ─── STAT_NAMES ───────────────────────────────────────────────────────────────

Deno.test("STAT_NAMES contains all four Urban Shadows stats", () => {
  assertEquals([...STAT_NAMES].sort(), ["blood", "heart", "mind", "spirit"]);
});

// ─── Outcome distribution sanity check ───────────────────────────────────────

Deno.test("rollDice: 1000 random rolls all have valid outcomes", () => {
  for (let i = 0; i < 1000; i++) {
    const result = rollDice(0, 0);
    // dice values 1-6
    assertEquals(result.dice[0] >= 1 && result.dice[0] <= 6, true);
    assertEquals(result.dice[1] >= 1 && result.dice[1] <= 6, true);
    // total in range
    const expected = result.dice[0] + result.dice[1];
    assertEquals(result.total, expected);
    // outcome consistent with total
    if (result.total >= 10) assertEquals(result.outcome, "strong");
    else if (result.total >= 7) assertEquals(result.outcome, "weak");
    else assertEquals(result.outcome, "miss");
  }
});
