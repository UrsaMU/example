// ─── Playbook Definition ─────────────────────────────────────────────────────

export type CircleName = "mortalis" | "night" | "power" | "wild";

export interface ICircleValues {
  mortalis: number;
  night: number;
  power: number;
  wild: number;
}

export interface IStats {
  blood: number;
  heart: number;
  mind: number;
  spirit: number;
}

export interface IPlaybookMove {
  id: string;
  name: string;
  description: string;
  required?: boolean; // auto-selected, cannot be deselected
}

export interface IGearChoice {
  label: string;
  options?: string[]; // if present, player picks one
  count?: number; // how many to pick (default 1)
  detail?: boolean; // player fills in a description
}

export interface IPlaybookFeatureDef {
  key: string; // key used in sheet.features
  label: string; // human display name
  required: boolean; // must be non-empty to submit
  description?: string; // staff-facing guidance
}

export interface IPlaybookAdvance {
  id: string;
  label: string;
  description?: string;
  maxTimes?: number; // how many times it can be taken (default 1)
  statBoost?: keyof IStats; // if taking this advance gives +1 to a stat
  major?: boolean; // major advances require 5+ regular advances first
}

export interface IPlaybook {
  id: string; // e.g. "aware"
  name: string; // "The Aware"
  circle: CircleName; // home circle
  tagline: string;
  demeanors: string[];
  baseStats: IStats;
  circleRatings: ICircleValues;
  circleStatus: ICircleValues;
  introQuestions: string[];
  startingGear: IGearChoice[];
  startingDebts: string[];
  letItOut: string[]; // let it out ability descriptions
  moves: IPlaybookMove[];
  moveCount: number; // total moves (incl. required) player must have at submit
  movesInstruction: string;
  featureDefs: IPlaybookFeatureDef[]; // playbook-specific features to fill in
  advances: IPlaybookAdvance[]; // available advances for this playbook
}

// ─── Character Sheet ──────────────────────────────────────────────────────────

export type ChargenStatus = "draft" | "pending" | "approved" | "rejected";

export interface IHarm {
  boxes: [boolean, boolean, boolean, boolean, boolean];
  armor: number;
}

export interface ICorruption {
  marks: number; // 0–5
  advances: string[]; // names of corruption advances taken
}

export interface IDebt {
  id: string;
  to: string; // character name or NPC name
  description: string; // what was owed / the story behind it
  direction: "owed" | "owes"; // "owed" = they owe me, "owes" = I owe them
}

export interface ICharSheet {
  id: string; // same as player dbobj id
  playerId: string;
  playbookId: string;
  status: ChargenStatus;
  rejectionReason?: string;

  // Identity
  name: string;
  look: string;
  demeanor: string;

  // Stats — player distributes one +1 to any base stat
  stats: IStats;

  // Circles — player distributes one +1 to any circle rating
  circleRatings: ICircleValues;
  circleStatus: ICircleValues;

  // Harm track
  harm: IHarm;

  // Corruption
  corruption: ICorruption;

  // Selected move IDs (required moves are always included)
  selectedMoves: string[];

  // Gear (free-text list of what the player chose)
  gear: string[];

  // Playbook-specific features (territory, web, anchors, etc.)
  features: Record<string, unknown>;

  // Answers to intro questions (question text → answer)
  introAnswers: Record<string, string>;

  // Debts
  debts: IDebt[];

  notes: string;

  // Advancement
  xp: number; // 0–5; at 5 the player spends them for an advance
  takenAdvances: string[]; // advance IDs taken

  createdAt: number;
  updatedAt: number;
}
