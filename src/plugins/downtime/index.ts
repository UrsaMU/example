import type { IPlugin } from "ursamu/plugin";
import "./commands.ts";

const downtimePlugin: IPlugin = {
  name: "urban-shadows-downtime",
  version: "1.0.0",
  description:
    "Urban Shadows downtime — between-session action submission and MC resolution",
  init: () => Promise.resolve(true),
};

export default downtimePlugin;
