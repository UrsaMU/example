import { assertEquals } from "@std/assert";
import {
  adjustCircle,
  clampStatus,
  improveCircle,
  markCircle,
  setCircleStatus,
} from "../src/plugins/circles/logic.ts";
import {
  CIRCLE_STATUS_MAX,
  CIRCLE_STATUS_MIN,
} from "../src/plugins/circles/schema.ts";
import type { ICircleValues } from "../src/plugins/playbooks/schema.ts";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function cs(mortalis = 1, night = 0, power = 1, wild = -1): ICircleValues {
  return { mortalis, night, power, wild };
}

// ─── clampStatus ──────────────────────────────────────────────────────────────

Deno.test("clampStatus: passes through valid values", () => {
  assertEquals(clampStatus(0), 0);
  assertEquals(clampStatus(1), 1);
  assertEquals(clampStatus(-1), -1);
  assertEquals(clampStatus(3), 3);
  assertEquals(clampStatus(-3), -3);
});

Deno.test("clampStatus: clamps above max", () =>
  assertEquals(clampStatus(99), 3));
Deno.test("clampStatus: clamps below min", () =>
  assertEquals(clampStatus(-99), -3));
Deno.test("clampStatus: rounds fractional", () => {
  assertEquals(clampStatus(1.7), 2);
  assertEquals(clampStatus(1.3), 1);
  assertEquals(clampStatus(-1.7), -2);
});

// ─── markCircle ───────────────────────────────────────────────────────────────

Deno.test("markCircle: decrements target circle by 1", () => {
  const result = markCircle(cs(1, 0, 1, -1), "mortalis")!;
  assertEquals(result.mortalis, 0);
  // Others unchanged
  assertEquals(result.night, 0);
  assertEquals(result.power, 1);
  assertEquals(result.wild, -1);
});

Deno.test("markCircle: works on each circle", () => {
  assertEquals(markCircle(cs(1, 1, 1, 1), "night")!.night, 0);
  assertEquals(markCircle(cs(1, 1, 1, 1), "power")!.power, 0);
  assertEquals(markCircle(cs(1, 1, 1, 1), "wild")!.wild, 0);
});

Deno.test("markCircle: returns null at minimum", () => {
  assertEquals(markCircle(cs(-3, 0, 0, 0), "mortalis"), null);
});

Deno.test("markCircle: one above min returns the min", () => {
  const result = markCircle(cs(-2, 0, 0, 0), "mortalis")!;
  assertEquals(result.mortalis, -3);
});

Deno.test("markCircle: does not mutate original", () => {
  const original = cs(2, 0, 0, 0);
  markCircle(original, "mortalis");
  assertEquals(original.mortalis, 2);
});

// ─── improveCircle ────────────────────────────────────────────────────────────

Deno.test("improveCircle: increments target circle by 1", () => {
  const result = improveCircle(cs(0, 1, -1, 2), "mortalis")!;
  assertEquals(result.mortalis, 1);
  assertEquals(result.night, 1);
  assertEquals(result.power, -1);
  assertEquals(result.wild, 2);
});

Deno.test("improveCircle: works on each circle", () => {
  assertEquals(improveCircle(cs(0, 0, 0, 0), "night")!.night, 1);
  assertEquals(improveCircle(cs(0, 0, 0, 0), "power")!.power, 1);
  assertEquals(improveCircle(cs(0, 0, 0, 0), "wild")!.wild, 1);
});

Deno.test("improveCircle: returns null at maximum", () => {
  assertEquals(improveCircle(cs(3, 0, 0, 0), "mortalis"), null);
});

Deno.test("improveCircle: one below max returns the max", () => {
  const result = improveCircle(cs(2, 0, 0, 0), "mortalis")!;
  assertEquals(result.mortalis, 3);
});

Deno.test("improveCircle: does not mutate original", () => {
  const original = cs(0, 0, 0, 0);
  improveCircle(original, "night");
  assertEquals(original.night, 0);
});

// ─── setCircleStatus ──────────────────────────────────────────────────────────

Deno.test("setCircleStatus: sets exact value", () => {
  const result = setCircleStatus(cs(), "night", 2);
  assertEquals(result.night, 2);
});

Deno.test("setCircleStatus: clamps above max", () => {
  assertEquals(setCircleStatus(cs(), "power", 99).power, CIRCLE_STATUS_MAX);
});

Deno.test("setCircleStatus: clamps below min", () => {
  assertEquals(setCircleStatus(cs(), "wild", -99).wild, CIRCLE_STATUS_MIN);
});

Deno.test("setCircleStatus: does not affect other circles", () => {
  const result = setCircleStatus(cs(1, 2, -1, 0), "night", -2);
  assertEquals(result.mortalis, 1);
  assertEquals(result.power, -1);
  assertEquals(result.wild, 0);
});

// ─── adjustCircle ─────────────────────────────────────────────────────────────

Deno.test("adjustCircle: positive delta increments", () => {
  assertEquals(adjustCircle(cs(0, 0, 0, 0), "mortalis", 2).mortalis, 2);
});

Deno.test("adjustCircle: negative delta decrements", () => {
  assertEquals(adjustCircle(cs(1, 0, 0, 0), "mortalis", -3).mortalis, -2);
});

Deno.test("adjustCircle: clamps at max", () => {
  assertEquals(
    adjustCircle(cs(2, 0, 0, 0), "mortalis", 5).mortalis,
    CIRCLE_STATUS_MAX,
  );
});

Deno.test("adjustCircle: clamps at min", () => {
  assertEquals(
    adjustCircle(cs(-2, 0, 0, 0), "mortalis", -5).mortalis,
    CIRCLE_STATUS_MIN,
  );
});

Deno.test("adjustCircle: zero delta is no-op", () => {
  const original = cs(1, -1, 2, 0);
  const result = adjustCircle(original, "night", 0);
  assertEquals(result, original);
});

Deno.test("adjustCircle: does not mutate original", () => {
  const original = cs(1, 0, 0, 0);
  adjustCircle(original, "mortalis", -2);
  assertEquals(original.mortalis, 1);
});

// ─── Constants ────────────────────────────────────────────────────────────────

Deno.test("CIRCLE_STATUS_MIN is -3", () => assertEquals(CIRCLE_STATUS_MIN, -3));
Deno.test("CIRCLE_STATUS_MAX is 3", () => assertEquals(CIRCLE_STATUS_MAX, 3));
