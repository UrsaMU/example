import { assertEquals, assertFalse } from "@std/assert";
import {
  isValidType,
  DOWNTIME_TYPES,
  DOWNTIME_TYPE_LABELS,
} from "../src/plugins/downtime/logic.ts";

// --- DOWNTIME_TYPES ----------------------------------------------------------

Deno.test("DOWNTIME_TYPES: has exactly 6 types", () => {
  assertEquals(DOWNTIME_TYPES.length, 6);
});

Deno.test("DOWNTIME_TYPES: contains all expected types", () => {
  const types = [...DOWNTIME_TYPES];
  assertEquals(types.includes("recover"), true);
  assertEquals(types.includes("indulge"), true);
  assertEquals(types.includes("consolidate"), true);
  assertEquals(types.includes("work-contact"), true);
  assertEquals(types.includes("pursue-lead"), true);
  assertEquals(types.includes("other"), true);
});

Deno.test("DOWNTIME_TYPES: all entries are non-empty strings", () => {
  for (const t of DOWNTIME_TYPES) {
    assertEquals(typeof t, "string");
    assertEquals(t.length > 0, true);
  }
});

// --- isValidType -------------------------------------------------------------

Deno.test("isValidType: accepts every DOWNTIME_TYPE", () => {
  for (const t of DOWNTIME_TYPES) {
    assertEquals(isValidType(t), true);
  }
});

Deno.test("isValidType: rejects unknown strings", () => {
  assertFalse(isValidType("vacation"));
  assertFalse(isValidType("heal"));
  assertFalse(isValidType("rest"));
});

Deno.test("isValidType: is case-sensitive — rejects uppercase", () => {
  assertFalse(isValidType("RECOVER"));
  assertFalse(isValidType("Indulge"));
  assertFalse(isValidType("OTHER"));
});

Deno.test("isValidType: rejects empty string", () => {
  assertFalse(isValidType(""));
});

// --- DOWNTIME_TYPE_LABELS ----------------------------------------------------

Deno.test("DOWNTIME_TYPE_LABELS: has a label for every type", () => {
  for (const t of DOWNTIME_TYPES) {
    assertEquals(typeof DOWNTIME_TYPE_LABELS[t], "string");
    assertEquals(DOWNTIME_TYPE_LABELS[t].length > 0, true);
  }
});

Deno.test("DOWNTIME_TYPE_LABELS: no extra keys beyond DOWNTIME_TYPES", () => {
  const labelKeys = Object.keys(DOWNTIME_TYPE_LABELS).sort();
  const typeKeys = [...DOWNTIME_TYPES].sort();
  assertEquals(labelKeys, typeKeys);
});

Deno.test("DOWNTIME_TYPE_LABELS: all labels are ASCII-only", () => {
  for (const label of Object.values(DOWNTIME_TYPE_LABELS)) {
    for (const ch of label) {
      assertEquals(ch.charCodeAt(0) <= 127, true, `Non-ASCII char in label: ${label}`);
    }
  }
});
