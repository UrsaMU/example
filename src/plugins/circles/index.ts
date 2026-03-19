import type { IPlugin } from "ursamu";
import { registerPluginRoute } from "ursamu/app";
import { dbojs } from "ursamu";
import { sheets } from "../playbooks/db.ts";
import { factions } from "./db.ts";
import { makeCirclesRouter } from "./router.ts";
import "./commands.ts";

const circlesPlugin: IPlugin = {
  name: "urban-shadows-circles",
  version: "1.0.0",
  description: "Urban Shadows circle status and faction affiliation tracker",

  init: () => {
    const handler = makeCirclesRouter(sheets, factions, dbojs);
    registerPluginRoute("/api/v1/circles", handler);
    console.log("[urban-shadows-circles] Circle routes registered");
    return Promise.resolve(true);
  },
};

export default circlesPlugin;
