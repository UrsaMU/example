import { assertEquals } from "@std/assert";
import {
  clockBar,
  isDoom,
  tickClock,
  untickClock,
} from "../src/plugins/fronts/logic.ts";
import type { IFront } from "../src/plugins/fronts/schema.ts";

// ─── clockBar ─────────────────────────────────────────────────────────────────

Deno.test("clockBar: empty clock (0/6)", () => {
  assertEquals(clockBar(0, 6), "[......] 0/6");
});

Deno.test("clockBar: fully ticked (6/6)", () => {
  assertEquals(clockBar(6, 6), "[######] 6/6");
});

Deno.test("clockBar: half ticked (2/4)", () => {
  assertEquals(clockBar(2, 4), "[##..] 2/4");
});

Deno.test("clockBar: 4-segment clock fully ticked", () => {
  assertEquals(clockBar(4, 4), "[####] 4/4");
});

Deno.test("clockBar: 8-segment clock partially ticked (3/8)", () => {
  assertEquals(clockBar(3, 8), "[###.....] 3/8");
});

Deno.test("clockBar: clamps ticks to size (ticks > size)", () => {
  // Should render as fully filled, not overflow
  assertEquals(clockBar(10, 6), "[######] 6/6");
});

Deno.test("clockBar: 1-tick into 8-segment clock", () => {
  assertEquals(clockBar(1, 8), "[#.......] 1/8");
});

// ─── isDoom ───────────────────────────────────────────────────────────────────

function makeFront(ticks: number, size: number): IFront {
  return {
    id: "test-id",
    name: "Test Front",
    description: "",
    clockSize: size as 4 | 6 | 8,
    clockTicks: ticks,
    grimPortents: [],
    status: "active",
    createdBy: "staff",
    createdAt: 0,
    updatedAt: 0,
  };
}

Deno.test("isDoom: false when clock not full (3/6)", () => {
  assertEquals(isDoom(makeFront(3, 6)), false);
});

Deno.test("isDoom: false when clock at 0", () => {
  assertEquals(isDoom(makeFront(0, 4)), false);
});

Deno.test("isDoom: true when ticks equal size (6/6)", () => {
  assertEquals(isDoom(makeFront(6, 6)), true);
});

Deno.test("isDoom: true when ticks equal size (4/4)", () => {
  assertEquals(isDoom(makeFront(4, 4)), true);
});

Deno.test("isDoom: true when ticks equal size (8/8)", () => {
  assertEquals(isDoom(makeFront(8, 8)), true);
});

Deno.test("isDoom: true when ticks exceed size (over-ticked)", () => {
  assertEquals(isDoom(makeFront(9, 6)), true);
});

Deno.test("isDoom: false when one tick short of doom (5/6)", () => {
  assertEquals(isDoom(makeFront(5, 6)), false);
});

// ─── tickClock ────────────────────────────────────────────────────────────────

Deno.test("tickClock: advances by 1", () => {
  assertEquals(tickClock(0, 1, 6), 1);
});

Deno.test("tickClock: advances by 3", () => {
  assertEquals(tickClock(2, 3, 6), 5);
});

Deno.test("tickClock: clamps to clockSize", () => {
  assertEquals(tickClock(5, 3, 6), 6);
});

Deno.test("tickClock: already at doom — stays at size", () => {
  assertEquals(tickClock(6, 2, 6), 6);
});

Deno.test("tickClock: clamps with size=4", () => {
  assertEquals(tickClock(3, 5, 4), 4);
});

Deno.test("tickClock: clamps with size=8", () => {
  assertEquals(tickClock(7, 3, 8), 8);
});

Deno.test("tickClock: n=0 — no change", () => {
  assertEquals(tickClock(3, 0, 6), 3);
});

// ─── untickClock ──────────────────────────────────────────────────────────────

Deno.test("untickClock: decrements by 1", () => {
  assertEquals(untickClock(3), 2);
});

Deno.test("untickClock: decrements from doom to 5/6", () => {
  assertEquals(untickClock(6), 5);
});

Deno.test("untickClock: clamps at 0 (already empty)", () => {
  assertEquals(untickClock(0), 0);
});

Deno.test("untickClock: 1 → 0", () => {
  assertEquals(untickClock(1), 0);
});
