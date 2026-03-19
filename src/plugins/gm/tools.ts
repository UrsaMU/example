import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { sheets } from "../playbooks/db.ts";
import { npcs } from "../npcs/db.ts";
import { orgs } from "../orgs/db.ts";
import { fronts } from "../fronts/db.ts";
import { scenes } from "../scene/db.ts";
import { actions as downtimeActions } from "../downtime/db.ts";
import { jobs } from "ursamu/jobs";
import { gmExchanges, gmMemory } from "./db.ts";
import { tickClock } from "../fronts/logic.ts";
import type { ICharSheet } from "../playbooks/schema.ts";
import type { INPC } from "../npcs/schema.ts";
import type { IFront } from "../fronts/schema.ts";
import type { IOrg } from "../orgs/schema.ts";
import type { IGMMemory } from "./schema.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notFound(entity: string, name: string): string {
  return `[${entity} not found: "${name}"]`;
}

function jsonOut(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

// ─── Character ───────────────────────────────────────────────────────────────

export const get_character = new DynamicStructuredTool({
  name: "get_character",
  description: "Retrieve a player character sheet by name or playerId. " +
    "Returns stats, harm, corruption, circles, debts, selected moves, and gear.",
  schema: z.object({
    query: z.string().describe("Character name or playerId to look up"),
  }),
  func: async ({ query }) => {
    const all = (await sheets.all()) as ICharSheet[];
    const q = query.toLowerCase();
    const match = all.find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.playerId.toLowerCase() === q,
    );
    if (!match) return notFound("character", query);
    return jsonOut(match);
  },
});

// ─── NPC ─────────────────────────────────────────────────────────────────────

export const get_npc = new DynamicStructuredTool({
  name: "get_npc",
  description: "Look up an NPC by name. Returns their circle, harm, and notes.",
  schema: z.object({
    name: z.string().describe("NPC name (partial match accepted)"),
  }),
  func: async ({ name }) => {
    const all = (await npcs.all()) as INPC[];
    const q = name.toLowerCase();
    const match = all.find((n) => n.name.toLowerCase().includes(q));
    if (!match) return notFound("NPC", name);
    return jsonOut(match);
  },
});

// ─── Scene ───────────────────────────────────────────────────────────────────

export const get_scene = new DynamicStructuredTool({
  name: "get_scene",
  description: "Fetch the current scene description for a room.",
  schema: z.object({
    roomId: z.string().describe("Room dbobj id"),
  }),
  func: async ({ roomId }) => {
    const scene = await (scenes.queryOne({ id: roomId }) as Promise<unknown>);
    if (!scene) return `[No scene set for room "${roomId}"]`;
    return jsonOut(scene);
  },
});

export const set_scene_description = new DynamicStructuredTool({
  name: "set_scene_description",
  description: "Update or create the scene description for a room. " +
    "Use this to narrate location changes or scene transitions.",
  schema: z.object({
    roomId: z.string().describe("Room dbobj id"),
    title: z.string().describe("Short scene title (one line)"),
    description: z.string().describe(
      "Full narrative scene description (ASCII only)",
    ),
  }),
  func: async ({ roomId, title, description }) => {
    const existing =
      await (scenes.queryOne({ id: roomId }) as Promise<unknown>);
    const now = Date.now();
    if (existing) {
      await scenes.modify(
        { id: roomId } as Parameters<typeof scenes.modify>[0],
        "$set",
        { title, description, updatedAt: now } as unknown as Parameters<
          typeof scenes.modify
        >[2],
      );
    } else {
      await scenes.create(
        {
          id: roomId,
          title,
          description,
          setBy: "gm-agent",
          setByName: "GM",
          setAt: now,
        } as Parameters<typeof scenes.create>[0],
      );
    }
    return `Scene updated for room ${roomId}.`;
  },
});

// ─── Front ───────────────────────────────────────────────────────────────────

export const get_front = new DynamicStructuredTool({
  name: "get_front",
  description: "Retrieve an active threat front by name.",
  schema: z.object({
    name: z.string().describe("Front name (partial match accepted)"),
  }),
  func: async ({ name }) => {
    const all = (await fronts.all()) as IFront[];
    const q = name.toLowerCase();
    const match = all.find((f) => f.name.toLowerCase().includes(q));
    if (!match) return notFound("front", name);
    return jsonOut(match);
  },
});

