import type { IPlugin } from "ursamu/plugin";
import "./commands.ts";

const npcsPlugin: IPlugin = {
  name: "urban-shadows-npcs",
  version: "1.0.0",
  description: "Urban Shadows NPC tracker — harm, armor, circle, notes",
  init: () => Promise.resolve(true),
};

export default npcsPlugin;
