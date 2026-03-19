import type { IPlugin } from "ursamu/plugin";
import { registerPluginRoute } from "ursamu/app";
import { dbojs } from "ursamu";
import { sheets } from "../playbooks/db.ts";
import { makeTrackerRouter } from "./router.ts";
import "./commands.ts";

const trackerPlugin: IPlugin = {
  name: "urban-shadows-tracker",
  version: "1.0.0",
  description: "Urban Shadows harm & corruption tracker",

  init: () => {
    const handler = makeTrackerRouter(sheets, dbojs);
    registerPluginRoute("/api/v1/tracker", handler);
    console.log("[urban-shadows-tracker] Tracker routes registered");
    return Promise.resolve(true);
  },
};

export default trackerPlugin;
