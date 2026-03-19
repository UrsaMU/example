import type { CircleName } from "../playbooks/schema.ts";

export type { CircleName };

export const CIRCLE_NAMES: readonly CircleName[] = [
  "mortalis",
  "night",
  "power",
  "wild",
];

export const CIRCLE_STATUS_MIN = -3;
export const CIRCLE_STATUS_MAX = 3;

// ─── Faction Affiliation ──────────────────────────────────────────────────────
// A specific faction within a circle that the character has standing with.
// Examples: "The Undying Court" (Night), "The Constabulary" (Mortalis)

export interface IFactionEntry {
  id: string;
  playerId: string;
  circle: CircleName;
  name: string; // e.g. "The Undying Court"
  status: number; // -3 to +3, their standing with this faction specifically
  notes: string; // free text — history, obligations, etc.
  createdAt: number;
  updatedAt: number;
}
