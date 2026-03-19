// ─── Session Logic (pure, no I/O) ─────────────────────────────────────────────

import type { IQuestion, ISessionAnswers, QuestionAnswer } from "./schema.ts";
import { buildQuestionsForPlaybook } from "./questions.ts";
import { XP_PER_ADVANCE } from "../advancement/logic.ts";

export { buildQuestionsForPlaybook };

// ─── Answer scoring ───────────────────────────────────────────────────────────

/**
 * Count how many questions were answered "Yes".
 * Unanswered (null) questions are treated as No.
 */
export function scoreAnswers(
  questions: IQuestion[],
  answers: Record<string, QuestionAnswer>,
): number {
  return questions.filter((q) => answers[q.id] === true).length;
}

/**
 * True when every question has a non-null answer (yes or no).
 */
export function allAnswered(
  questions: IQuestion[],
  answers: Record<string, QuestionAnswer>,
): boolean {
  return questions.every((q) =>
    answers[q.id] !== null && answers[q.id] !== undefined
  );
}

/**
 * Return questions that still need an answer.
 */
export function unansweredQuestions(
  questions: IQuestion[],
  answers: Record<string, QuestionAnswer>,
): IQuestion[] {
  return questions.filter((q) => answers[q.id] == null);
}

// ─── XP calculation ───────────────────────────────────────────────────────────

/**
 * How much XP a player earns from their session answers, capped by how much
 * room they have before the XP_PER_ADVANCE ceiling.
 *
 * @param questions  The full set of questions for this player's playbook.
 * @param answers    Their answered record.
 * @param currentXP  Their current XP total (so we don't overflow).
 */
export function computeSessionXP(
  questions: IQuestion[],
  answers: Record<string, QuestionAnswer>,
  currentXP: number,
): number {
  const yesCount = scoreAnswers(questions, answers);
  const room = XP_PER_ADVANCE - currentXP;
  return Math.max(0, Math.min(yesCount, room));
}

// ─── Session answer initialisation ───────────────────────────────────────────

/**
 * Build a blank answers map (all null) for a given question set.
 */
export function blankAnswers(
  questions: IQuestion[],
): Record<string, QuestionAnswer> {
  return Object.fromEntries(questions.map((q) => [q.id, null]));
}

/**
 * Create a fresh ISessionAnswers record for a player joining a session.
 */
export function createAnswerRecord(params: {
  sessionId: string;
  sessionNumber: number;
  playerId: string;
  playerName: string;
  playbookId: string;
}): ISessionAnswers {
  const questions = buildQuestionsForPlaybook(params.playbookId);
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sessionId: params.sessionId,
    sessionNumber: params.sessionNumber,
    playerId: params.playerId,
    playerName: params.playerName,
    playbookId: params.playbookId,
    answers: blankAnswers(questions),
    xpEarned: 0,
    createdAt: now,
    updatedAt: now,
  };
}
