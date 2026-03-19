import type { IPlugin } from "ursamu";
import "./commands.ts";

const orgsPlugin: IPlugin = {
  name: "urban-shadows-orgs",
  version: "1.0.0",
  description: "Urban Shadows organizations — city faction roster by circle",
  init: () => Promise.resolve(true),
};

export default orgsPlugin;
