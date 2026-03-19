import type { ICharSheet } from "../../playbooks/schema.ts";
import type { INPC } from "../../npcs/schema.ts";
import type { IOrg } from "../../orgs/schema.ts";
import type { IFront } from "../../fronts/schema.ts";
import type { IGMExchange, IGMMemory, IGMReveal } from "../schema.ts";
import type { ILorePage } from "./loader.ts";
import { clockBar } from "../../fronts/logic.ts";
import type { IJob } from "ursamu/jobs";
import type { IDowntimeAction } from "../../downtime/schema.ts";
import { markedHarmCount } from "../../tracker/logic.ts";

// ─── Size thresholds (characters) ────────────────────────────────────────────

const THRESHOLDS = {
  loreFullText: 60, // max lore pages to include with full body
  npcOneLiner: 80, // above this many NPCs, use one-liners only
  exchangeVerbatim: 15, // keep last N exchanges verbatim
  memoryFull: 40, // above this many memories, summarize older ones
} as const;

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCharactersFull(
  chars: ICharSheet[],
  inRoomIds: string[],
): string {
  if (!chars.length) return "None.";
  return chars
    .filter((c) => inRoomIds.includes(c.playerId))
    .map((c) => {
      const harmCount = markedHarmCount(c.harm);
      const corrupt = c.corruption.marks;
      const debts = c.debts.length
        ? c.debts.map((d) =>
          d.direction === "owed" ? `${d.to} owes them` : `owes ${d.to}`
        ).join(", ")
        : "none";
      return [
        `${c.name} (${c.playbookId})`,
        `  Stats: blood ${c.stats.blood}  heart ${c.stats.heart}  mind ${c.stats.mind}  spirit ${c.stats.spirit}`,
        `  Harm: ${harmCount}/5  Armor: ${c.harm.armor}  Corruption: ${corrupt}/5`,
        `  Circles: mortalis ${c.circleStatus.mortalis}  night ${c.circleStatus.night}  power ${c.circleStatus.power}  wild ${c.circleStatus.wild}`,
        `  Debts: ${debts}`,
        `  Moves: ${c.selectedMoves.join(", ") || "none"}`,
        `  XP: ${c.xp}/5`,
      ].join("\n");
    })
    .join("\n\n");
}

export function formatCharactersOneLiner(chars: ICharSheet[]): string {
  if (!chars.length) return "None.";
  return chars
    .map((c) => {
      const harmCount = markedHarmCount(c.harm);
      return `${c.name} (${c.playbookId}) — harm ${harmCount}/5  corruption ${c.corruption.marks}/5`;
    })
    .join("\n");
}

export function formatNpcs(npcs: INPC[]): string {
  if (!npcs.length) return "None.";
  const useFull = npcs.length <= THRESHOLDS.npcOneLiner;
  return npcs
    .map((n) => {
      const harmCount = markedHarmCount(n.harm);
      if (useFull) {
        return `${n.name}${
          n.circle ? ` [${n.circle}]` : ""
        } — harm ${harmCount}/5` +
          (n.notes ? `\n  Notes: ${n.notes}` : "");
      }
      return `${n.name}${
        n.circle ? ` [${n.circle}]` : ""
      } — harm ${harmCount}/5${n.notes ? ` (${n.notes.slice(0, 60)}...)` : ""}`;
    })
    .join("\n");
}

export function formatOrgs(orgs: IOrg[]): string {
  if (!orgs.length) return "None.";
  return orgs
    .map((o) => {
      const desc = o.description ? `\n  ${o.description.slice(0, 120)}` : "";
      const notes = o.notes
        ? `\n  [Staff notes: ${o.notes.slice(0, 120)}]`
        : "";
      return `${o.name} [${o.circle}]${
        o.isPublic ? "" : " (hidden)"
      }${desc}${notes}`;
    })
    .join("\n");
}

export function formatFronts(fronts: IFront[]): string {
  if (!fronts.length) return "None active.";
  return fronts
    .map((f) => {
      const bar = clockBar(f.clockTicks, f.clockSize);
      const portents = f.grimPortents
        .map((p) => `  ${p.triggered ? "[*]" : "[ ]"} ${p.text}`)
        .join("\n");
      return [
        `${f.name} — ${bar}`,
        f.description ? `  ${f.description}` : "",
        portents,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

export function formatMemories(memories: IGMMemory[]): string {
  if (!memories.length) return "None.";
  const permanent = memories.filter((m) => m.priority === "permanent");
  const normal = memories.filter((m) => m.priority === "normal");

  const parts: string[] = [];
  for (const m of permanent) {
    parts.push(
      `[PERMANENT] ${m.body}${
        m.resurface !== undefined ? ` [resurface: session ${m.resurface}]` : ""
      }`,
    );
  }

  const normalToShow = normal.slice(-THRESHOLDS.memoryFull);
  for (const m of normalToShow) {
    parts.push(
      `[${m.type}] ${m.body}${
        m.resurface !== undefined ? ` [resurface: session ${m.resurface}]` : ""
      }`,
    );
  }
  if (normal.length > THRESHOLDS.memoryFull) {
    parts.unshift(
      `(${
        normal.length - THRESHOLDS.memoryFull
      } older memories omitted -- use search_session_history tool for details)`,
    );
  }
  return parts.join("\n");
}

export function formatCriticalMemories(memories: IGMMemory[]): string {
  const crit = memories.filter((m) => m.priority === "permanent");
  if (!crit.length) return "";
  return crit.map((m) => `- ${m.body}`).join("\n");
}

export function formatReveals(reveals: IGMReveal[]): string {
  if (!reveals.length) return "None pending.";
  return reveals
    .map((r) => `"${r.title}": ${r.secret}\n  Trigger: ${r.triggerCondition}`)
    .join("\n\n");
}

export function formatLore(pages: ILorePage[]): string {
  if (!pages.length) return "None.";
  if (pages.length <= THRESHOLDS.loreFullText) {
    return pages
      .map((p) =>
        `[${p.path}] ${p.title}${p.body ? `\n  ${p.body.slice(0, 200)}` : ""}`
      )
      .join("\n");
  }
  // Too many pages: title + first line only
  return pages
    .map((p) => `[${p.path}] ${p.title}`)
    .join("\n") +
    `\n(${pages.length} total lore entries -- use get_wiki_page tool for full text)`;
}

export function formatOpenJobs(openJobs: IJob[]): string {
  if (!openJobs.length) return "None.";
  return openJobs
    .map((j) =>
      `#${j.number} [${j.status}] ${j.title} (${j.submitterName ?? "unknown"})`
    )
    .join("\n");
}

export function formatOpenDowntime(actions: IDowntimeAction[]): string {
  if (!actions.length) return "None.";
  return actions
    .map((a) => `${a.playerName}: [${a.type}] ${a.description}`)
    .join("\n");
}

export function formatRecentExchanges(exchanges: IGMExchange[]): string {
  if (!exchanges.length) return "None.";
  const recent = exchanges.slice(-THRESHOLDS.exchangeVerbatim);
  return recent
    .map((e) => {
      const who = e.playerName ? `${e.playerName}: ` : "";
      return `[${e.type}] ${who}${e.input}\n  -> ${e.output.slice(0, 300)}`;
    })
    .join("\n\n");
}
