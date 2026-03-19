// ─── Advancement Logic (pure, no I/O) ────────────────────────────────────────

import type {
  ICharSheet,
  IPlaybook,
  IPlaybookAdvance,
  IStats,
} from "../playbooks/schema.ts";

export const XP_PER_ADVANCE = 5;
export const STAT_MAX = 2; // stat cap after chargen boosts
export const CIRCLE_RATING_MAX = 3; // circle rating cap

// ─── XP ───────────────────────────────────────────────────────────────────────

/** Mark one XP. Returns updated xp value. Does NOT auto-trigger advance. */
export function markXP(xp: number): number {
  return Math.min(xp + 1, XP_PER_ADVANCE);
}

/** True when the player has enough XP to spend on an advance. */
export function canTakeAdvance(xp: number): boolean {
  return xp >= XP_PER_ADVANCE;
}

// ─── Advance validation ───────────────────────────────────────────────────────

export type AdvanceError =
  | "not-enough-xp"
  | "unknown-advance"
  | "major-advance-locked"
  | "advance-maxed"
  | "stat-at-max"
  | "circle-at-max";

/**
 * Count how many times a given advanceId has been taken.
 * For stat advances, counts all advances sharing the same statBoost key.
 */
export function timesTaken(
  takenAdvances: string[],
  advanceId: string,
  advance: IPlaybookAdvance,
): number {
  if (advance.statBoost) {
    // All stat-blood / stat-heart / etc. advances share the same logical limit
    // keyed by the stat name, not the advance ID. But since there's only one
    // advance per stat, we just count by ID.
    return takenAdvances.filter((id) => id === advanceId).length;
  }
  return takenAdvances.filter((id) => id === advanceId).length;
}

/**
 * Count total non-major advances taken (used to gate major advances).
 */
export function regularAdvanceCount(
  takenAdvances: string[],
  playbook: IPlaybook,
): number {
  const advanceMap = new Map(playbook.advances.map((a) => [a.id, a]));
  return takenAdvances.filter((id) => {
    const adv = advanceMap.get(id);
    return adv && !adv.major;
  }).length;
}

/**
 * Validate whether a player can take an advance.
 * Returns an error string, or null if valid.
 */
export function validateAdvance(
  sheet: Pick<ICharSheet, "xp" | "takenAdvances" | "stats" | "circleRatings">,
  advanceId: string,
  playbook: IPlaybook,
): AdvanceError | null {
  if (!canTakeAdvance(sheet.xp)) return "not-enough-xp";

  const advance = playbook.advances.find((a) => a.id === advanceId);
  if (!advance) return "unknown-advance";

  const maxTimes = advance.maxTimes ?? 1;
  const taken = timesTaken(sheet.takenAdvances, advanceId, advance);
  if (taken >= maxTimes) return "advance-maxed";

  if (advance.major) {
    const regularCount = regularAdvanceCount(sheet.takenAdvances, playbook);
    if (regularCount < XP_PER_ADVANCE) return "major-advance-locked";
  }

  if (advance.statBoost) {
    const currentVal = sheet.stats[advance.statBoost];
    if (currentVal >= STAT_MAX) return "stat-at-max";
  }

  return null;
}

/**
 * Apply an advance to a sheet (pure).
 * Spends XP, records the advance, and applies any stat boost.
 */
export function applyAdvance(
  sheet: Pick<ICharSheet, "xp" | "takenAdvances" | "stats">,
  advance: IPlaybookAdvance,
): { xp: number; takenAdvances: string[]; stats: IStats } {
  const newXP = sheet.xp - XP_PER_ADVANCE;
  const newTaken = [...sheet.takenAdvances, advance.id];
  const newStats = { ...sheet.stats };

  if (advance.statBoost) {
    newStats[advance.statBoost] = (newStats[advance.statBoost] ?? 0) + 1;
  }

  return { xp: newXP, takenAdvances: newTaken, stats: newStats };
}
