import { DOWNTIME_TYPES } from "./schema.ts";
import type { DowntimeActionType } from "./schema.ts";

export { DOWNTIME_TYPES };
export type { DowntimeActionType };

export const DOWNTIME_TYPE_LABELS: Record<DowntimeActionType, string> = {
  "recover": "Recover (heal harm)",
  "indulge": "Indulge Your Vice (clear corruption)",
  "consolidate": "Consolidate Power (circle status)",
  "work-contact": "Work a Contact",
  "pursue-lead": "Pursue a Lead",
  "other": "Other (freeform)",
};

/** Type guard: returns true if s is a valid DowntimeActionType. */
export function isValidType(s: string): s is DowntimeActionType {
  return (DOWNTIME_TYPES as readonly string[]).includes(s);
}
