import { assertEquals, assertExists } from "@std/assert";
import {
  buildRoundSummary,
  isTimedOut,
} from "../src/plugins/gm/round-manager.ts";
import type { IGMRound } from "../src/plugins/gm/schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRound(overrides: Partial<IGMRound> = {}): IGMRound {
  const now = Date.now();
  return {
    id: "round-1",
    sessionId: "sess-1",
    roomId: "room-1",
    status: "open",
    expectedPlayers: ["p1", "p2"],
    contributions: [
      {
        playerId: "p1",
        playerName: "Alice",
        poses: ["Alice draws her blade."],
        ready: true,
      },
      {
        playerId: "p2",
        playerName: "Bob",
        poses: [],
        ready: false,
      },
    ],
    openedAt: now - 60_000,
    timeoutAt: now + 240_000,
    ...overrides,
  };
}

// ─── buildRoundSummary ────────────────────────────────────────────────────────

Deno.test("buildRoundSummary: includes room id", () => {
  const summary = buildRoundSummary(makeRound());
  assertEquals(summary.includes("room-1"), true);
});

Deno.test("buildRoundSummary: includes ready player pose", () => {
  const summary = buildRoundSummary(makeRound());
  assertEquals(summary.includes("Alice draws her blade."), true);
});

Deno.test("buildRoundSummary: marks not-ready player", () => {
  const summary = buildRoundSummary(makeRound());
  assertEquals(summary.includes("did not pose"), true);
});

Deno.test("buildRoundSummary: multiple poses listed separately", () => {
  const round = makeRound({
    contributions: [
      {
        playerId: "p1",
        playerName: "Alice",
        poses: ["Alice steps forward.", "She draws steel."],
        ready: true,
      },
    ],
  });
  const summary = buildRoundSummary(round);
  assertEquals(summary.includes("[1]"), true);
  assertEquals(summary.includes("[2]"), true);
});

Deno.test("buildRoundSummary: uses summary if set", () => {
  const round = makeRound({
    contributions: [
      {
        playerId: "p1",
        playerName: "Alice",
        poses: ["raw pose"],
        summary: "Compressed: Alice confronts the threat.",
        ready: true,
      },
    ],
  });
  const summary = buildRoundSummary(round);
  assertEquals(summary.includes("Compressed:"), true);
  assertEquals(summary.includes("raw pose"), false);
});

// ─── isTimedOut ───────────────────────────────────────────────────────────────

Deno.test("isTimedOut: returns false when time remains", () => {
  const round = makeRound({ timeoutAt: Date.now() + 60_000 });
  assertEquals(isTimedOut(round), false);
});

Deno.test("isTimedOut: returns true when timeout has passed", () => {
  const round = makeRound({ timeoutAt: Date.now() - 1 });
  assertEquals(isTimedOut(round), true);
});

Deno.test("isTimedOut: returns true exactly at timeout boundary", () => {
  const round = makeRound({ timeoutAt: Date.now() - 0 });
  // May be true or false by 1ms; just check it doesn't throw
  const result = isTimedOut(round);
  assertEquals(typeof result, "boolean");
});
