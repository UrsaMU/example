import { assertEquals } from "@std/assert";
import {
  buildQuestionsForPlaybook,
  scoreAnswers,
  allAnswered,
  unansweredQuestions,
  computeSessionXP,
  blankAnswers,
  createAnswerRecord,
} from "../src/plugins/session/logic.ts";
import { STANDARD_QUESTIONS, PLAYBOOK_QUESTIONS } from "../src/plugins/session/questions.ts";
import { XP_PER_ADVANCE } from "../src/plugins/advancement/logic.ts";

// ─── buildQuestionsForPlaybook ────────────────────────────────────────────────

Deno.test("buildQuestionsForPlaybook: known playbook returns 5 questions", () => {
  const qs = buildQuestionsForPlaybook("aware");
  assertEquals(qs.length, 5);
});

Deno.test("buildQuestionsForPlaybook: first 4 are standard questions", () => {
  const qs = buildQuestionsForPlaybook("hunter");
  for (let i = 0; i < 4; i++) {
    assertEquals(qs[i].standard, true);
  }
});

Deno.test("buildQuestionsForPlaybook: 5th question is playbook-specific", () => {
  const qs = buildQuestionsForPlaybook("vamp");
  assertEquals(qs[4].standard, false);
  assertEquals(qs[4].playbookId, "vamp");
});

Deno.test("buildQuestionsForPlaybook: all 12 known playbooks have 5 questions", () => {
  const playbooks = ["aware","fae","hunter","imp","oracle","spectre","sworn","tainted","vamp","veteran","wizard","wolf"];
  for (const pb of playbooks) {
    const qs = buildQuestionsForPlaybook(pb);
    assertEquals(qs.length, 5, `${pb} should have 5 questions`);
  }
});

Deno.test("buildQuestionsForPlaybook: unknown playbook returns 4 standard questions", () => {
  const qs = buildQuestionsForPlaybook("unknown-pb");
  assertEquals(qs.length, 4);
  assertEquals(qs.every((q) => q.standard), true);
});

Deno.test("STANDARD_QUESTIONS has exactly 4 entries", () => {
  assertEquals(STANDARD_QUESTIONS.length, 4);
});

Deno.test("PLAYBOOK_QUESTIONS covers all 12 playbooks", () => {
  const expected = ["aware","fae","hunter","imp","oracle","spectre","sworn","tainted","vamp","veteran","wizard","wolf"];
  for (const pb of expected) {
    assertEquals(pb in PLAYBOOK_QUESTIONS, true, `missing playbook question for ${pb}`);
  }
});

// ─── blankAnswers ─────────────────────────────────────────────────────────────

Deno.test("blankAnswers: all values null", () => {
  const qs  = buildQuestionsForPlaybook("aware");
  const ans = blankAnswers(qs);
  assertEquals(Object.keys(ans).length, 5);
  for (const v of Object.values(ans)) {
    assertEquals(v, null);
  }
});

// ─── scoreAnswers ─────────────────────────────────────────────────────────────

Deno.test("scoreAnswers: all yes → max score", () => {
  const qs  = buildQuestionsForPlaybook("aware");
  const ans = Object.fromEntries(qs.map((q) => [q.id, true]));
  assertEquals(scoreAnswers(qs, ans), 5);
});

Deno.test("scoreAnswers: all no → 0", () => {
  const qs  = buildQuestionsForPlaybook("aware");
  const ans = Object.fromEntries(qs.map((q) => [q.id, false]));
  assertEquals(scoreAnswers(qs, ans), 0);
});

Deno.test("scoreAnswers: mixed answers", () => {
  const qs  = buildQuestionsForPlaybook("hunter");
  const ans: Record<string, boolean | null> = {
    "q-debt":   true,
    "q-learn":  false,
    "q-circle": true,
    "q-death":  false,
    "q-hunter": true,
  };
  assertEquals(scoreAnswers(qs, ans), 3);
});

Deno.test("scoreAnswers: null answers count as 0 (not yes)", () => {
  const qs  = buildQuestionsForPlaybook("wolf");
  const ans = blankAnswers(qs); // all null
  assertEquals(scoreAnswers(qs, ans), 0);
});

