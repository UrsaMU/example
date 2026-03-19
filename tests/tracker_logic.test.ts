import { assertEquals } from "@std/assert";
import {
  ARMOR_MAX,
  clearCorruptionMarks,
  CORRUPTION_MARKS_MAX,
  HARM_MAX,
  healHarm,
  isIncapacitated,
  markCorruption,
  markedHarmCount,
  markHarm,
  setArmor,
  takeCorruptionAdvance,
} from "../src/plugins/tracker/logic.ts";
import type { ICorruption, IHarm } from "../src/plugins/playbooks/schema.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function emptyHarm(): IHarm {
  return { boxes: [false, false, false, false, false], armor: 0 };
}

function fullHarm(): IHarm {
  return { boxes: [true, true, true, true, true], armor: 0 };
}

function partialHarm(marked: number, armor = 0): IHarm {
  const boxes = Array(5).fill(false).map((_, i) =>
    i < marked
  ) as IHarm["boxes"];
  return { boxes, armor };
}

function emptyCorruption(): ICorruption {
  return { marks: 0, advances: [] };
}

// ─── markHarm ─────────────────────────────────────────────────────────────────

Deno.test("markHarm: marks first box on empty harm", () => {
  const result = markHarm(emptyHarm())!;
  assertEquals(result.boxes, [true, false, false, false, false]);
});

Deno.test("markHarm: marks next empty box", () => {
  const result = markHarm(partialHarm(2))!;
  assertEquals(result.boxes[0], true);
  assertEquals(result.boxes[1], true);
  assertEquals(result.boxes[2], true);
  assertEquals(result.boxes[3], false);
  assertEquals(result.boxes[4], false);
});

Deno.test("markHarm: marks last box (4 already marked)", () => {
  const result = markHarm(partialHarm(4))!;
  assertEquals(result.boxes.every(Boolean), true);
});

Deno.test("markHarm: returns null when all boxes full", () => {
  const result = markHarm(fullHarm());
  assertEquals(result, null);
});

Deno.test("markHarm: does not mutate original", () => {
  const original = emptyHarm();
  markHarm(original);
  assertEquals(original.boxes[0], false);
});

Deno.test("markHarm: preserves armor value", () => {
  const harm = { ...emptyHarm(), armor: 2 };
  const result = markHarm(harm)!;
  assertEquals(result.armor, 2);
});

// ─── healHarm ─────────────────────────────────────────────────────────────────

Deno.test("healHarm: clears the last marked box (default count=1)", () => {
  const result = healHarm(partialHarm(3));
  assertEquals(result.boxes, [true, true, false, false, false]);
});

Deno.test("healHarm: heals count=2 boxes", () => {
  const result = healHarm(partialHarm(4), 2);
  assertEquals(result.boxes, [true, true, false, false, false]);
});

Deno.test("healHarm: heals all with count=5", () => {
  const result = healHarm(fullHarm(), 5);
  assertEquals(result.boxes.every((b) => !b), true);
});

Deno.test("healHarm: count exceeding marked boxes clamps gracefully", () => {
  const result = healHarm(partialHarm(2), 10);
  assertEquals(result.boxes.every((b) => !b), true);
});

Deno.test("healHarm: healing empty harm is no-op", () => {
  const result = healHarm(emptyHarm(), 3);
  assertEquals(result.boxes.every((b) => !b), true);
});

Deno.test("healHarm: does not mutate original", () => {
  const original = partialHarm(3);
  healHarm(original);
  assertEquals(original.boxes[2], true);
});

Deno.test("healHarm: preserves armor", () => {
  const harm = { ...partialHarm(2), armor: 1 };
  assertEquals(healHarm(harm).armor, 1);
});

// ─── setArmor ─────────────────────────────────────────────────────────────────

Deno.test("setArmor: sets valid armor value", () => {
  assertEquals(setArmor(emptyHarm(), 2).armor, 2);
});

Deno.test("setArmor: clamps below 0 to 0", () => {
  assertEquals(setArmor(emptyHarm(), -1).armor, 0);
});

Deno.test(`setArmor: clamps above ${ARMOR_MAX} to ${ARMOR_MAX}`, () => {
  assertEquals(setArmor(emptyHarm(), 99).armor, ARMOR_MAX);
});

Deno.test("setArmor: rounds fractional values", () => {
  assertEquals(setArmor(emptyHarm(), 1.7).armor, 2);
  assertEquals(setArmor(emptyHarm(), 1.3).armor, 1);
});

Deno.test("setArmor: preserves boxes", () => {
  const harm = partialHarm(2);
  const result = setArmor(harm, 1);
  assertEquals(result.boxes, harm.boxes);
});

// ─── markedHarmCount ─────────────────────────────────────────────────────────

Deno.test("markedHarmCount: 0 on empty harm", () => {
  assertEquals(markedHarmCount(emptyHarm()), 0);
});

Deno.test("markedHarmCount: counts correctly", () => {
  assertEquals(markedHarmCount(partialHarm(3)), 3);
});

Deno.test("markedHarmCount: 5 on full harm", () => {
  assertEquals(markedHarmCount(fullHarm()), 5);
});

