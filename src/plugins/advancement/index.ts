import type { IPlugin } from "ursamu";
import { registerPluginRoute } from "ursamu/app";
import { dbojs } from "ursamu";
import { sheets } from "../playbooks/db.ts";
import { makeAdvancementRouter } from "./router.ts";
import "./commands.ts";

const advancementPlugin: IPlugin = {
  name: "urban-shadows-advancement",
  version: "1.0.0",
  description: "Urban Shadows XP and advancement tracker",

  init: () => {
    const handler = makeAdvancementRouter(sheets, dbojs);
    registerPluginRoute("/api/v1/advancement", handler);
    console.log("[urban-shadows-advancement] Advancement routes registered");
    return Promise.resolve(true);
  },
};

export default advancementPlugin;
