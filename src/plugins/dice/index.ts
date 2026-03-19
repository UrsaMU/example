import type { IPlugin } from "ursamu/plugin";
import { registerPluginRoute } from "ursamu/app";
import { sheets } from "../playbooks/db.ts";
import { makeDiceRouter } from "./router.ts";
import "./commands.ts";

const dicePlugin: IPlugin = {
  name: "urban-shadows-dice",
  version: "1.0.0",
  description:
    "Urban Shadows dice roller — 2d6 + stat with miss/weak/strong outcomes",

  init: () => {
    const handler = makeDiceRouter(sheets);
    registerPluginRoute("/api/v1/roll", handler);
    console.log("[urban-shadows-dice] Roll route registered");
    return Promise.resolve(true);
  },
};

export default dicePlugin;