// ─── allAnswered ──────────────────────────────────────────────────────────────

Deno.test("allAnswered: blank answers → false", () => {
  const qs = buildQuestionsForPlaybook("fae");
  assertEquals(allAnswered(qs, blankAnswers(qs)), false);
});

Deno.test("allAnswered: all answered yes → true", () => {
  const qs  = buildQuestionsForPlaybook("fae");
  const ans = Object.fromEntries(qs.map((q) => [q.id, true]));
  assertEquals(allAnswered(qs, ans), true);
});

Deno.test("allAnswered: all no → true", () => {
  const qs  = buildQuestionsForPlaybook("fae");
  const ans = Object.fromEntries(qs.map((q) => [q.id, false]));
  assertEquals(allAnswered(qs, ans), true);
});

Deno.test("allAnswered: one null remaining → false", () => {
  const qs  = buildQuestionsForPlaybook("aware");
  const ans: Record<string, boolean | null> = {
    "q-debt":   true,
    "q-learn":  false,
    "q-circle": true,
    "q-death":  false,
    "q-aware":  null,   // not yet answered
  };
  assertEquals(allAnswered(qs, ans), false);
});

// ─── unansweredQuestions ──────────────────────────────────────────────────────

Deno.test("unansweredQuestions: all null → returns all", () => {
  const qs = buildQuestionsForPlaybook("wizard");
  assertEquals(unansweredQuestions(qs, blankAnswers(qs)).length, 5);
});

Deno.test("unansweredQuestions: one null → returns that one", () => {
  const qs  = buildQuestionsForPlaybook("wizard");
  const ans = Object.fromEntries(qs.map((q) => [q.id, true as boolean | null]));
  ans["q-wizard"] = null;
  const rem = unansweredQuestions(qs, ans);
  assertEquals(rem.length, 1);
  assertEquals(rem[0].id, "q-wizard");
});

// ─── computeSessionXP ────────────────────────────────────────────────────────

Deno.test("computeSessionXP: 3 yes with 0 current XP → +3", () => {
  const qs  = buildQuestionsForPlaybook("wolf");
  const ans: Record<string, boolean | null> = {
    "q-debt":   true,
    "q-learn":  true,
    "q-circle": true,
    "q-death":  false,
    "q-wolf":   false,
  };
  assertEquals(computeSessionXP(qs, ans, 0), 3);
});

Deno.test("computeSessionXP: capped by XP_PER_ADVANCE ceiling", () => {
  const qs  = buildQuestionsForPlaybook("wolf");
  const ans = Object.fromEntries(qs.map((q) => [q.id, true])); // 5 yes
  // currentXP = 3, can only earn 2 more before hitting cap
  assertEquals(computeSessionXP(qs, ans, 3), 2);
});

Deno.test("computeSessionXP: XP bar already full → 0 earned", () => {
  const qs  = buildQuestionsForPlaybook("wolf");
  const ans = Object.fromEntries(qs.map((q) => [q.id, true]));
  assertEquals(computeSessionXP(qs, ans, XP_PER_ADVANCE), 0);
});

Deno.test("computeSessionXP: 0 yes → 0 earned regardless of XP", () => {
  const qs  = buildQuestionsForPlaybook("vamp");
  const ans = Object.fromEntries(qs.map((q) => [q.id, false]));
  assertEquals(computeSessionXP(qs, ans, 0), 0);
});

// ─── createAnswerRecord ───────────────────────────────────────────────────────

Deno.test("createAnswerRecord: produces blank answers", () => {
  const rec = createAnswerRecord({
    sessionId: "s1",
    sessionNumber: 1,
    playerId: "p1",
    playerName: "Test",
    playbookId: "aware",
  });
  assertEquals(rec.sessionId, "s1");
  assertEquals(rec.playbookId, "aware");
  assertEquals(rec.xpEarned, 0);
  assertEquals(rec.submittedAt, undefined);
  // all answers null
  for (const v of Object.values(rec.answers)) {
    assertEquals(v, null);
  }
  assertEquals(Object.keys(rec.answers).length, 5);
});
