import type { IPlugin } from "ursamu";
import "./commands.ts";

const frontsPlugin: IPlugin = {
  name: "urban-shadows-fronts",
  version: "1.0.0",
  description: "Urban Shadows Fronts & Clocks — MC threat tracking and story arcs",
  init: () => Promise.resolve(true),
};

export default frontsPlugin;
