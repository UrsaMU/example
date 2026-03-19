import { addCmd } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { findMove, getSheetMoves, resolveMove, extractStat } from "./logic.ts";
import { PLAYBOOKS } from "../playbooks/data.ts";
import type { ICharSheet } from "../playbooks/schema.ts";

// ─── Colour helpers ───────────────────────────────────────────────────────────

const H   = "%ch";
const N   = "%cn";
const G   = "%cg";
const Y   = "%cy";
const R   = "%cr";
const DIM = "%cx";

const OUTCOME_COLOR: Record<string, string> = {
  strong: G,
  weak:   Y,
  miss:   R,
};

function bar(width = 60): string {
  return `${H}${"─".repeat(width)}${N}`;
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Extract the first sentence of a move description as a one-line hint. */
function firstSentence(text: string): string {
  const end = text.search(/[.!?]/);
  return end !== -1 ? text.slice(0, end + 1) : text.slice(0, 100);
}

/** Fetch the current user's sheet; send an error and return null if missing. */
async function mySheet(u: { me: { id: string }; send(m: string): void }): Promise<ICharSheet | null> {
  const sheet = await sheets.queryOne({ id: u.me.id } as Parameters<typeof sheets.queryOne>[0]);
  if (!sheet) {
    u.send(`${H}+move:${N}  No character sheet found. You need an approved character to use moves.`);
    return null;
  }
  return sheet as ICharSheet;
}

// ─── +moves ───────────────────────────────────────────────────────────────────
//
//  List all moves on your character sheet (from chargen + advancement).

addCmd({
  name: "+moves",
  category: "Urban Shadows",
  help: "+moves  —  List the moves on your character sheet.",
  pattern: /^\+moves$/i,
  exec: async (u) => {
    const sheet = await mySheet(u);
    if (!sheet) return;

    const moves = getSheetMoves(sheet);
    if (!moves.length) {
      u.send(`${H}+moves:${N}  No moves on your sheet yet.`);
      return;
    }

    const lines = [
      bar(),
      `  ${H}Your Moves${N}  — ${H}+move <name>${N} to trigger  ${DIM}|${N}  ${H}+move/ref <name>${N} to read`,
      bar(),
    ];

    for (const m of moves) {
      const stat = extractStat(m.description);
      const tag = stat ? `${DIM}[${stat}]${N}` : `${DIM}[passive]${N}`;
      lines.push(`  ${H}${m.name}${N}  ${tag}  ${DIM}${m.id}${N}`);
      lines.push(`  ${DIM}${firstSentence(m.description)}${N}`);
    }

    lines.push(bar());
    lines.push(`  ${DIM}+moves/all [playbook]  to browse all moves  |  help moves  for help${N}`);
    lines.push(bar());
    u.send(lines.join("\n"));
  },
});

// ─── +moves/all [playbook] ────────────────────────────────────────────────────
//
//  Without argument: lists all playbooks.
//  With playbook name or ID: shows every move for that playbook with full text.

addCmd({
  name: "+moves/all",
  category: "Urban Shadows",
  help: "+moves/all [<playbook>]  —  Browse all moves, optionally filtered to one playbook.",
  pattern: /^\+moves\/all(?:\s+(.+))?$/i,
  exec: (u) => {
    const query = ((u.cmd.args[0] ?? "") as string).trim().toLowerCase();

    // No argument — list all playbooks
    if (!query) {
      const lines = [
        bar(),
        `  ${H}All Playbooks${N}  — use ${H}+moves/all <playbook>${N} to see its moves`,
        bar(),
      ];
      for (const pb of PLAYBOOKS) {
        lines.push(`  ${H}${pb.name}${N}  ${DIM}${pb.id}${N}`);
        lines.push(`  ${DIM}${pb.tagline}${N}`);
      }
      lines.push(bar());
      u.send(lines.join("\n"));
      return;
    }

    // Find matching playbook by ID or partial name
    const pb =
      PLAYBOOKS.find((p) => p.id === query) ??
      PLAYBOOKS.find((p) => p.name.toLowerCase().includes(query));

    if (!pb) {
      u.send(
        `${H}+moves/all:${N}  No playbook found matching '${query}'. ` +
        `Type ${H}+moves/all${N} to list all playbooks.`
      );
      return;
    }

    const lines = [
      bar(),
      `  ${H}${pb.name}${N}  — all moves`,
      bar(),
    ];

    for (const m of pb.moves) {
      const stat = extractStat(m.description);
      const tag = stat ? `${DIM}[rolls ${stat}]${N}` : `${DIM}[passive]${N}`;
      lines.push(`  ${H}${m.name}${N}  ${tag}  ${DIM}${m.id}${N}`);
      lines.push(`  ${m.description}`);
      lines.push("");
    }

    lines.push(bar());
    u.send(lines.join("\n"));
  },
});

// ─── +move/ref <name-or-id> ───────────────────────────────────────────────────
//
//  Read a move's full text without triggering a roll. No sheet required.

addCmd({
  name: "+move/ref",
  category: "Urban Shadows",
  help: "+move/ref <name or id>  —  Read a move's full text (no roll).",
  pattern: /^\+move\/ref\s+(.+)$/i,
  exec: (u) => {
    const query = (u.cmd.args[0] ?? "").trim();
    const move = findMove(query);

    if (!move) {
      u.send(`${H}+move/ref:${N}  No move found matching '${query}'. Try a partial name or the move ID.`);
      return;
    }

    const stat = extractStat(move.description);
    const statLabel = stat
      ? `rolls ${H}${stat}${N}`
      : `${DIM}passive — no roll${N}`;

    u.send([
      bar(),
      `  ${H}${move.name}${N}  ${DIM}(${move.playbookName})${N}  — ${statLabel}`,
      `  ${DIM}${move.id}${N}`,
      bar(),
      `  ${move.description}`,
      bar(),
    ].join("\n"));
  },
});

// ─── +move <name-or-id> ───────────────────────────────────────────────────────
//
//  Trigger a move:
//    - Looks up the move by partial name or exact ID across all playbooks.
//    - If the move has a "roll with X" trigger: reads stat from sheet, rolls 2d6+stat,
//      displays full move text + outcome, and broadcasts to the room.
//    - If the move is passive: displays the move text and broadcasts invocation.
//
//  The sheet stat defaults to 0 if no sheet is found (allows staff test rolls).

addCmd({
  name: "+move",
  category: "Urban Shadows",
  help: "+move <name or id>[+/-<bonus>]  —  Trigger a move and roll its stat. See +moves for your list.",
  pattern: /^\+move\s+(.+?)(?:\s+([+-]\s*\d+))?$/i,
  exec: async (u) => {
    const query    = (u.cmd.args[0] ?? "").trim();
    const bonusStr = ((u.cmd.args[1] ?? "") as string).replace(/\s/g, "");
    const bonus    = bonusStr ? parseInt(bonusStr, 10) : 0;

    const move = findMove(query);
    if (!move) {
      u.send(
        `${H}+move:${N}  No move found matching '${query}'. ` +
        `Use ${H}+moves${N} to see your moves or ${H}+move/ref <name>${N} to search all.`
      );
      return;
    }

    const stat = extractStat(move.description);

    // ── Passive move ──────────────────────────────────────────────────────────
    if (!stat) {
      u.send([
        bar(),
        `  ${H}${move.name}${N}  ${DIM}(${move.playbookName})${N}  — ${DIM}passive (no roll)${N}`,
        bar(),
        `  ${move.description}`,
        bar(),
      ].join("\n"));

      u.here.broadcast(
        `${H}${u.me.name ?? u.me.id}${N} invokes ${H}${move.name}${N}  ${DIM}[passive]${N}`,
        { origin: u.me.id },
      );
      return;
    }

    // ── Rolling move ──────────────────────────────────────────────────────────

    // Read stat from sheet; default 0 if no sheet (staff/test use)
    const sheet = await sheets.queryOne({ id: u.me.id } as Parameters<typeof sheets.queryOne>[0]);
    const statValue: number = sheet ? ((sheet as ICharSheet).stats[stat] ?? 0) : 0;

    const result = resolveMove(move, statValue, bonus);
    if (!result.roll) return; // impossible branch (stat is non-null)

    const { roll } = result;
    const col          = OUTCOME_COLOR[roll.outcome];
    const outcomeLabel = `${col}${H}${roll.outcomeLabel} — ${roll.outcome.charAt(0).toUpperCase() + roll.outcome.slice(1)} Hit${N}`;
    const bonusDisplay = bonus !== 0 ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : "";

    u.send([
      bar(),
      `  ${H}${move.name}${N}  ${DIM}(${move.playbookName})${N}  — rolls ${H}${stat}${N}`,
      `  [${roll.dice[0]}][${roll.dice[1]}] ${sign(roll.stat)}${bonusDisplay} = ${H}${roll.total}${N}  ->  ${outcomeLabel}`,
      bar(),
      `  ${move.description}`,
      bar(),
    ].join("\n"));

    u.here.broadcast(
      `${H}${u.me.name ?? u.me.id}${N} triggers ${H}${move.name}${N}: ` +
      `[${roll.dice[0]}][${roll.dice[1]}] ${sign(roll.stat)}${bonusDisplay} = ` +
      `${col}${H}${roll.total} (${roll.outcomeLabel})${N}`,
      { origin: u.me.id },
    );
  },
});
