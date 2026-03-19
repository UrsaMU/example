import type { ICharSheet } from "../../playbooks/schema.ts";
import { markedHarmCount } from "../../tracker/logic.ts";
import type { IGameSystem } from "./interface.ts";

// ─── Urban Shadows 2E — IGameSystem implementation ───────────────────────────

const CORE_RULES = `
SYSTEM: Urban Shadows 2E (Powered by the Apocalypse)

FICTION FIRST: Moves are triggered by the fiction. When a player's character
does something that would trigger a move, tell them to roll. Never ask "what
move are you making?" -- ask "what does your character do?" and then identify
the move together.

MOVE THRESHOLDS:
  10+  Full success. The player gets what they want, clean.
  7-9  Success with cost, complication, or hard choice. Yes, but...
  6-   Miss. Make a hard MC move. The player marks XP.

STATS: blood, heart, mind, spirit
  blood  -- violence, aggression, physical dominance
  heart  -- empathy, charm, social grace
  mind   -- cunning, investigation, preparation
  spirit -- will, the supernatural, dealing with the other side

THE FOUR CIRCLES: Every character has status (2 to -2) in:
  mortalis  -- the everyday world, humans, institutions
  night     -- vampires, undead, things that feed
  power     -- mages, those with supernatural authority
  wild      -- fae, shapeshifters, the untamed and feral

HARM: 5 boxes. Incapacitated at box 5 marked. Armor reduces harm taken.
CORRUPTION: 5 marks. At 5 marks a corruption advance triggers.
DEBT: Characters owe and are owed debts. Debts are the currency of the city.
  Calling in a debt gives leverage. Ignoring a debt has consequences.

LET IT OUT: Each playbook has a "Let It Out" move that costs corruption.
  This is the moment a character loses control of their darker nature.

FRONTS: Threats to the city organized as Fronts with doom clocks.
  When a clock fills, a catastrophe occurs. Clocks advance on misses,
  on player inaction, or when the fiction demands it.
`.trim();

const HARD_MOVES: readonly string[] = [
  "Announce future badness (make a threat real)",
  "Announce off-screen badness (something bad happened while they weren't looking)",
  "Take away their stuff",
  "Put someone in a spot",
  "Separate them",
  "Give an NPC a face and a name, make them human",
  "Trade harm for harm",
  "Deal harm (as established)",
  "Activate a threat's move",
  "Turn their move back on them",
  "Make them pay a price",
  "Reveal an unwelcome truth",
  "Advance a doom clock",
  "Offer a hard bargain",
  "Tell them the possible consequences and ask if they proceed",
];

const SOFT_MOVES: readonly string[] = [
  "Foreshadow trouble",
  "Show signs of an approaching threat",
  "Hint at something off-screen",
  "Give them a chance to act before things escalate",
  "Introduce a complicating NPC",
  "Put someone in a tense situation",
  "Introduce a choice between two bad options",
  "Remind them of a debt or obligation",
];

function harmDisplay(sheet: ICharSheet): string {
  const boxes = sheet.harm.boxes.map((b) => (b ? "[*]" : "[ ]")).join("");
  const count = markedHarmCount(sheet.harm);
  return `${boxes} (${count}/5)  Armor: ${sheet.harm.armor}`;
}

function corruptionDisplay(sheet: ICharSheet): string {
  const marks = "(*) ".repeat(sheet.corruption.marks) +
    "( ) ".repeat(5 - sheet.corruption.marks);
  return `${marks.trim()} (${sheet.corruption.marks}/5)`;
}

function circleDisplay(sheet: ICharSheet): string {
  const { mortalis, night, power, wild } = sheet.circleStatus;
  return `mortalis ${mortalis}  night ${night}  power ${power}  wild ${wild}`;
}

function debtsDisplay(sheet: ICharSheet): string {
  if (!sheet.debts.length) return "none";
  return sheet.debts
    .map((d) =>
      d.direction === "owed"
        ? `${d.to} owes you: ${d.description}`
        : `you owe ${d.to}: ${d.description}`
    )
    .join("; ");
}

export const urbanShadowsSystem: IGameSystem = {
  id: "urban-shadows",
  name: "Urban Shadows 2E",

  coreRulesPrompt: CORE_RULES,

  moveThresholds: {
    fullSuccess: 10,
    partialSuccess: 7,
  },

  stats: ["blood", "heart", "mind", "spirit"] as const,

  formatMoveResult(
    moveName: string,
    stat: string,
    total: number,
    roll: [number, number],
  ): string {
    const [d1, d2] = roll;
    const threshold = total >= 10
      ? "10+ (full success)"
      : total >= 7
      ? "7-9 (success with cost)"
      : "6- (miss -- mark XP)";
    return `Move: ${moveName} | Stat: ${stat} | Roll: ${d1}+${d2}+stat = ${total} | ${threshold}`;
  },

  formatCharacterContext(sheet: ICharSheet): string {
    const moves = sheet.selectedMoves.join(", ") || "none";
    const gear = sheet.gear.join(", ") || "none";
    return [
      `${sheet.name} (${sheet.playbookId})`,
      `  Stats:      blood ${sheet.stats.blood}  heart ${sheet.stats.heart}  mind ${sheet.stats.mind}  spirit ${sheet.stats.spirit}`,
      `  Harm:       ${harmDisplay(sheet)}`,
      `  Corruption: ${corruptionDisplay(sheet)}`,
      `  Circles:    ${circleDisplay(sheet)}`,
      `  Debts:      ${debtsDisplay(sheet)}`,
      `  XP:         ${sheet.xp}/5`,
      `  Moves:      ${moves}`,
      `  Gear:       ${gear}`,
    ].join("\n");
  },

  adjudicationHint:
    "The fiction always comes first. Identify what move the player's action " +
    "triggers, then apply the outcome mechanically. On a 7-9 always present " +
    "a cost or complication -- never a clean win. On a 6- make a hard MC move " +
    "without telegraphing it. The city has teeth.",

  hardMoves: HARD_MOVES,
  softMoves: SOFT_MOVES,

  missConsequenceHint:
    "On a miss (6-): make a hard MC move immediately. The player marks XP. " +
    "Advance a doom clock if one is relevant. Announce future badness, " +
    "separate them, deal harm, or reveal a truth they didn't want to know. " +
    "Do not soften it. The city does not forgive.",
};
