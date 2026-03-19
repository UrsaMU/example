// ─── GM Plugin Commands ────────────────────────────────────────────────────────
//
// +gm                      — show GM status
// +gm/config               — show current config
// +gm/config/model <model> — set Gemini model
// +gm/config/apikey <key>  — set Google API key
// +gm/config/mode <auto|hybrid> — set GM mode
// +gm/config/chaos <1-9>   — set chaos factor
// +gm/watch <roomId>       — add room to watched list
// +gm/unwatch <roomId>     — remove room from watched list
// +gm/ignore <playerId>    — add player to ignore list
// +gm/unignore <playerId>  — remove player from ignore list
// +gm/go                   — manually trigger round adjudication in current room
// +gm/session/open <label> — open a new GM session
// +gm/session/close        — close current GM session
// +gm/reload               — force context cache reload
// +gm/oracle <question>    — ask the GM oracle a yes/no question
// +gm/move <move>=<total>  — adjudicate a completed move roll
// +gm/scene/publish <text> — broadcast a GM narration draft to the current room

import { addCmd } from "ursamu/app";
import { loadConfig, saveConfig } from "./providers.ts";
import { sessionCache } from "./context/cache.ts";
import { isValidChaosLevel, isValidMode } from "./schema.ts";
import { gmSessions } from "./db.ts";
import type { IGMSession } from "./schema.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type UC = {
  me: { id: string; flags: Set<string>; name?: string };
  here: unknown;
  send: (msg: string) => void;
  cmd: { args: string[]; switches: string[] };
};

function isStaff(u: UC): boolean {
  return (
    u.me.flags.has("admin") ||
    u.me.flags.has("wizard") ||
    u.me.flags.has("superuser")
  );
}

function roomId(u: UC): string {
  return ((u.here as { id?: string })?.id) ?? "";
}

const H = "%ch";
const N = "%cn";

// ─── +gm ─────────────────────────────────────────────────────────────────────

addCmd({
  name: "+gm",
  category: "GM",
  help: "+gm  --  Show the AI GM status and configuration summary.",
  pattern: /^\+gm$/i,
  exec: async (u: UC) => {
    const cfg = await loadConfig();
    const cached = sessionCache.isLoaded();
    const loadedAt = sessionCache.loadedAt();

    const lines = [
      `${H}--- AI GM Status ---${N}`,
      `  Model:     ${cfg.model}`,
      `  System:    ${cfg.systemId}`,
      `  Mode:      ${cfg.mode}`,
      `  Chaos:     ${cfg.chaosLevel}`,
      `  Watched:   ${
        cfg.watchedRooms.length ? cfg.watchedRooms.join(", ") : "(none)"
      }`,
      `  Ignored:   ${
        cfg.ignoredPlayers.length ? cfg.ignoredPlayers.join(", ") : "(none)"
      }`,
      `  Cache:     ${
        cached
          ? `loaded (${
            loadedAt ? new Date(loadedAt).toISOString() : "unknown"
          })`
          : "not loaded"
      }`,
      `  Autoframe: ${cfg.autoframe ? "on" : "off"}`,
      `  Greet:     ${cfg.greet ? "on" : "off"}`,
      `  Timeout:   ${cfg.roundTimeoutSeconds}s`,
    ];
    u.send(lines.join("\n"));
  },
});

// ─── +gm/config ──────────────────────────────────────────────────────────────

addCmd({
  name: "+gm/config",
  category: "GM",
  help: "+gm/config  --  Show full GM configuration.",
  pattern: /^\+gm\/config$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/config:${N}  Staff only.`);
      return;
    }
    const cfg = await loadConfig();
    u.send(`${H}--- GM Config ---${N}\n${JSON.stringify(cfg, null, 2)}`);
  },
});

addCmd({
  name: "+gm/config/model",
  category: "GM",
  help:
    "+gm/config/model <model>  --  Set the Gemini model (e.g. gemini-2.0-flash-latest).",
  pattern: /^\+gm\/config\/model\s+(.+)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/config/model:${N}  Staff only.`);
      return;
    }
    const model = u.cmd.args[0]?.trim();
    if (!model) {
      u.send(`${H}+gm/config/model:${N}  Usage: +gm/config/model <model>`);
      return;
    }
    await saveConfig({ model });
    u.send(`${H}+gm/config/model:${N}  Model set to: ${model}`);
  },
});

