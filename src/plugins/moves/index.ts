import type { IPlugin } from "ursamu";
import { registerPluginRoute } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { makeMovesRouter } from "./router.ts";
import "./commands.ts";

const movesPlugin: IPlugin = {
  name: "urban-shadows-moves",
  version: "1.0.0",
  description: "Urban Shadows move resolution engine — trigger moves, roll stats, display outcomes",

  init: () => {
    const handler = makeMovesRouter(sheets);
    registerPluginRoute("/api/v1/moves", handler);
    console.log("[urban-shadows-moves] Moves routes registered");
    return Promise.resolve(true);
  },
};

export default movesPlugin;
