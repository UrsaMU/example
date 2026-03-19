import type { IPlugin } from "ursamu";
import "./commands.ts";

const jobsPlugin: IPlugin = {
  name: "urban-shadows-jobs",
  version: "1.0.0",
  description:
    "Urban Shadows jobs — player-facing job browser and staff approval queue",
  init: () => Promise.resolve(true),
};

export default jobsPlugin;
