import { assertEquals } from "@std/assert";
import {
  applyAdvance,
  canTakeAdvance,
  markXP,
  regularAdvanceCount,
  STAT_MAX,
  timesTaken,
  validateAdvance,
  XP_PER_ADVANCE,
} from "../src/plugins/advancement/logic.ts";
import type {
  ICharSheet,
  IPlaybook,
  IPlaybookAdvance,
} from "../src/plugins/playbooks/schema.ts";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAT_ADV: IPlaybookAdvance = {
  id: "stat-blood",
  label: "+1 Blood",
  statBoost: "blood",
  maxTimes: 2,
};
const MOVE_ADV: IPlaybookAdvance = {
  id: "move-own-1",
  label: "New move",
  maxTimes: 1,
};
const MAJOR_ADV: IPlaybookAdvance = {
  id: "retire",
  label: "Retire",
  major: true,
  maxTimes: 1,
};
const REPEAT_ADV: IPlaybookAdvance = {
  id: "clear-corruption",
  label: "Clear mark",
  maxTimes: 3,
};

function mockPlaybook(advances: IPlaybookAdvance[] = []): IPlaybook {
  return {
    id: "wolf",
    name: "The Wolf",
    circle: "wild",
    tagline: "",
    demeanors: [],
    baseStats: { blood: 1, heart: 0, mind: -1, spirit: 1 },
    circleRatings: { mortalis: -1, night: 0, power: 1, wild: 1 },
    circleStatus: { mortalis: 0, night: 0, power: 0, wild: 1 },
    introQuestions: [],
    startingGear: [],
    startingDebts: [],
    letItOut: [],
    moves: [],
    moveCount: 2,
    movesInstruction: "",
    featureDefs: [],
    advances,
  };
}

function sheet(
  overrides: Partial<
    { xp: number; takenAdvances: string[]; stats: ICharSheet["stats"] }
  > = {},
) {
  return {
    xp: 5,
    takenAdvances: [] as string[],
    stats: { blood: 1, heart: 0, mind: -1, spirit: 1 },
    circleRatings: { mortalis: -1, night: 0, power: 1, wild: 1 },
    ...overrides,
  };
}

// ─── markXP ───────────────────────────────────────────────────────────────────

Deno.test("markXP: increments by 1", () => assertEquals(markXP(0), 1));
Deno.test("markXP: increments from partial", () => assertEquals(markXP(3), 4));
Deno.test("markXP: does not exceed XP_PER_ADVANCE", () =>
  assertEquals(markXP(5), 5));
Deno.test("markXP: clamps at max when already at max", () =>
  assertEquals(markXP(XP_PER_ADVANCE), XP_PER_ADVANCE));

// ─── canTakeAdvance ───────────────────────────────────────────────────────────

Deno.test("canTakeAdvance: false below threshold", () =>
  assertEquals(canTakeAdvance(4), false));
Deno.test("canTakeAdvance: true at XP_PER_ADVANCE", () =>
  assertEquals(canTakeAdvance(XP_PER_ADVANCE), true));
Deno.test("canTakeAdvance: false at 0", () =>
  assertEquals(canTakeAdvance(0), false));

// ─── timesTaken ───────────────────────────────────────────────────────────────

Deno.test("timesTaken: 0 when not taken", () => {
  assertEquals(timesTaken([], "stat-blood", STAT_ADV), 0);
});

Deno.test("timesTaken: counts correctly", () => {
  assertEquals(
    timesTaken(
      ["stat-blood", "move-own-1", "stat-blood"],
      "stat-blood",
      STAT_ADV,
    ),
    2,
  );
});

Deno.test("timesTaken: does not count other advances", () => {
  assertEquals(
    timesTaken(["move-own-1", "move-own-1"], "stat-blood", STAT_ADV),
    0,
  );
});

// ─── regularAdvanceCount ──────────────────────────────────────────────────────

Deno.test("regularAdvanceCount: 0 with no advances", () => {
  assertEquals(regularAdvanceCount([], mockPlaybook([STAT_ADV, MAJOR_ADV])), 0);
});

Deno.test("regularAdvanceCount: counts non-major advances only", () => {
  const pb = mockPlaybook([STAT_ADV, MOVE_ADV, MAJOR_ADV]);
  assertEquals(
    regularAdvanceCount(["stat-blood", "move-own-1", "retire"], pb),
    2,
  );
});

Deno.test("regularAdvanceCount: major advances not counted", () => {
  const pb = mockPlaybook([MAJOR_ADV]);
  assertEquals(regularAdvanceCount(["retire", "retire"], pb), 0);
});

Deno.test("regularAdvanceCount: unknown advance IDs not counted", () => {
  const pb = mockPlaybook([STAT_ADV]);
  assertEquals(regularAdvanceCount(["unknown-id"], pb), 0);
});

// ─── validateAdvance ─────────────────────────────────────────────────────────

Deno.test("validateAdvance: null (valid) when all conditions met", () => {
  const pb = mockPlaybook([MOVE_ADV]);
  assertEquals(validateAdvance(sheet(), "move-own-1", pb), null);
});

Deno.test("validateAdvance: not-enough-xp when xp < 5", () => {
  const pb = mockPlaybook([MOVE_ADV]);
  assertEquals(
    validateAdvance(sheet({ xp: 4 }), "move-own-1", pb),
    "not-enough-xp",
  );
});

