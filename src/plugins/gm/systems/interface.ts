import type { ICharSheet } from "../../playbooks/schema.ts";

// ─── IGameSystem — swappable RPG system knowledge ────────────────────────────
//
// Implement this interface to make the GM understand a different game system.
// Register the implementation in systems/index.ts and switch with:
//   +gm/config/system <systemId>

export interface IMoveThresholds {
  fullSuccess: number; // 10+ in Urban Shadows
  partialSuccess: number; // 7–9
  // below partialSuccess = miss (GM hard move + mark XP)
}

export interface IGameSystem {
  id: string; // "urban-shadows"
  name: string; // "Urban Shadows 2E"

  // Core rules injected verbatim into the GM system prompt
  coreRulesPrompt: string;

  // Move adjudication thresholds
  moveThresholds: IMoveThresholds;

  // Stat names for this system (used for validation + display)
  stats: readonly string[];

  // Format a move result line for the LLM context
  formatMoveResult(
    moveName: string,
    stat: string,
    total: number,
    roll: [number, number],
  ): string;

  // Format a character sheet as a GM context block
  formatCharacterContext(sheet: ICharSheet): string;

  // Fiction-first principle for this system
  adjudicationHint: string;

  // Hard MC move palette (examples seeded into every prompt)
  hardMoves: readonly string[];

  // Soft MC move palette
  softMoves: readonly string[];

  // What a "miss" means in this system (injected into move adjudication prompt)
  missConsequenceHint: string;
}