// ─── isIncapacitated ──────────────────────────────────────────────────────────

Deno.test("isIncapacitated: false on empty harm", () => {
  assertEquals(isIncapacitated(emptyHarm()), false);
});

Deno.test("isIncapacitated: false on partial harm", () => {
  assertEquals(isIncapacitated(partialHarm(4)), false);
});

Deno.test("isIncapacitated: true on full harm", () => {
  assertEquals(isIncapacitated(fullHarm()), true);
});

// ─── markCorruption ───────────────────────────────────────────────────────────

Deno.test("markCorruption: increments marks", () => {
  const { corruption, advanceTriggered } = markCorruption({
    marks: 0,
    advances: [],
  });
  assertEquals(corruption.marks, 1);
  assertEquals(advanceTriggered, false);
});

Deno.test("markCorruption: no advance before max", () => {
  const { advanceTriggered } = markCorruption({ marks: 3, advances: [] });
  assertEquals(advanceTriggered, false);
});

Deno.test(`markCorruption: triggers advance at ${CORRUPTION_MARKS_MAX}`, () => {
  const { corruption, advanceTriggered } = markCorruption({
    marks: CORRUPTION_MARKS_MAX - 1,
    advances: [],
  });
  assertEquals(advanceTriggered, true);
  assertEquals(corruption.marks, CORRUPTION_MARKS_MAX); // stays at max until advance is taken
});

Deno.test("markCorruption: preserves existing advances on reset", () => {
  const { corruption } = markCorruption({
    marks: CORRUPTION_MARKS_MAX - 1,
    advances: ["Dark Power"],
  });
  assertEquals(corruption.advances, ["Dark Power"]);
});

Deno.test("markCorruption: repeated mark at max stays at max", () => {
  const atMax = { marks: CORRUPTION_MARKS_MAX, advances: [] };
  const { corruption, advanceTriggered } = markCorruption(atMax);
  assertEquals(corruption.marks, CORRUPTION_MARKS_MAX);
  assertEquals(advanceTriggered, true);
});

Deno.test("markCorruption: does not mutate original", () => {
  const original = { marks: 2, advances: [] };
  markCorruption(original);
  assertEquals(original.marks, 2);
});

Deno.test("markCorruption: sequence 1→2→3→4→trigger", () => {
  let c: ICorruption = emptyCorruption();
  for (let i = 1; i < CORRUPTION_MARKS_MAX; i++) {
    const result = markCorruption(c);
    assertEquals(result.advanceTriggered, false);
    assertEquals(result.corruption.marks, i);
    c = result.corruption;
  }
  const final = markCorruption(c);
  assertEquals(final.advanceTriggered, true);
  assertEquals(final.corruption.marks, CORRUPTION_MARKS_MAX); // stays at max until advance taken
});

// ─── takeCorruptionAdvance ────────────────────────────────────────────────────

Deno.test("takeCorruptionAdvance: adds advance name", () => {
  const result = takeCorruptionAdvance(
    { marks: 5, advances: [] },
    "Dark Power",
  );
  assertEquals(result.advances, ["Dark Power"]);
});

Deno.test("takeCorruptionAdvance: resets marks to 0", () => {
  const result = takeCorruptionAdvance(
    { marks: 5, advances: [] },
    "Void Touch",
  );
  assertEquals(result.marks, 0);
});

Deno.test("takeCorruptionAdvance: appends to existing advances", () => {
  const result = takeCorruptionAdvance(
    { marks: 0, advances: ["Dark Power"] },
    "Void Touch",
  );
  assertEquals(result.advances, ["Dark Power", "Void Touch"]);
});

Deno.test("takeCorruptionAdvance: trims advance name", () => {
  const result = takeCorruptionAdvance(
    { marks: 0, advances: [] },
    "  Corrupted Soul  ",
  );
  assertEquals(result.advances[0], "Corrupted Soul");
});

Deno.test("takeCorruptionAdvance: does not mutate original", () => {
  const original: ICorruption = { marks: 3, advances: ["A"] };
  takeCorruptionAdvance(original, "B");
  assertEquals(original.advances.length, 1);
});

// ─── clearCorruptionMarks ─────────────────────────────────────────────────────

Deno.test("clearCorruptionMarks: resets marks to 0", () => {
  const result = clearCorruptionMarks({ marks: 3, advances: ["X"] });
  assertEquals(result.marks, 0);
  assertEquals(result.advances, ["X"]);
});

Deno.test("clearCorruptionMarks: no-op on already zero marks", () => {
  const result = clearCorruptionMarks({ marks: 0, advances: [] });
  assertEquals(result.marks, 0);
});

// ─── Constants ────────────────────────────────────────────────────────────────

Deno.test("HARM_MAX is 5", () => assertEquals(HARM_MAX, 5));
Deno.test("ARMOR_MAX is 3", () => assertEquals(ARMOR_MAX, 3));
Deno.test("CORRUPTION_MARKS_MAX is 5", () =>
  assertEquals(CORRUPTION_MARKS_MAX, 5));
