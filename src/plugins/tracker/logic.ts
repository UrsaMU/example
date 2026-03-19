// ─── Harm & Corruption Logic (pure, no I/O) ───────────────────────────────────

import type { ICorruption, IHarm } from "../playbooks/schema.ts";

// ─── Harm ─────────────────────────────────────────────────────────────────────

export const HARM_MAX = 5;
export const ARMOR_MAX = 3;

/** Mark the next empty harm box. Returns updated harm, or null if already full. */
export function markHarm(harm: IHarm): IHarm | null {
  const idx = harm.boxes.indexOf(false);
  if (idx === -1) return null; // all boxes already marked

  const boxes = [...harm.boxes] as IHarm["boxes"];
  boxes[idx] = true;
  return { ...harm, boxes };
}

/**
 * Clear `count` harm boxes, starting from the highest-marked (rightmost).
 * Clamps so you can't "heal" past zero marked boxes.
 */
export function healHarm(harm: IHarm, count = 1): IHarm {
  const boxes = [...harm.boxes] as IHarm["boxes"];
  let healed = 0;
  for (let i = boxes.length - 1; i >= 0 && healed < count; i--) {
    if (boxes[i]) {
      boxes[i] = false;
      healed++;
    }
  }
  return { ...harm, boxes };
}

/** Set armor to a clamped value (0–ARMOR_MAX). */
export function setArmor(harm: IHarm, armor: number): IHarm {
  const clamped = Math.max(0, Math.min(ARMOR_MAX, Math.round(armor)));
  return { ...harm, armor: clamped };
}

/** Count how many harm boxes are currently marked. */
export function markedHarmCount(harm: IHarm): number {
  return harm.boxes.filter(Boolean).length;
}

/** True if all 5 harm boxes are marked (character is incapacitated). */
export function isIncapacitated(harm: IHarm): boolean {
  return harm.boxes.every(Boolean);
}

// ─── Corruption ───────────────────────────────────────────────────────────────

export const CORRUPTION_MARKS_MAX = 5;

/**
 * Add one corruption mark. When marks reach CORRUPTION_MARKS_MAX they reset
 * to 0 and `advanceTriggered` is set true — the caller should prompt the
 * player to pick a corruption advance.
 */
export function markCorruption(corruption: ICorruption): {
  corruption: ICorruption;
  advanceTriggered: boolean;
} {
  // Clamp so repeated marks don't overflow past the max.
  const newMarks = Math.min(corruption.marks + 1, CORRUPTION_MARKS_MAX);
  const advanceTriggered = newMarks >= CORRUPTION_MARKS_MAX;

  // Marks stay at CORRUPTION_MARKS_MAX until the player takes their advance
  // via +corruption/take, which resets them to 0. This lets the take command
  // verify an advance is genuinely owed before accepting it.
  return {
    corruption: { ...corruption, marks: newMarks },
    advanceTriggered,
  };
}

/**
 * Record a corruption advance. Resets marks to 0 (advance was earned by filling
 * the track) and appends the advance name to the list.
 */
export function takeCorruptionAdvance(
  corruption: ICorruption,
  advanceName: string,
): ICorruption {
  return {
    marks: 0,
    advances: [...corruption.advances, advanceName.trim()],
  };
}

/** Clear all corruption marks (e.g. after staff reset). */
export function clearCorruptionMarks(corruption: ICorruption): ICorruption {
  return { ...corruption, marks: 0 };
}
