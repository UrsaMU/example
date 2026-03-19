import type { IGameSystem } from "./interface.ts";
import { urbanShadowsSystem } from "./urban-shadows.ts";

const SYSTEMS: ReadonlyMap<string, IGameSystem> = new Map([
  ["urban-shadows", urbanShadowsSystem],
]);

export function getSystem(id: string): IGameSystem {
  const sys = SYSTEMS.get(id);
  if (!sys) {
    // Fall back to Urban Shadows if the configured system is missing
    return urbanShadowsSystem;
  }
  return sys;
}

export function listSystemIds(): string[] {
  return [...SYSTEMS.keys()];
}

export type { IGameSystem };
