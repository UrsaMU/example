import { assertEquals, assertFalse } from "@std/assert";
import { isValidOrgCircle, ORG_CIRCLES } from "../src/plugins/orgs/logic.ts";

// --- ORG_CIRCLES -------------------------------------------------------------

Deno.test("ORG_CIRCLES: has exactly 4 entries", () => {
  assertEquals(ORG_CIRCLES.length, 4);
});

Deno.test("ORG_CIRCLES: contains the four Urban Shadows circles", () => {
  const sorted = [...ORG_CIRCLES].sort();
  assertEquals(sorted, ["mortalis", "night", "power", "wild"]);
});

Deno.test("ORG_CIRCLES: all entries are non-empty strings", () => {
  for (const c of ORG_CIRCLES) {
    assertEquals(typeof c, "string");
    assertEquals(c.length > 0, true);
  }
});

// --- isValidOrgCircle --------------------------------------------------------

Deno.test("isValidOrgCircle: accepts all ORG_CIRCLES", () => {
  for (const c of ORG_CIRCLES) {
    assertEquals(isValidOrgCircle(c), true);
  }
});

Deno.test("isValidOrgCircle: rejects invalid strings", () => {
  assertFalse(isValidOrgCircle("day"));
  assertFalse(isValidOrgCircle("shadow"));
  assertFalse(isValidOrgCircle("undead"));
});

Deno.test("isValidOrgCircle: is case-sensitive — rejects uppercase", () => {
  assertFalse(isValidOrgCircle("NIGHT"));
  assertFalse(isValidOrgCircle("Power"));
  assertFalse(isValidOrgCircle("MORTALIS"));
});

Deno.test("isValidOrgCircle: rejects empty string", () => {
  assertFalse(isValidOrgCircle(""));
});

Deno.test("isValidOrgCircle: rejects partial matches", () => {
  assertFalse(isValidOrgCircle("mort"));
  assertFalse(isValidOrgCircle("nigh"));
  assertFalse(isValidOrgCircle("wil"));
});