export const tick_front_clock = new DynamicStructuredTool({
  name: "tick_front_clock",
  description: "Advance a threat front's doom clock by N ticks. " +
    "Use after hard moves or significant consequences. " +
    "Returns updated tick count and whether doom has been reached.",
  schema: z.object({
    name: z.string().describe("Front name (partial match accepted)"),
    ticks: z.number().int().min(1).max(4).describe(
      "Number of ticks to advance (1-4)",
    ),
  }),
  func: async ({ name, ticks }) => {
    const all = (await fronts.all()) as IFront[];
    const q = name.toLowerCase();
    const front = all.find((f) => f.name.toLowerCase().includes(q));
    if (!front) return notFound("front", name);

    const newTicks = tickClock(front.clockTicks, ticks, front.clockSize);
    await fronts.modify(
      { id: front.id } as Parameters<typeof fronts.modify>[0],
      "$set",
      { clockTicks: newTicks, updatedAt: Date.now() },
    );

    const doom = newTicks >= front.clockSize;
    return `Front "${front.name}" clock: ${newTicks}/${front.clockSize}${
      doom ? " -- DOOM REACHED" : ""
    }.`;
  },
});

// ─── Org ─────────────────────────────────────────────────────────────────────

export const get_org = new DynamicStructuredTool({
  name: "get_org",
  description: "Look up an organization (faction/circle) by name.",
  schema: z.object({
    name: z.string().describe("Organization name (partial match accepted)"),
  }),
  func: async ({ name }) => {
    const all = (await orgs.all()) as IOrg[];
    const q = name.toLowerCase();
    const match = all.find((o) => o.name.toLowerCase().includes(q));
    if (!match) return notFound("org", name);
    return jsonOut(match);
  },
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const get_active_jobs = new DynamicStructuredTool({
  name: "get_active_jobs",
  description: "List all open or new jobs awaiting staff review.",
  schema: z.object({}),
  func: async () => {
    const all = await (jobs.all() as Promise<unknown[]>);
    const open = (all as Array<{ status: string }>).filter(
      (j) => j.status === "new" || j.status === "open",
    );
    if (!open.length) return "No active jobs.";
    return jsonOut(open);
  },
});

export const create_job = new DynamicStructuredTool({
  name: "create_job",
  description:
    "File a new job (staff request) for a decision that requires human approval. " +
    "Use for: lore reveals needing staff sign-off, consequence flags, rule clarifications, " +
    "player behavior concerns, or world-changing events.",
  schema: z.object({
    title: z.string().describe("Short descriptive title for the job"),
    body: z.string().describe(
      "Full description of what needs staff attention (ASCII only)",
    ),
    category: z
      .enum(["lore", "consequence", "player", "rules", "world-event", "other"])
      .describe("Job category"),
  }),
  func: async ({ title, body, category }) => {
    const job = await (jobs.create(
      {
        title: `[GM] ${title}`,
        body: `[Category: ${category}]\n\n${body}`,
        submitterId: "gm-agent",
        submitterName: "GM Agent",
        status: "new",
        createdAt: Date.now(),
      } as unknown as Parameters<typeof jobs.create>[0],
    ) as Promise<{ number?: number; id?: string }>);
    return `Job filed: #${
      (job as { number?: number; id?: string }).number ??
        (job as { id?: string }).id
    } -- "${title}"`;
  },
});

export const approve_job = new DynamicStructuredTool({
  name: "approve_job",
  description:
    "Mark a job as approved (resolved). Used when GM agent has completed a requested action.",
  schema: z.object({
    jobId: z.string().describe("Job id or number"),
    resolution: z.string().describe("Summary of what was done"),
  }),
  func: async ({ jobId, resolution }) => {
    await jobs.modify(
      { id: jobId } as Parameters<typeof jobs.modify>[0],
      "$set",
      {
        status: "resolved",
        resolution,
        resolvedAt: Date.now(),
      } as unknown as Parameters<typeof jobs.modify>[2],
    );
    return `Job ${jobId} resolved: ${resolution}`;
  },
});

export const reject_job = new DynamicStructuredTool({
  name: "reject_job",
  description:
    "Mark a job as rejected (closed without action). Provide reason.",
  schema: z.object({
    jobId: z.string().describe("Job id or number"),
    reason: z.string().describe("Why this job is being closed without action"),
  }),
  func: async ({ jobId, reason }) => {
    await jobs.modify(
      { id: jobId } as Parameters<typeof jobs.modify>[0],
      "$set",
      {
        status: "closed",
        resolution: reason,
        resolvedAt: Date.now(),
      } as unknown as Parameters<typeof jobs.modify>[2],
    );
    return `Job ${jobId} closed: ${reason}`;
  },
});

// ─── Downtime ─────────────────────────────────────────────────────────────────

export const get_open_downtime = new DynamicStructuredTool({
  name: "get_open_downtime",
  description: "List all unresolved downtime actions from players.",
  schema: z.object({}),
  func: async () => {
    const all = await (downtimeActions.all() as Promise<unknown[]>);
    const open = (all as Array<{ resolved: boolean }>).filter((a) =>
      !a.resolved
    );
    if (!open.length) return "No open downtime actions.";
    return jsonOut(open);
  },
});

export const resolve_downtime_action = new DynamicStructuredTool({
  name: "resolve_downtime_action",
  description: "Mark a downtime action as resolved and record the outcome.",
  schema: z.object({
    actionId: z.string().describe("Downtime action id"),
    outcome: z.string().describe(
      "Narrative outcome of the downtime action (ASCII only)",
    ),
  }),
  func: async ({ actionId, outcome }) => {
    await downtimeActions.modify(
      { id: actionId } as Parameters<typeof downtimeActions.modify>[0],
      "$set",
      {
        resolved: true,
        outcome,
        resolvedAt: Date.now(),
      } as unknown as Parameters<typeof downtimeActions.modify>[2],
    );
    return `Downtime action ${actionId} resolved.`;
  },
});

// ─── Memory ───────────────────────────────────────────────────────────────────

export const store_memory = new DynamicStructuredTool({
  name: "store_memory",
  description:
    "Save a notable fact or consequence to the GM's persistent campaign memory. " +
    "Use for: NPC state changes, player choices with lasting consequences, " +
    "world-state shifts, important plot developments.",
  schema: z.object({
    body: z
      .string()
      .describe("The memory to record (terse, present-tense fact)"),
    type: z
      .enum(["plot", "npc-state", "world-state", "player-note", "consequence"])
      .describe("Category of memory"),
    priority: z
      .enum(["normal", "permanent"])
      .describe(
        "normal = may be dropped after memoryFull threshold; " +
          "permanent = always injected into context",
      ),
    tags: z
      .array(z.string())
      .describe(
        "Short tags for search (e.g. ['npc:vex', 'org:spire', 'session:3'])",
      ),
    resurface: z
      .number()
      .int()
      .optional()
      .describe("Session number to resurface this memory (optional)"),
  }),
  func: async ({ body, type, priority, tags, resurface }) => {
    const now = Date.now();
    const mem: Omit<IGMMemory, "id"> = {
      type,
      priority,
      body,
      tags,
      resurface,
      createdAt: now,
      updatedAt: now,
    };
    await gmMemory.create(mem as Parameters<typeof gmMemory.create>[0]);
    return `Memory stored: "${body}" [${type}/${priority}]`;
  },
});

// ─── Dice ─────────────────────────────────────────────────────────────────────

export const roll_dice = new DynamicStructuredTool({
  name: "roll_dice",
  description: "Roll one or more dice and apply a modifier. " +
    "For PbtA 2d6+stat rolls use count=2, sides=6, mod=stat value. " +
    "Result includes individual die values for transparency.",
  schema: z.object({
    count: z.number().int().min(1).max(10).describe("Number of dice to roll"),
    sides: z.number().int().min(2).max(20).describe("Number of sides per die"),
    mod: z.number().int().default(0).describe("Flat modifier to add to total"),
    label: z.string().optional().describe(
      "Optional label for the roll (e.g. 'Act Under Fire')",
    ),
  }),
  func: ({ count, sides, mod, label }) => {
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const sum = rolls.reduce((a, b) => a + b, 0) + mod;
    const dice = rolls.join(", ");
    const modStr = mod !== 0 ? ` + ${mod} mod` : "";
    const prefix = label ? `${label}: ` : "";
    return Promise.resolve(`${prefix}[${dice}]${modStr} = ${sum}`);
  },
});

// ─── Wiki / Lore ──────────────────────────────────────────────────────────────

export const search_wiki = new DynamicStructuredTool({
  name: "search_wiki",
  description:
    "Search wiki pages by keyword. Returns a list of matching page titles and paths. " +
    "Use get_wiki_page to fetch full content.",
  schema: z.object({
    query: z.string().describe("Search terms"),
    baseUrl: z
      .string()
      .optional()
      .default("http://localhost:4201")
      .describe("Wiki base URL"),
  }),
  func: async ({ query, baseUrl = "http://localhost:4201" }) => {
    try {
      const res = await fetch(
        `${baseUrl}/api/v1/wiki/search?q=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return `[Wiki search failed: ${res.status}]`;
      const data = (await res.json()) as unknown;
      return jsonOut(data);
    } catch (e) {
      return `[Wiki search error: ${(e as Error).message}]`;
    }
  },
});

export const get_wiki_page = new DynamicStructuredTool({
  name: "get_wiki_page",
  description: "Fetch the full text of a specific wiki page by its path.",
  schema: z.object({
    path: z.string().describe("Wiki page path (e.g. 'lore/factions/spire')"),
    baseUrl: z
      .string()
      .optional()
      .default("http://localhost:4201")
      .describe("Wiki base URL"),
  }),
  func: async ({ path, baseUrl = "http://localhost:4201" }) => {
    try {
      const res = await fetch(
        `${baseUrl}/api/v1/wiki/${encodeURIComponent(path)}`,
      );
      if (!res.ok) return `[Wiki page not found: "${path}"]`;
      const data = (await res.json()) as unknown;
      return jsonOut(data);
    } catch (e) {
      return `[Wiki fetch error: ${(e as Error).message}]`;
    }
  },
});

export const store_lore = new DynamicStructuredTool({
  name: "store_lore",
  description:
    "Publish a new lore entry to the wiki under the lore/ namespace. " +
    "Use for: world facts the GM discovers or invents, NPC lore, location details, " +
    "faction background, consequence write-ups.",
  schema: z.object({
    slug: z
      .string()
      .describe("URL-safe slug (e.g. 'the-spire-history', 'vex-true-name')"),
    category: z
      .string()
      .describe(
        "Lore category path segment (e.g. 'factions', 'locations', 'npcs')",
      ),
    title: z.string().describe("Human-readable title"),
    body: z.string().describe("Markdown body of the lore entry (ASCII only)"),
    baseUrl: z
      .string()
      .optional()
      .default("http://localhost:4201")
      .describe("Wiki base URL"),
  }),
  func: async (
    { slug, category, title, body, baseUrl = "http://localhost:4201" },
  ) => {
    const path = `lore/${category}/${slug}`;
    const content = `---\ntitle: ${title}\n---\n\n${body}`;
    try {
      const res = await fetch(`${baseUrl}/api/v1/wiki`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) {
        const text = await res.text();
        return `[Wiki create failed: ${res.status} -- ${text.slice(0, 120)}]`;
      }
      return `Lore published at "${path}": "${title}"`;
    } catch (e) {
      return `[Wiki create error: ${(e as Error).message}]`;
    }
  },
});

// ─── Session History ──────────────────────────────────────────────────────────

export const search_session_history = new DynamicStructuredTool({
  name: "search_session_history",
  description:
    "Search past GM exchanges (poses, oracle results, move adjudications) by keyword. " +
    "Use when context window references omitted memories or older events.",
  schema: z.object({
    query: z.string().describe(
      "Keyword(s) to search for in exchange input/output",
    ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Max results to return"),
  }),
  func: async ({ query, limit }) => {
    const all = await (gmExchanges.all() as Promise<unknown[]>);
    const q = query.toLowerCase();
    const matches = (all as Array<
      { input: string; output: string; type: string; timestamp: number }
    >)
      .filter(
        (e) =>
          e.input.toLowerCase().includes(q) ||
          e.output.toLowerCase().includes(q),
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    if (!matches.length) return `No session history matches for "${query}".`;
    return matches
      .map((e) =>
        `[${e.type}] ${e.input.slice(0, 80)}...\n  -> ${
          e.output.slice(0, 200)
        }...`
      )
      .join("\n\n");
  },
});

// ─── Tool registry ────────────────────────────────────────────────────────────
//
// All tools as a flat array — pass directly to model.bindTools() or ToolNode.

export const ALL_TOOLS = [
  get_character,
  get_npc,
  get_scene,
  set_scene_description,
  get_front,
  tick_front_clock,
  get_org,
  get_active_jobs,
  create_job,
  approve_job,
  reject_job,
  get_open_downtime,
  resolve_downtime_action,
  store_memory,
  roll_dice,
  search_wiki,
  get_wiki_page,
  store_lore,
  search_session_history,
];