Deno.test("validateAdvance: unknown-advance for bad id", () => {
  const pb = mockPlaybook([MOVE_ADV]);
  assertEquals(
    validateAdvance(sheet(), "no-such-advance", pb),
    "unknown-advance",
  );
});

Deno.test("validateAdvance: advance-maxed when maxTimes reached", () => {
  const pb = mockPlaybook([MOVE_ADV]);
  assertEquals(
    validateAdvance(sheet({ takenAdvances: ["move-own-1"] }), "move-own-1", pb),
    "advance-maxed",
  );
});

Deno.test("validateAdvance: advance-maxed for stat advance taken maxTimes", () => {
  const pb = mockPlaybook([STAT_ADV]);
  assertEquals(
    validateAdvance(
      sheet({ takenAdvances: ["stat-blood", "stat-blood"] }),
      "stat-blood",
      pb,
    ),
    "advance-maxed",
  );
});

Deno.test("validateAdvance: repeatable advance can be taken up to maxTimes", () => {
  const pb = mockPlaybook([REPEAT_ADV]);
  // Taken twice, max is 3 — should be valid
  assertEquals(
    validateAdvance(
      sheet({ takenAdvances: ["clear-corruption", "clear-corruption"] }),
      "clear-corruption",
      pb,
    ),
    null,
  );
  // Taken 3 times → maxed
  assertEquals(
    validateAdvance(
      sheet({
        takenAdvances: [
          "clear-corruption",
          "clear-corruption",
          "clear-corruption",
        ],
      }),
      "clear-corruption",
      pb,
    ),
    "advance-maxed",
  );
});

Deno.test("validateAdvance: major-advance-locked when <5 regular advances", () => {
  const pb = mockPlaybook([STAT_ADV, MOVE_ADV, MAJOR_ADV]);
  const s = sheet({ takenAdvances: ["stat-blood", "move-own-1"] }); // only 2 regular
  assertEquals(validateAdvance(s, "retire", pb), "major-advance-locked");
});

Deno.test("validateAdvance: major advance allowed with 5+ regular advances", () => {
  const regularAdvs: IPlaybookAdvance[] = [
    { id: "a1", label: "A1" },
    { id: "a2", label: "A2" },
    { id: "a3", label: "A3" },
    { id: "a4", label: "A4" },
    { id: "a5", label: "A5" },
  ];
  const pb = mockPlaybook([...regularAdvs, MAJOR_ADV]);
  const s = sheet({ takenAdvances: ["a1", "a2", "a3", "a4", "a5"] });
  assertEquals(validateAdvance(s, "retire", pb), null);
});

Deno.test("validateAdvance: stat-at-max when stat already at STAT_MAX", () => {
  const pb = mockPlaybook([STAT_ADV]);
  const s = sheet({ stats: { blood: STAT_MAX, heart: 0, mind: 0, spirit: 0 } });
  assertEquals(validateAdvance(s, "stat-blood", pb), "stat-at-max");
});

Deno.test("validateAdvance: stat advance valid when stat is below max", () => {
  const pb = mockPlaybook([STAT_ADV]);
  const s = sheet({ stats: { blood: 1, heart: 0, mind: 0, spirit: 0 } });
  assertEquals(validateAdvance(s, "stat-blood", pb), null);
});

// ─── applyAdvance ─────────────────────────────────────────────────────────────

Deno.test("applyAdvance: spends 5 XP", () => {
  const { xp } = applyAdvance(sheet({ xp: 5 }), MOVE_ADV);
  assertEquals(xp, 0);
});

Deno.test("applyAdvance: records advance id", () => {
  const { takenAdvances } = applyAdvance(sheet(), MOVE_ADV);
  assertEquals(takenAdvances, ["move-own-1"]);
});

Deno.test("applyAdvance: appends to existing advances", () => {
  const s = sheet({ takenAdvances: ["stat-blood"] });
  const { takenAdvances } = applyAdvance(s, MOVE_ADV);
  assertEquals(takenAdvances, ["stat-blood", "move-own-1"]);
});

Deno.test("applyAdvance: boosts stat when statBoost set", () => {
  const s = sheet({ stats: { blood: 1, heart: 0, mind: -1, spirit: 1 } });
  const { stats } = applyAdvance(s, STAT_ADV);
  assertEquals(stats.blood, 2);
});

Deno.test("applyAdvance: does not mutate original sheet", () => {
  const s = sheet();
  applyAdvance(s, MOVE_ADV);
  assertEquals(s.takenAdvances, []);
  assertEquals(s.xp, 5);
});

Deno.test("applyAdvance: does not touch stats when no statBoost", () => {
  const s = sheet({ stats: { blood: 1, heart: 0, mind: -1, spirit: 1 } });
  const { stats } = applyAdvance(s, MOVE_ADV);
  assertEquals(stats, s.stats);
});

// ─── Constants ────────────────────────────────────────────────────────────────

Deno.test("XP_PER_ADVANCE is 5", () => assertEquals(XP_PER_ADVANCE, 5));
Deno.test("STAT_MAX is 2", () => assertEquals(STAT_MAX, 2));
