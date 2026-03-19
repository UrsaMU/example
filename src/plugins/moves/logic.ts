// ─── Move Resolution Logic (pure, no I/O) ─────────────────────────────────────

import { rollDice } from "../dice/logic.ts";
import { PLAYBOOKS } from "../playbooks/data.ts";
import type { RollResult, StatName } from "../dice/logic.ts";
import type { ICharSheet, IPlaybookMove } from "../playbooks/schema.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoveWithSource extends IPlaybookMove {
  playbookId: string;
  playbookName: string;
}

export interface MoveResolutionResult {
  move: MoveWithSource;
  stat: StatName | null;
  isPassive: boolean;
  statValue?: number;
  roll?: RollResult;
}

// ─── Stat extraction ──────────────────────────────────────────────────────────

/**
 * Extract the triggering stat from a move description.
 * Looks for the pattern "roll with Blood/Heart/Mind/Spirit".
 * Returns null if no roll is found (passive move).
 */
export function extractStat(description: string): StatName | null {
  const m = description.match(/\broll with (blood|heart|mind|spirit)\b/i);
  return m ? (m[1].toLowerCase() as StatName) : null;
}

// ─── Move lookup ──────────────────────────────────────────────────────────────

/**
 * Build a flat index of every move across all playbooks, keyed by move ID.
 * Called once at resolve time — no caching needed for a game server.
 */
export function buildMoveIndex(): Map<string, MoveWithSource> {
  const index = new Map<string, MoveWithSource>();
  for (const pb of PLAYBOOKS) {
    for (const move of pb.moves) {
      index.set(move.id, { ...move, playbookId: pb.id, playbookName: pb.name });
    }
  }
  return index;
}

/**
 * Find a move across all playbooks by:
 *   1. Exact ID match  (e.g. "aware-i-know-a-guy")
 *   2. Partial case-insensitive name match  (e.g. "lion's den")
 *
 * Returns the first match, or null if nothing found.
 */
export function findMove(query: string): MoveWithSource | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const all = PLAYBOOKS;

  // Exact ID match first — fast and unambiguous
  for (const pb of all) {
    const move = pb.moves.find((m) => m.id === q);
    if (move) return { ...move, playbookId: pb.id, playbookName: pb.name };
  }

  // Partial name match
  for (const pb of all) {
    const move = pb.moves.find((m) => m.name.toLowerCase().includes(q));
    if (move) return { ...move, playbookId: pb.id, playbookName: pb.name };
  }

  return null;
}

/**
 * Get all moves on a character sheet, resolved to full MoveWithSource objects.
 * Handles cross-playbook moves taken via advancement.
 */
export function getSheetMoves(sheet: ICharSheet): MoveWithSource[] {
  const index = buildMoveIndex();
  return sheet.selectedMoves
    .map((id) => index.get(id))
    .filter((m): m is MoveWithSource => m !== undefined);
}

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve a move:
 *   - If passive (no roll trigger), returns isPassive: true with no roll.
 *   - If active, rolls 2d6 + statValue and returns the full result.
 *
 * @param move       The move to resolve.
 * @param statValue  The character's current stat value for the triggering stat.
 * @param bonus      Any extra modifier (default 0).
 * @param rollFn     Injectable die roller — pass a fixed sequence in tests.
 */
export function resolveMove(
  move: MoveWithSource,
  statValue: number,
  bonus = 0,
  rollFn?: () => number,
): MoveResolutionResult {
  const stat = extractStat(move.description);
  if (!stat) {
    return { move, stat: null, isPassive: true };
  }
  const roll = rollDice(statValue, bonus, rollFn);
  return { move, stat, isPassive: false, statValue, roll };
}