addCmd({
  name: "+gm/config/apikey",
  category: "GM",
  help:
    "+gm/config/apikey <key>  --  Set the Google API key (stored in DB, overrides env).",
  pattern: /^\+gm\/config\/apikey\s+(.+)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/config/apikey:${N}  Staff only.`);
      return;
    }
    const key = u.cmd.args[0]?.trim();
    if (!key) {
      u.send(`${H}+gm/config/apikey:${N}  Usage: +gm/config/apikey <key>`);
      return;
    }
    await saveConfig({ apiKey: key });
    u.send(`${H}+gm/config/apikey:${N}  API key saved.`);
  },
});

addCmd({
  name: "+gm/config/mode",
  category: "GM",
  help:
    "+gm/config/mode <auto|hybrid>  --  auto: GM responds automatically; hybrid: staff-triggered only.",
  pattern: /^\+gm\/config\/mode\s+(\w+)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/config/mode:${N}  Staff only.`);
      return;
    }
    const mode = u.cmd.args[0]?.trim().toLowerCase();
    if (!mode || !isValidMode(mode)) {
      u.send(`${H}+gm/config/mode:${N}  Must be 'auto' or 'hybrid'.`);
      return;
    }
    await saveConfig({ mode });
    u.send(`${H}+gm/config/mode:${N}  Mode set to: ${mode}`);
  },
});

addCmd({
  name: "+gm/config/chaos",
  category: "GM",
  help:
    "+gm/config/chaos <1-9>  --  Set the Mythic GME chaos factor (1=controlled, 9=chaotic).",
  pattern: /^\+gm\/config\/chaos\s+(\d)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/config/chaos:${N}  Staff only.`);
      return;
    }
    const n = parseInt(u.cmd.args[0] ?? "", 10);
    if (!isValidChaosLevel(n)) {
      u.send(`${H}+gm/config/chaos:${N}  Must be a number 1-9.`);
      return;
    }
    await saveConfig({ chaosLevel: n });
    u.send(`${H}+gm/config/chaos:${N}  Chaos level set to ${n}.`);
  },
});

// ─── +gm/watch / +gm/unwatch ─────────────────────────────────────────────────

addCmd({
  name: "+gm/watch",
  category: "GM",
  help: "+gm/watch  --  Add the current room to the GM's watched room list.",
  pattern: /^\+gm\/watch$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/watch:${N}  Staff only.`);
      return;
    }
    const rid = roomId(u);
    if (!rid) {
      u.send(`${H}+gm/watch:${N}  Cannot determine room.`);
      return;
    }
    const cfg = await loadConfig();
    if (cfg.watchedRooms.includes(rid)) {
      u.send(`${H}+gm/watch:${N}  Room ${rid} is already watched.`);
      return;
    }
    await saveConfig({ watchedRooms: [...cfg.watchedRooms, rid] });
    u.send(`${H}+gm/watch:${N}  Room ${rid} added to watch list.`);
  },
});

addCmd({
  name: "+gm/unwatch",
  category: "GM",
  help:
    "+gm/unwatch  --  Remove the current room from the GM's watched room list.",
  pattern: /^\+gm\/unwatch$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/unwatch:${N}  Staff only.`);
      return;
    }
    const rid = roomId(u);
    const cfg = await loadConfig();
    if (!cfg.watchedRooms.includes(rid)) {
      u.send(`${H}+gm/unwatch:${N}  Room ${rid} is not on the watch list.`);
      return;
    }
    await saveConfig({
      watchedRooms: cfg.watchedRooms.filter((r) => r !== rid),
    });
    u.send(`${H}+gm/unwatch:${N}  Room ${rid} removed from watch list.`);
  },
});

// ─── +gm/ignore / +gm/unignore ───────────────────────────────────────────────

addCmd({
  name: "+gm/ignore",
  category: "GM",
  help:
    "+gm/ignore <playerId>  --  Prevent the GM from responding to a specific player.",
  pattern: /^\+gm\/ignore\s+(.+)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/ignore:${N}  Staff only.`);
      return;
    }
    const pid = u.cmd.args[0]?.trim();
    if (!pid) {
      u.send(`${H}+gm/ignore:${N}  Usage: +gm/ignore <playerId>`);
      return;
    }
    const cfg = await loadConfig();
    if (!cfg.ignoredPlayers.includes(pid)) {
      await saveConfig({ ignoredPlayers: [...cfg.ignoredPlayers, pid] });
    }
    u.send(`${H}+gm/ignore:${N}  Player ${pid} ignored.`);
  },
});

