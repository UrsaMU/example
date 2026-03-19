// ─── Circle Logic (pure, no I/O) ─────────────────────────────────────────────

import type { ICircleValues, CircleName } from "../playbooks/schema.ts";
import { CIRCLE_STATUS_MIN, CIRCLE_STATUS_MAX } from "./schema.ts";

/** Clamp a circle status value to the allowed range. */
export function clampStatus(value: number): number {
  return Math.max(CIRCLE_STATUS_MIN, Math.min(CIRCLE_STATUS_MAX, Math.round(value)));
}

/**
 * Mark a circle — spend status to invoke that circle's power.
 * Returns updated circleStatus, or null if already at minimum.
 */
export function markCircle(
  circleStatus: ICircleValues,
  circle: CircleName,
): ICircleValues | null {
  const current = circleStatus[circle];
  if (current <= CIRCLE_STATUS_MIN) return null;
  return { ...circleStatus, [circle]: current - 1 };
}

/**
 * Improve a circle's status by +1.
 * Returns updated circleStatus, or null if already at maximum.
 */
export function improveCircle(
  circleStatus: ICircleValues,
  circle: CircleName,
): ICircleValues | null {
  const current = circleStatus[circle];
  if (current >= CIRCLE_STATUS_MAX) return null;
  return { ...circleStatus, [circle]: current + 1 };
}

/**
 * Set a specific circle status to an explicit value (clamped).
 */
export function setCircleStatus(
  circleStatus: ICircleValues,
  circle: CircleName,
  value: number,
): ICircleValues {
  return { ...circleStatus, [circle]: clampStatus(value) };
}

/**
 * Apply a direct delta (+/- N) to a circle status.
 * Clamps to [CIRCLE_STATUS_MIN, CIRCLE_STATUS_MAX].
 */
export function adjustCircle(
  circleStatus: ICircleValues,
  circle: CircleName,
  delta: number,
): ICircleValues {
  const newVal = clampStatus(circleStatus[circle] + delta);
  return { ...circleStatus, [circle]: newVal };
}
