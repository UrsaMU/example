import { addCmd } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { rollDice, STAT_NAMES } from "./logic.ts";
import type { StatName } from "./logic.ts";

function isStaff(u: { me: { flags: Set<string> } }): boolean {
  return u.me.flags.has("admin") || u.me.flags.has("wizard") ||
    u.me.flags.has("superuser");
}

function formatRoll(
  result: ReturnType<typeof rollDice>,
  statDisplay: string,
  bonusDisplay: string,
  colors: Record<string, string>,
): string {
  const col = colors[result.outcome];
  const label = `${col}%ch${result.outcomeLabel} — ${
    result.outcome.charAt(0).toUpperCase() + result.outcome.slice(1)
  } Hit%cn`;
  return `[${result.dice[0]}][${
    result.dice[1]
  }] ${statDisplay}${bonusDisplay} = %ch${result.total}%cn  ->  ${label}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OUTCOME_COLOR: Record<string, string> = {
  strong: "%cg", // green — 10+
  weak: "%cy", // yellow — 7-9
  miss: "%cr", // red — 6-
};

// ─── +roll <stat>[+/-<bonus>] ─────────────────────────────────────────────────
//
//  Examples:
//    +roll blood
//    +roll heart +1
//    +roll mind-1

addCmd({
  name: "+roll",
  category: "Urban Shadows",
  help:
    "+roll <stat>[+/-<bonus>]  —  Roll 2d6 + a stat. Stats: blood heart mind spirit",
  pattern: /^\+roll\s+(\w+)\s*([+-]\s*\d+)?$/i,
  exec: async (u) => {
    const statName = (u.cmd.args[0] ?? "").toLowerCase().trim() as StatName;

    if (!STAT_NAMES.includes(statName)) {
      u.send(
        `%ch+roll:%cn  Unknown stat '${statName}'. Use: ${
          STAT_NAMES.join(", ")
        }`,
      );
      return;
    }

    // Parse optional bonus like "+1" or "-2"
    const bonusStr = (u.cmd.args[1] ?? "").replace(/\s/g, "");
    const bonus = bonusStr ? parseInt(bonusStr, 10) : 0;

    const sheet = await sheets.queryOne(
      { id: u.me.id } as Parameters<typeof sheets.queryOne>[0],
    );
    const statValue: number = sheet ? (sheet.stats[statName] ?? 0) : 0;

    const result = rollDice(statValue, bonus);

    const bonusDisplay = bonus !== 0 ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : "";
    const statDisplay = statValue >= 0 ? `+${statValue}` : `${statValue}`;

    u.send(
      `%ch+roll ${statName}%cn  ` +
        formatRoll(result, statDisplay, bonusDisplay, OUTCOME_COLOR),
    );

    // Broadcast to room so others see the roll
    const col = OUTCOME_COLOR[result.outcome];
    u.here.broadcast(
      `%ch${u.me.name ?? u.me.id}%cn rolls %ch+${statName}%cn: [${
        result.dice[0]
      }][${
        result.dice[1]
      }] = ${col}%ch${result.total} (${result.outcomeLabel})%cn`,
      { origin: u.me.id },
    );
  },
});

// ─── +roll/free <stat>=<value> [bonus] ────────────────────────────────────────
//  Roll 2d6 with an explicit stat value (no sheet required).
//  Anyone can use this for off-sheet or freeform situations.

addCmd({
  name: "+roll/free",
  category: "Urban Shadows",
  help:
    "+roll/free <stat>=<value> [+/-bonus]  —  Roll 2d6 with an explicit stat value.",
  pattern: /^\+roll\/free\s+(\w+)=([+-]?\d+)(?:\s*([+-]\s*\d+))?$/i,
  exec: (u) => {
    const statName = (u.cmd.args[0] ?? "").toLowerCase().trim() as StatName;
    const statValue = parseInt((u.cmd.args[1] ?? "0").replace(/\s/g, ""), 10);
    const bonusStr = (u.cmd.args[2] ?? "").replace(/\s/g, "");
    const bonus = bonusStr ? parseInt(bonusStr, 10) : 0;

    if (!STAT_NAMES.includes(statName)) {
      u.send(
        `%ch+roll/free:%cn  Unknown stat '${statName}'. Use: ${
          STAT_NAMES.join(", ")
        }`,
      );
      return;
    }

    const result = rollDice(statValue, bonus);
    const col = OUTCOME_COLOR[result.outcome];
    const statDisplay = statValue >= 0 ? `+${statValue}` : `${statValue}`;
    const bonusDisplay = bonus !== 0 ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : "";

    u.send(
      `%ch+roll/free ${statName}%cn (${statDisplay})  ` +
        formatRoll(result, statDisplay, bonusDisplay, OUTCOME_COLOR),
    );
    u.here.broadcast(
      `%ch${
        u.me.name ?? u.me.id
      }%cn rolls %ch${statName}%cn (${statDisplay}): ` +
        `[${result.dice[0]}][${
          result.dice[1]
        }] = ${col}%ch${result.total} (${result.outcomeLabel})%cn`,
      { origin: u.me.id },
    );
  },
});

// ─── +roll/npc <name> <stat>=<value> [bonus] ──────────────────────────────────
//  [Staff] Roll 2d6 on behalf of a named NPC with an explicit stat value.
//  Broadcasts to the room under the NPC's name.

addCmd({
  name: "+roll/npc",
  category: "Urban Shadows",
  help:
    "+roll/npc <name> <stat>=<value> [+/-bonus]  —  [Staff] Roll for a named NPC.",
  pattern: /^\+roll\/npc\s+(.+?)\s+(\w+)=([+-]?\d+)(?:\s*([+-]\s*\d+))?$/i,
  exec: (u) => {
    if (!isStaff(u)) {
      u.send("%ch+roll/npc:%cn  Staff only.");
      return;
    }

    const npcName = (u.cmd.args[0] ?? "").trim();
    const statName = (u.cmd.args[1] ?? "").toLowerCase().trim() as StatName;
    const statValue = parseInt((u.cmd.args[2] ?? "0").replace(/\s/g, ""), 10);
    const bonusStr = (u.cmd.args[3] ?? "").replace(/\s/g, "");
    const bonus = bonusStr ? parseInt(bonusStr, 10) : 0;

    if (!STAT_NAMES.includes(statName)) {
      u.send(
        `%ch+roll/npc:%cn  Unknown stat '${statName}'. Use: ${
          STAT_NAMES.join(", ")
        }`,
      );
      return;
    }

    const result = rollDice(statValue, bonus);
    const col = OUTCOME_COLOR[result.outcome];
    const statDisplay = statValue >= 0 ? `+${statValue}` : `${statValue}`;
    const bonusDisplay = bonus !== 0 ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : "";

    u.send(
      `%ch+roll/npc [${npcName}]%cn  ${statName} (${statDisplay})  ` +
        formatRoll(result, statDisplay, bonusDisplay, OUTCOME_COLOR),
    );
    u.here.broadcast(
      `%ch[NPC: ${npcName}]%cn rolls %ch${statName}%cn (${statDisplay}): ` +
        `[${result.dice[0]}][${
          result.dice[1]
        }] = ${col}%ch${result.total} (${result.outcomeLabel})%cn`,
      { origin: u.me.id },
    );
  },
});
