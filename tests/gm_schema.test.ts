import { assertEquals, assertThrows } from "@std/assert";
import {
  DEFAULT_CONFIG,
  DEFAULT_PERSONA,
  isValidChaosLevel,
  isValidLateJoinPolicy,
  isValidMemoryType,
  isValidMode,
} from "../src/plugins/gm/schema.ts";

// ─── isValidMode ──────────────────────────────────────────────────────────────

Deno.test("isValidMode: accepts 'auto'", () => {
  assertEquals(isValidMode("auto"), true);
});

Deno.test("isValidMode: accepts 'hybrid'", () => {
  assertEquals(isValidMode("hybrid"), true);
});

Deno.test("isValidMode: rejects unknown string", () => {
  assertEquals(isValidMode("manual"), false);
});

Deno.test("isValidMode: rejects empty string", () => {
  assertEquals(isValidMode(""), false);
});

// ─── isValidLateJoinPolicy ────────────────────────────────────────────────────

Deno.test("isValidLateJoinPolicy: accepts 'include'", () => {
  assertEquals(isValidLateJoinPolicy("include"), true);
});

Deno.test("isValidLateJoinPolicy: accepts 'ignore'", () => {
  assertEquals(isValidLateJoinPolicy("ignore"), true);
});

Deno.test("isValidLateJoinPolicy: rejects 'skip'", () => {
  assertEquals(isValidLateJoinPolicy("skip"), false);
});

// ─── isValidMemoryType ────────────────────────────────────────────────────────

Deno.test("isValidMemoryType: accepts all valid types", () => {
  for (
    const t of [
      "plot",
      "npc-state",
      "world-state",
      "player-note",
      "consequence",
    ]
  ) {
    assertEquals(isValidMemoryType(t), true, `Expected ${t} to be valid`);
  }
});

Deno.test("isValidMemoryType: rejects unknown", () => {
  assertEquals(isValidMemoryType("unknown"), false);
});

// ─── isValidChaosLevel ────────────────────────────────────────────────────────

Deno.test("isValidChaosLevel: accepts 1-9", () => {
  for (let n = 1; n <= 9; n++) {
    assertEquals(isValidChaosLevel(n), true, `Expected ${n} to be valid`);
  }
});

Deno.test("isValidChaosLevel: rejects 0", () => {
  assertEquals(isValidChaosLevel(0), false);
});

Deno.test("isValidChaosLevel: rejects 10", () => {
  assertEquals(isValidChaosLevel(10), false);
});

Deno.test("isValidChaosLevel: rejects fractional values", () => {
  assertEquals(isValidChaosLevel(4.5), false);
});

Deno.test("isValidChaosLevel: rejects negative", () => {
  assertEquals(isValidChaosLevel(-1), false);
});

// ─── DEFAULT_CONFIG ───────────────────────────────────────────────────────────

Deno.test("DEFAULT_CONFIG: has expected shape", () => {
  assertEquals(DEFAULT_CONFIG.id, "singleton");
  assertEquals(DEFAULT_CONFIG.provider, "google");
  assertEquals(DEFAULT_CONFIG.mode, "auto");
  assertEquals(DEFAULT_CONFIG.chaosLevel, 5);
  assertEquals(DEFAULT_CONFIG.roundTimeoutSeconds, 300);
  assertEquals(DEFAULT_CONFIG.watchedRooms.length, 0);
  assertEquals(DEFAULT_CONFIG.ignoredPlayers.length, 0);
  assertEquals(DEFAULT_CONFIG.autoframe, true);
  assertEquals(DEFAULT_CONFIG.greet, true);
  assertEquals(DEFAULT_CONFIG.lateJoins, "include");
  assertEquals(DEFAULT_CONFIG.autoPublishLore, false);
});

Deno.test("DEFAULT_PERSONA: has required fields", () => {
  assertEquals(typeof DEFAULT_PERSONA.name, "string");
  assertEquals(typeof DEFAULT_PERSONA.tone, "string");
  assertEquals(typeof DEFAULT_PERSONA.style, "string");
  assertEquals(typeof DEFAULT_PERSONA.oocBrackets, "boolean");
});
