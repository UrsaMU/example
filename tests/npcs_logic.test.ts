import { assertEquals } from "@std/assert";
import { EMPTY_HARM } from "../src/plugins/npcs/schema.ts";

// ─── EMPTY_HARM ───────────────────────────────────────────────────────────────

Deno.test("EMPTY_HARM: has exactly 5 harm boxes", () => {
  assertEquals(EMPTY_HARM.boxes.length, 5);
});

Deno.test("EMPTY_HARM: all harm boxes are false (no harm)", () => {
  assertEquals(EMPTY_HARM.boxes.every((b) => b === false), true);
});

Deno.test("EMPTY_HARM: armor starts at 0", () => {
  assertEquals(EMPTY_HARM.armor, 0);
});

Deno.test("EMPTY_HARM: is not mutated by spread copy", () => {
  const copy = { ...EMPTY_HARM, boxes: [...EMPTY_HARM.boxes] };
  copy.boxes[0] = true;
  copy.armor = 2;
  // Original must be unchanged
  assertEquals(EMPTY_HARM.boxes[0], false);
  assertEquals(EMPTY_HARM.armor, 0);
});
