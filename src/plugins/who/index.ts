import type { IPlugin } from "ursamu";
import "./commands.ts";

const whoPlugin: IPlugin = {
  name: "urban-shadows-who",
  version: "1.0.0",
  description: "Urban Shadows character roster",
  init: () => Promise.resolve(true),
};

export default whoPlugin;
