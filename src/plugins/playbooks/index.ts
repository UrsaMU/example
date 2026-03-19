import type { IPlugin } from "ursamu";
import { registerPluginRoute } from "ursamu/app";
import { dbojs } from "ursamu";
import { sheets } from "./db.ts";
import { makePlaybooksRouter } from "./router.ts";
import "./commands.ts";
import "./jobs-integration.ts";

const playbooksPlugin: IPlugin = {
  name: "urban-shadows-playbooks",
  version: "1.0.0",
  description: "Urban Shadows playbook system and character generation",

  init: () => {
    const handler = makePlaybooksRouter(sheets, dbojs);
    registerPluginRoute("/api/v1/playbooks", handler);
    registerPluginRoute("/api/v1/chargen", handler);
    console.log(
      "[urban-shadows-playbooks] Playbooks + chargen routes registered",
    );
    return Promise.resolve(true);
  },
};

export default playbooksPlugin;
