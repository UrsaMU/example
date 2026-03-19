import type { IPlugin } from "ursamu";
import { registerPluginRoute } from "ursamu/app";
import { dbojs } from "ursamu";
import { sheets } from "../playbooks/db.ts";
import { sessAnswers, sessions } from "./db.ts";
import { makeSessionRouter } from "./router.ts";
import "./commands.ts";

const sessionPlugin: IPlugin = {
  name: "urban-shadows-session",
  version: "1.0.0",
  description:
    "Urban Shadows end-of-session questions — answer prompts, earn XP",

  init: () => {
    const handler = makeSessionRouter(sessions, sessAnswers, sheets, dbojs);
    registerPluginRoute("/api/v1/sessions", handler);
    console.log("[urban-shadows-session] Session routes registered");
    return Promise.resolve(true);
  },
};

export default sessionPlugin;
