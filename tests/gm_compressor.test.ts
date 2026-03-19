import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  formatCharactersOneLiner,
  formatCriticalMemories,
  formatFronts,
  formatLore,
  formatMemories,
  formatOpenJobs,
  formatRecentExchanges,
  formatReveals,
} from "../src/plugins/gm/context/compressor.ts";
import type { IFront } from "../src/plugins/fronts/schema.ts";
import type {
  IGMExchange,
  IGMMemory,
  IGMReveal,
} from "../src/plugins/gm/schema.ts";

// ─── formatCharactersOneLiner ─────────────────────────────────────────────────

Deno.test("formatCharactersOneLiner: returns 'None.' for empty list", () => {
  assertEquals(formatCharactersOneLiner([]), "None.");
});

Deno.test("formatCharactersOneLiner: formats name and playbook", () => {
  const output = formatCharactersOneLiner([
    {
      id: "s1",
      playerId: "p1",
      name: "Vex",
      playbookId: "vamp",
      status: "approved",
      look: "",
      demeanor: "",
      stats: { blood: 2, heart: 0, mind: 0, spirit: 0 },
      harm: { boxes: [false, false, false, false, false], armor: 0 },
      corruption: { marks: 1, advances: [] },
      circleRatings: { mortalis: 0, night: 0, power: 0, wild: 0 },
      circleStatus: { mortalis: 0, night: 0, power: 0, wild: 0 },
      debts: [],
      selectedMoves: [],
      xp: 0,
      gear: [],
      features: {},
      introAnswers: {},
      notes: "",
      takenAdvances: [],
      createdAt: 0,
      updatedAt: 0,
    } as import("../src/plugins/playbooks/schema.ts").ICharSheet,
  ]);
  assertStringIncludes(output, "Vex");
  assertStringIncludes(output, "vamp");
});

// ─── formatFronts ─────────────────────────────────────────────────────────────

function makeFront(overrides: Partial<IFront> = {}): IFront {
  return {
    id: "f1",
    name: "The Spire Rises",
    description: "A vampire faction ascending.",
    clockSize: 6,
    clockTicks: 3,
    grimPortents: [],
    status: "active",
    createdBy: "staff",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

Deno.test("formatFronts: returns 'None active.' for empty list", () => {
  assertEquals(formatFronts([]), "None active.");
});

Deno.test("formatFronts: includes front name and clock", () => {
  const output = formatFronts([makeFront()]);
  assertStringIncludes(output, "The Spire Rises");
  assertStringIncludes(output, "3/6");
});

Deno.test("formatFronts: includes triggered portent marker", () => {
  const front = makeFront({
    grimPortents: [
      {
        id: "gp1",
        text: "Blood feast announced.",
        triggered: true,
        triggeredAt: 0,
      },
    ],
  });
  const output = formatFronts([front]);
  assertStringIncludes(output, "[*]");
});

Deno.test("formatFronts: includes untriggered portent marker", () => {
  const front = makeFront({
    grimPortents: [
      { id: "gp2", text: "Bodies found drained.", triggered: false },
    ],
  });
  const output = formatFronts([front]);
  assertStringIncludes(output, "[ ]");
});

// ─── formatMemories ───────────────────────────────────────────────────────────

function makeMemory(overrides: Partial<IGMMemory> = {}): IGMMemory {
  return {
    id: "m1",
    type: "plot",
    priority: "normal",
    body: "Test memory body",
    tags: ["test"],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

Deno.test("formatMemories: returns 'None.' for empty list", () => {
  assertEquals(formatMemories([]), "None.");
});

Deno.test("formatMemories: includes memory body", () => {
  const output = formatMemories([makeMemory()]);
  assertStringIncludes(output, "Test memory body");
});

Deno.test("formatMemories: permanent memories marked", () => {
  const output = formatMemories([makeMemory({ priority: "permanent" })]);
  assertStringIncludes(output, "[PERMANENT]");
});

Deno.test("formatMemories: normal memories include type tag", () => {
  const output = formatMemories([
    makeMemory({ priority: "normal", type: "consequence" }),
  ]);
  assertStringIncludes(output, "[consequence]");
});

// ─── formatCriticalMemories ───────────────────────────────────────────────────

Deno.test("formatCriticalMemories: returns '' for no permanent memories", () => {
  const output = formatCriticalMemories([makeMemory({ priority: "normal" })]);
  assertEquals(output, "");
});

Deno.test("formatCriticalMemories: returns bullet list of permanent memories", () => {
  const output = formatCriticalMemories([
    makeMemory({ priority: "permanent", body: "Key fact." }),
  ]);
  assertStringIncludes(output, "- Key fact.");
});

// ─── formatReveals ────────────────────────────────────────────────────────────

function makeReveal(overrides: Partial<IGMReveal> = {}): IGMReveal {
  return {
    id: "r1",
    title: "The Double Agent",
    secret: "Vex is working for the Spire.",
    triggerCondition: "when players investigate the warehouse",
    fired: false,
    createdBy: "staff",
    createdAt: 0,
    ...overrides,
  };
}

Deno.test("formatReveals: returns 'None pending.' for empty list", () => {
  assertEquals(formatReveals([]), "None pending.");
});

Deno.test("formatReveals: includes title and secret", () => {
  const output = formatReveals([makeReveal()]);
  assertStringIncludes(output, "The Double Agent");
  assertStringIncludes(output, "Vex is working for the Spire.");
});

Deno.test("formatReveals: includes trigger condition", () => {
  const output = formatReveals([makeReveal()]);
  assertStringIncludes(output, "warehouse");
});

// ─── formatLore ───────────────────────────────────────────────────────────────

Deno.test("formatLore: returns 'None.' for empty list", () => {
  assertEquals(formatLore([]), "None.");
});

Deno.test("formatLore: includes page title for small list", () => {
  const output = formatLore([{
    path: "lore/factions/spire",
    title: "The Spire",
    body: "A vampire court.",
  }]);
  assertStringIncludes(output, "The Spire");
});

// ─── formatOpenJobs ───────────────────────────────────────────────────────────

Deno.test("formatOpenJobs: returns 'None.' for empty list", () => {
  assertEquals(formatOpenJobs([]), "None.");
});

// ─── formatRecentExchanges ────────────────────────────────────────────────────

function makeExchange(overrides: Partial<IGMExchange> = {}): IGMExchange {
  return {
    id: "e1",
    type: "pose",
    roomId: "room-1",
    playerId: "p1",
    playerName: "Alice",
    input: "Alice steps forward.",
    output: "The city responds in kind.",
    toolsUsed: [],
    timestamp: 0,
    ...overrides,
  };
}

Deno.test("formatRecentExchanges: returns 'None.' for empty list", () => {
  assertEquals(formatRecentExchanges([]), "None.");
});

Deno.test("formatRecentExchanges: includes player name and input", () => {
  const output = formatRecentExchanges([makeExchange()]);
  assertStringIncludes(output, "Alice");
  assertStringIncludes(output, "Alice steps forward.");
});

Deno.test("formatRecentExchanges: includes truncated output", () => {
  const output = formatRecentExchanges([makeExchange()]);
  assertStringIncludes(output, "The city responds");
});
