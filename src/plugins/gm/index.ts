// ─── GM Plugin Entry Point ────────────────────────────────────────────────────
//
// Wires up commands, LangGraph graphs, hook context, and callback bridges.

import type { IPlugin } from "ursamu/plugin";
import { dbojs, mu } from "ursamu";
import "./commands.ts";

import { createModel, loadConfig } from "./providers.ts";
import {
  buildAllGraphs,
  runMoveGraph,
  runOracleGraph,
} from "./graphs/index.ts";
import type { OracleProbability } from "./graphs/index.ts";
import { type IHookContext, registerHooks } from "./hooks.ts";
import {
  registerGmGoCallback,
  registerMoveCallback,
  registerOracleCallback,
  registerScenePublishCallback,
} from "./commands.ts";
import {
  buildRoundSummary,
  closeRound,
  getOpenRound,
  markRoundAdjudicating,
} from "./round-manager.ts";
import { sessionCache } from "./context/cache.ts";
import { loadRoomContext } from "./context/loader.ts";
import { getSystem } from "./systems/index.ts";
import { gmExchanges } from "./db.ts";
import type { IGMExchange } from "./schema.ts";
import { runPoseGraph } from "./graphs/pose.ts";
import type { IInjectOptions } from "./context/injector.ts";

// ─── Plugin ───────────────────────────────────────────────────────────────────

const gmPlugin: IPlugin = {
  name: "urban-shadows-gm",
  version: "1.0.0",
  description:
    "Urban Shadows AI Game Master -- agentic LangGraph + Gemini Flash GM assistant",

  init: async () => {
    let config = await loadConfig();
    const model = createModel(config);
    const graphs = buildAllGraphs(model);

    // ── Player helpers ─────────────────────────────────────────────────────────

    async function getPlayersInRoom(
      roomId: string,
    ): Promise<Map<string, string>> {
      const players = await dbojs.query({
        $and: [
          { location: roomId },
          { flags: /connected/i },
          { flags: /player/i },
        ],
      });
      const map = new Map<string, string>();
      for (const p of players) {
        const name = (p.data as { name?: string })?.name ?? p.id;
        map.set(p.id, name);
      }
      return map;
    }

    function page(_playerId: string, message: string): void {
      mu()
        .then((game) => game.broadcast(`[GM Page] ${message}`))
        .catch(() => {});
    }

    async function broadcast(roomId: string, message: string): Promise<void> {
      const playerMap = await getPlayersInRoom(roomId);
      if (playerMap.size) {
        const game = await mu();
        game.broadcast(message);
      }
    }

    function getSessionId(): string | null {
      return null; // resolved asynchronously in hooks; null is a safe default
    }

    // ── Shared IInjectOptions builder ─────────────────────────────────────────

    async function buildOpts(
      roomId: string,
      inRoomPlayerIds: string[],
      currentRound?: import("./schema.ts").IGMRound,
    ): Promise<IInjectOptions> {
      const [snapshot, lore] = await Promise.all([
        sessionCache.getSnapshot(),
        sessionCache.getLore(),
      ]);
      const recentExchanges = (
        (await gmExchanges.query(
          {
            roomId,
          } as Parameters<typeof gmExchanges.query>[0],
        )) as IGMExchange[]
      )
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-20);

      const roomCtx = await loadRoomContext(
        roomId,
        snapshot,
        inRoomPlayerIds,
        recentExchanges.map((e) => e.input),
      );

      return {
        config,
        system: getSystem(config.systemId),
        snapshot,
        roomCtx,
        lorePages: lore,
        recentExchanges,
        graphSuffix: "",
        inRoomPlayerIds,
        currentRound,
      };
    }

    // ── Hook context ───────────────────────────────────────────────────────────

    const hookCtx: IHookContext = {
      config,
      graphs,
      page,
      broadcast,
      getPlayersInRoom,
      getSessionId,
    };

    registerHooks(hookCtx);

    // ── +gm/go ─────────────────────────────────────────────────────────────────

    registerGmGoCallback(async (roomId: string) => {
      config = await loadConfig();
      const round = await getOpenRound(roomId);
      if (!round) return;

      await markRoundAdjudicating(round.id);
      const playerIds = round.contributions.map((c) => c.playerId);
      const opts = await buildOpts(roomId, playerIds, round);
      const roundSummary = buildRoundSummary(round);

      let output = "";
      try {
        output = await runPoseGraph(graphs.pose, { opts, roundSummary });
      } catch (e) {
        console.error("[GM] +gm/go pose graph error:", e);
        output = "[GM is temporarily unavailable.]";
      }

      if (output) await broadcast(roomId, output);
      await closeRound(round.id);

      await gmExchanges.create(
        {
          type: "pose",
          roomId,
          input: roundSummary,
          output,
          toolsUsed: [],
          timestamp: Date.now(),
        } as unknown as Parameters<typeof gmExchanges.create>[0],
      );
    });

    // ── +gm/oracle ─────────────────────────────────────────────────────────────

    registerOracleCallback(
      async (
        playerId: string,
        question: string,
        probability: string,
        roomId: string,
      ) => {
        config = await loadConfig();
        const playerMap = await getPlayersInRoom(roomId);
        const playerIds = [...playerMap.keys()];
        const opts = await buildOpts(roomId, playerIds);
        const playerName = playerMap.get(playerId) ?? playerId;

        let output = "";
        try {
          output = await runOracleGraph(graphs.oracle, {
            opts,
            question,
            probability: probability as OracleProbability,
            playerName,
          });
        } catch (e) {
          console.error("[GM] oracle graph error:", e);
          output = "[GM oracle temporarily unavailable.]";
        }

        if (output) await broadcast(roomId, output);

        await gmExchanges.create(
          {
            type: "oracle",
            roomId,
            playerId,
            playerName,
            input: question,
            output,
            toolsUsed: [],
            timestamp: Date.now(),
          } as unknown as Parameters<typeof gmExchanges.create>[0],
        );
      },
    );

    // ── +gm/move ───────────────────────────────────────────────────────────────

    registerMoveCallback(
      async (
        playerId: string,
        moveName: string,
        total: number,
        roomId: string,
      ) => {
        config = await loadConfig();
        const playerMap = await getPlayersInRoom(roomId);
        const playerIds = [...playerMap.keys()];
        const opts = await buildOpts(roomId, playerIds);
        const playerName = playerMap.get(playerId) ?? playerId;

        let output = "";
        try {
          output = await runMoveGraph(graphs.move, {
            opts,
            moveName,
            stat: "unknown",
            statValue: 0,
            roll1: 0,
            roll2: 0,
            total,
            playerName,
            triggeringPose: `+gm/move ${moveName}=${total}`,
          });
        } catch (e) {
          console.error("[GM] move graph error:", e);
          output = "[GM move adjudication temporarily unavailable.]";
        }

        if (output) await broadcast(roomId, output);

        await gmExchanges.create(
          {
            type: "move",
            roomId,
            playerId,
            playerName,
            input: `${moveName} = ${total}`,
            output,
            toolsUsed: [],
            timestamp: Date.now(),
          } as unknown as Parameters<typeof gmExchanges.create>[0],
        );
      },
    );

    // ── +gm/scene/publish ───────────────────────────────────────────────────────

    registerScenePublishCallback(async (roomId: string, message: string) => {
      await broadcast(roomId, message);
    });

    console.log("[GM] Plugin initialised.");
    return true;
  },
};

export default gmPlugin;
