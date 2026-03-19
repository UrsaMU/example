import { CIRCLE_NAMES } from "../circles/schema.ts";
import type { CircleName } from "../playbooks/schema.ts";

export { CIRCLE_NAMES as ORG_CIRCLES };

/** Type guard: returns true if s is a valid circle name. */
export function isValidOrgCircle(s: string): s is CircleName {
  return (CIRCLE_NAMES as readonly string[]).includes(s);
}
