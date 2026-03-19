import type { IPlugin } from "ursamu";
import "./commands.ts";

const scenePlugin: IPlugin = {
  name: "urban-shadows-scene",
  version: "1.0.0",
  description:
    "Urban Shadows scene-setting — MC frames scenes with room descriptions",
  init: () => Promise.resolve(true),
};

export default scenePlugin;
