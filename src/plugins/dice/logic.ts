// ─── Dice Logic (pure, no I/O) ────────────────────────────────────────────────

export type StatName = "blood" | "heart" | "mind" | "spirit";
export type Outcome = "miss" | "weak" | "strong";

export const STAT_NAMES: readonly StatName[] = ["blood", "heart", "mind", "spirit"];

export interface RollResult {
  dice: [number, number];
  stat: number;
  bonus: number;
  total: number;
  outcome: Outcome;
  outcomeLabel: "6-" | "7-9" | "10+";
}

/** Map a final total to an Urban Shadows outcome. */
export function computeOutcome(total: number): { outcome: Outcome; outcomeLabel: "6-" | "7-9" | "10+" } {
  if (total >= 10) return { outcome: "strong", outcomeLabel: "10+" };
  if (total >= 7)  return { outcome: "weak",   outcomeLabel: "7-9" };
  return                  { outcome: "miss",   outcomeLabel: "6-"  };
}

/**
 * Roll 2d6 + stat + bonus.
 *
 * @param stat   The character's stat value (typically -1, 0, +1, or +2).
 * @param bonus  Any additional modifier (default 0).
 * @param rollFn Injectable die roller — returns 1-6. Defaults to Math.random.
 *               Pass a deterministic function in tests.
 */
export function rollDice(
  stat: number,
  bonus = 0,
  rollFn: () => number = () => Math.ceil(Math.random() * 6),
): RollResult {
  const d1 = rollFn();
  const d2 = rollFn();
  const total = d1 + d2 + stat + bonus;
  const { outcome, outcomeLabel } = computeOutcome(total);
  return { dice: [d1, d2], stat, bonus, total, outcome, outcomeLabel };
}

/** Create a deterministic roller that yields values from a fixed sequence. */
export function seqRoller(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
