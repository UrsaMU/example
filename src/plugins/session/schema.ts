// ─── Session Schemas ──────────────────────────────────────────────────────────

export interface IQuestion {
  id: string; // e.g. "q-debt", "q-aware"
  text: string;
  standard: boolean; // true = applies to all playbooks
  playbookId?: string; // set when standard is false
}

export interface ISession {
  id: string;
  number: number;
  title: string; // optional name for the session
  status: "active" | "ended";
  startedAt: number;
  endedAt?: number;
  startedBy: string; // staff id who opened the session
  startedByName: string;
  endedBy?: string;
  endedByName?: string;
}

// null = not yet answered, true = yes, false = no
export type QuestionAnswer = boolean | null;

export interface ISessionAnswers {
  id: string; // uuid
  sessionId: string;
  sessionNumber: number;
  playerId: string;
  playerName: string;
  playbookId: string;
  answers: Record<string, QuestionAnswer>; // questionId → answer
  xpEarned: number;
  submittedAt?: number; // set when player calls +session/done
  createdAt: number;
  updatedAt: number;
}