addCmd({
  name: "+gm/unignore",
  category: "GM",
  help: "+gm/unignore <playerId>  --  Remove a player from the GM ignore list.",
  pattern: /^\+gm\/unignore\s+(.+)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/unignore:${N}  Staff only.`);
      return;
    }
    const pid = u.cmd.args[0]?.trim();
    if (!pid) {
      u.send(`${H}+gm/unignore:${N}  Usage: +gm/unignore <playerId>`);
      return;
    }
    const cfg = await loadConfig();
    await saveConfig({
      ignoredPlayers: cfg.ignoredPlayers.filter((p) => p !== pid),
    });
    u.send(`${H}+gm/unignore:${N}  Player ${pid} removed from ignore list.`);
  },
});

// ─── +gm/session/open ─────────────────────────────────────────────────────────

addCmd({
  name: "+gm/session/open",
  category: "GM",
  help: "+gm/session/open <label>  --  Open a new GM session.",
  pattern: /^\+gm\/session\/open\s+(.+)$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/session/open:${N}  Staff only.`);
      return;
    }
    const label = u.cmd.args[0]?.trim();
    if (!label) {
      u.send(`${H}+gm/session/open:${N}  Usage: +gm/session/open <label>`);
      return;
    }

    // Close any currently open session
    const existing = await gmSessions.query(
      {
        status: "open",
      } as Parameters<typeof gmSessions.query>[0],
    ) as IGMSession[];
    for (const s of existing) {
      await gmSessions.modify(
        { id: s.id } as Parameters<typeof gmSessions.modify>[0],
        "$set",
        {
          status: "closed",
          closedAt: Date.now(),
          closedBy: u.me.id,
          closedByName: (u.me as { name?: string }).name ?? u.me.id,
        },
      );
    }

    const sess: Omit<IGMSession, "id"> = {
      label,
      status: "open",
      openedBy: u.me.id,
      openedByName: (u.me as { name?: string }).name ?? u.me.id,
      openedAt: Date.now(),
      exchangeCount: 0,
    };
    const created = await gmSessions.create(
      sess as Parameters<typeof gmSessions.create>[0],
    ) as IGMSession;
    sessionCache.invalidateAll();
    u.send(
      `${H}+gm/session/open:${N}  Session "${label}" opened (id: ${created.id}).`,
    );
  },
});

addCmd({
  name: "+gm/session/close",
  category: "GM",
  help: "+gm/session/close  --  Close the current GM session.",
  pattern: /^\+gm\/session\/close$/i,
  exec: async (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/session/close:${N}  Staff only.`);
      return;
    }
    const existing = await gmSessions.query(
      {
        status: "open",
      } as Parameters<typeof gmSessions.query>[0],
    ) as IGMSession[];

    if (!existing.length) {
      u.send(`${H}+gm/session/close:${N}  No open session.`);
      return;
    }

    for (const s of existing) {
      await gmSessions.modify(
        { id: s.id } as Parameters<typeof gmSessions.modify>[0],
        "$set",
        {
          status: "closed",
          closedAt: Date.now(),
          closedBy: u.me.id,
          closedByName: (u.me as { name?: string }).name ?? u.me.id,
        },
      );
    }
    u.send(`${H}+gm/session/close:${N}  Session closed.`);
  },
});

// ─── +gm/reload ──────────────────────────────────────────────────────────────

addCmd({
  name: "+gm/reload",
  category: "GM",
  help: "+gm/reload  --  Force the GM context cache to reload on next use.",
  pattern: /^\+gm\/reload$/i,
  exec: (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/reload:${N}  Staff only.`);
      return;
    }
    sessionCache.invalidateAll();
    u.send(
      `${H}+gm/reload:${N}  Context cache invalidated. Will reload on next GM action.`,
    );
  },
});

// ─── +gm/go ──────────────────────────────────────────────────────────────────
// Manually triggers round adjudication. The actual graph invocation is done
// in index.ts by the gmGo() function which is registered here as a callback.

let _gmGoCallback: ((roomId: string, staffId: string) => void) | null = null;

export function registerGmGoCallback(
  fn: (roomId: string, staffId: string) => void,
): void {
  _gmGoCallback = fn;
}

