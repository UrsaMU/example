import type { ClockSize, IFront } from "./schema.ts";

/** Render a clock as a filled/empty bar. */
export function clockBar(ticks: number, size: number): string {
  const filled = Math.min(ticks, size);
  return "[" + "#".repeat(filled) + ".".repeat(size - filled) + "]" +
    ` ${filled}/${size}`;
}

/** True if the clock has reached doom. */
export function isDoom(front: IFront): boolean {
  return front.clockTicks >= front.clockSize;
}

/** Tick the clock forward by n, clamped to clockSize. Returns new tick count. */
export function tickClock(current: number, n: number, size: ClockSize): number {
  return Math.min(current + n, size);
}

/** Tick the clock backward by 1, floor at 0. */
export function untickClock(current: number): number {
  return Math.max(current - 1, 0);
}
