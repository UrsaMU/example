import type { IPlugin } from "ursamu/plugin";
import { registerPluginRoute } from "ursamu/app";
import { dbojs } from "ursamu";
import { debts } from "./db.ts";
import { makeDebtsRouter } from "./router.ts";
import "./commands.ts";

const debtsPlugin: IPlugin = {
  name: "urban-shadows-debts",
  version: "1.0.0",
  description: "Urban Shadows in-play debt tracker",

  init: () => {
    const handler = makeDebtsRouter(debts, dbojs);
    registerPluginRoute("/api/v1/debts", handler);
    console.log("[urban-shadows-debts] Debt routes registered");
    return Promise.resolve(true);
  },
};

export default debtsPlugin;