addCmd({
  name: "+gm/go",
  category: "GM",
  help:
    "+gm/go  --  Manually trigger GM adjudication for the current room's open round.",
  pattern: /^\+gm\/go$/i,
  exec: (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/go:${N}  Staff only.`);
      return;
    }
    const rid = roomId(u);
    if (!rid) {
      u.send(`${H}+gm/go:${N}  Cannot determine room.`);
      return;
    }
    if (!_gmGoCallback) {
      u.send(`${H}+gm/go:${N}  GM not initialised.`);
      return;
    }
    u.send(`${H}+gm/go:${N}  Triggering adjudication for room ${rid}...`);
    _gmGoCallback(rid, u.me.id);
  },
});

// ─── +gm/oracle ──────────────────────────────────────────────────────────────

let _oracleCallback:
  | ((
    playerId: string,
    question: string,
    probability: string,
    roomId: string,
  ) => void)
  | null = null;

export function registerOracleCallback(
  fn: (
    playerId: string,
    question: string,
    probability: string,
    roomId: string,
  ) => void,
): void {
  _oracleCallback = fn;
}

addCmd({
  name: "+gm/oracle",
  category: "GM",
  help:
    "+gm/oracle[/<probability>] <question>  --  Ask the GM oracle a yes/no question.\n" +
    "  Probability switches: certain, very-likely, likely, 50-50, unlikely, very-unlikely, impossible\n" +
    "  Default: 50-50\n" +
    "  Example: +gm/oracle/likely Does Vex know about the deal?",
  pattern: /^\+gm\/oracle(?:\/([a-z-]+))?\s+(.+)$/i,
  exec: (u: UC) => {
    const probability = (u.cmd.switches[0] ?? "50-50").toLowerCase();
    const question = u.cmd.args[0]?.trim();
    if (!question) {
      u.send(`${H}+gm/oracle:${N}  Usage: +gm/oracle[/probability] <question>`);
      return;
    }
    if (!_oracleCallback) {
      u.send(`${H}+gm/oracle:${N}  GM not initialised.`);
      return;
    }
    const rid = roomId(u);
    u.send(`${H}[GM oracle consulting the city...]${N}`);
    _oracleCallback(u.me.id, question, probability, rid);
  },
});

// ─── +gm/scene/publish ───────────────────────────────────────────────────────
// Broadcasts a GM narration (typically an edited draft from +gm/scene:set) to
// everyone in the staff member's current room.

let _scenePublishCallback:
  | ((roomId: string, message: string) => void)
  | null = null;

export function registerScenePublishCallback(
  fn: (roomId: string, message: string) => void,
): void {
  _scenePublishCallback = fn;
}

addCmd({
  name: "+gm/scene/publish",
  category: "GM",
  help:
    "+gm/scene/publish <text>  --  Broadcast a GM narration to the current room.\n" +
    "  Use after receiving a [GM DRAFT] page from scene:set to broadcast the\n" +
    "  (optionally edited) narration to all players in the room.",
  pattern: /^\+gm\/scene\/publish\s+(.+)$/is,
  exec: (u: UC) => {
    if (!isStaff(u)) {
      u.send(`${H}+gm/scene/publish:${N}  Staff only.`);
      return;
    }
    const text = u.cmd.args[0]?.trim();
    if (!text) {
      u.send(`${H}+gm/scene/publish:${N}  Usage: +gm/scene/publish <text>`);
      return;
    }
    if (!_scenePublishCallback) {
      u.send(`${H}+gm/scene/publish:${N}  GM not initialised.`);
      return;
    }
    const rid = roomId(u);
    if (!rid) {
      u.send(`${H}+gm/scene/publish:${N}  Cannot determine room.`);
      return;
    }
    _scenePublishCallback(rid, text);
    u.send(`${H}+gm/scene/publish:${N}  Narration broadcast to room ${rid}.`);
  },
});

// ─── +gm/move ────────────────────────────────────────────────────────────────

let _moveCallback:
  | ((
    playerId: string,
    moveName: string,
    total: number,
    roomId: string,
  ) => void)
  | null = null;

export function registerMoveCallback(
  fn: (
    playerId: string,
    moveName: string,
    total: number,
    roomId: string,
  ) => void,
): void {
  _moveCallback = fn;
}

addCmd({
  name: "+gm/move",
  category: "GM",
  help:
    "+gm/move <move name>=<total>  --  Submit a completed move roll for GM adjudication.\n" +
    "  Example: +gm/move Go Aggro=9",
  pattern: /^\+gm\/move\s+(.+)=(\d+)$/i,
  exec: (u: UC) => {
    const moveName = u.cmd.args[0]?.trim();
    const total = parseInt(u.cmd.args[1] ?? "", 10);
    if (!moveName || isNaN(total)) {
      u.send(`${H}+gm/move:${N}  Usage: +gm/move <move name>=<total>`);
      return;
    }
    if (!_moveCallback) {
      u.send(`${H}+gm/move:${N}  GM not initialised.`);
      return;
    }
    const rid = roomId(u);
    u.send(`${H}[GM adjudicating ${moveName} (${total})...]${N}`);
    _moveCallback(u.me.id, moveName, total, rid);
  },
});
