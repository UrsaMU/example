// ─── End-of-Session Questions ─────────────────────────────────────────────────
//
// At the end of each session, every player answers 4 standard questions plus
// 1 question specific to their playbook. Each "Yes" earns 1 XP.

import type { IQuestion } from "./schema.ts";

// ─── Standard questions (all playbooks) ──────────────────────────────────────

export const STANDARD_QUESTIONS: IQuestion[] = [
  {
    id: "q-debt",
    text: "Did you address a Debt with someone?",
    standard: true,
  },
  {
    id: "q-learn",
    text: "Did you learn something significant about a person, faction, or the supernatural?",
    standard: true,
  },
  {
    id: "q-circle",
    text: "Did your Circle's interests or status shape your choices this session?",
    standard: true,
  },
  {
    id: "q-death",
    text: "Did you or someone else come close to dying or being destroyed?",
    standard: true,
  },
];

// ─── Playbook-specific questions ──────────────────────────────────────────────

export const PLAYBOOK_QUESTIONS: Record<string, IQuestion> = {
  aware: {
    id: "q-aware",
    text: "Did you expose a supernatural scheme or protect innocent people from harm?",
    standard: false,
    playbookId: "aware",
  },
  fae: {
    id: "q-fae",
    text: "Did you uphold or betray an obligation to your Court?",
    standard: false,
    playbookId: "fae",
  },
  hunter: {
    id: "q-hunter",
    text: "Did you hunt down a supernatural threat or defend innocents from harm?",
    standard: false,
    playbookId: "hunter",
  },
  imp: {
    id: "q-imp",
    text: "Did a deal bring you significant profit, or blow up dangerously in your face?",
    standard: false,
    playbookId: "imp",
  },
  oracle: {
    id: "q-oracle",
    text: "Did one of your visions prove true, or steer someone into danger?",
    standard: false,
    playbookId: "oracle",
  },
  spectre: {
    id: "q-spectre",
    text: "Did you act on one of your anchors, or did an anchor cause trouble for you?",
    standard: false,
    playbookId: "spectre",
  },
  sworn: {
    id: "q-sworn",
    text: "Did you fulfill or violate a sworn oath or your master's commands?",
    standard: false,
    playbookId: "sworn",
  },
  tainted: {
    id: "q-tainted",
    text: "Did your corruption cause harm to someone you care about?",
    standard: false,
    playbookId: "tainted",
  },
  vamp: {
    id: "q-vamp",
    text: "Did you feed, and if so, what did it cost you?",
    standard: false,
    playbookId: "vamp",
  },
  veteran: {
    id: "q-veteran",
    text: "Did you protect someone weaker than yourself, or make a ruthless choice you'll have to live with?",
    standard: false,
    playbookId: "veteran",
  },
  wizard: {
    id: "q-wizard",
    text: "Did you push your power past its safe limits and face the consequences?",
    standard: false,
    playbookId: "wizard",
  },
  wolf: {
    id: "q-wolf",
    text: "Did you defend your territory or your pack from a significant threat?",
    standard: false,
    playbookId: "wolf",
  },
};

/**
 * Returns the 5 end-of-session questions for a given playbook:
 * the 4 standard questions + the 1 playbook-specific question.
 * If the playbook has no specific question, returns just the 4 standard ones.
 */
export function buildQuestionsForPlaybook(playbookId: string): IQuestion[] {
  const specific = PLAYBOOK_QUESTIONS[playbookId];
  return specific ? [...STANDARD_QUESTIONS, specific] : [...STANDARD_QUESTIONS];
}
