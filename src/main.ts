import { mu } from "ursamu";
import playbooksPlugin from "./plugins/playbooks/index.ts";
import dicePlugin from "./plugins/dice/index.ts";
import debtsPlugin from "./plugins/debts/index.ts";
import trackerPlugin from "./plugins/tracker/index.ts";
import advancementPlugin from "./plugins/advancement/index.ts";
import circlesPlugin from "./plugins/circles/index.ts";
import movesPlugin from "./plugins/moves/index.ts";
import sessionPlugin from "./plugins/session/index.ts";
import npcsPlugin from "./plugins/npcs/index.ts";
import frontsPlugin from "./plugins/fronts/index.ts";
import whoPlugin from "./plugins/who/index.ts";
import scenePlugin from "./plugins/scene/index.ts";
import downtimePlugin from "./plugins/downtime/index.ts";
import orgsPlugin from "./plugins/orgs/index.ts";
import jobsPlugin from "./plugins/jobs/index.ts";
import gmPlugin from "./plugins/gm/index.ts";

const game = await mu(undefined, [
  playbooksPlugin,
  dicePlugin,
  debtsPlugin,
  trackerPlugin,
  advancementPlugin,
  circlesPlugin,
  movesPlugin,
  sessionPlugin,
  npcsPlugin,
  frontsPlugin,
  whoPlugin,
  scenePlugin,
  downtimePlugin,
  orgsPlugin,
  jobsPlugin,
  gmPlugin,
]);
console.log(`${game.config.get("game.name")} is live!`);
