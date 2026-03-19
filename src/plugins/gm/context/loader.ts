import type { ICharSheet } from "../../playbooks/schema.ts";
import type { INPC } from "../../npcs/schema.ts";
import type { IOrg } from "../../orgs/schema.ts";
import type { IFront } from "../../fronts/schema.ts";
import type { IScene } from "../../scene/schema.ts";
import type { IGMMemory, IGMReveal } from "../schema.ts";
import { sheets } from "../../playbooks/db.ts";
import { npcs } from "../../npcs/db.ts";
import { orgs } from "../../orgs/db.ts";
import { fronts } from "../../fronts/db.ts";
import { scenes } from "../../scene/db.ts";
import { actions as downtimeActions } from "../../downtime/db.ts";
import { gmMemory, gmReveals } from "../db.ts";
import { jobs } from "ursamu/jobs";
import type { IJob } from "ursamu/jobs";
import type { IDowntimeAction } from "../../downtime/schema.ts";

// ─── Full game state snapshot ─────────────────────────────────────────────────

export interface ISessionSnapshot {
  characters: ICharSheet[];
  npcs: INPC[];
  orgs: IOrg[];
  fronts: IFront[];
  memories: IGMMemory[];
  reveals: IGMReveal[];
  openJobs: IJob[];
  openDowntime: IDowntimeAction[];
  loadedAt: number;
}

export async function loadSessionSnapshot(): Promise<ISessionSnapshot> {
  const [
    allChars,
    allNpcs,
    allOrgs,
    allFronts,
    allMemories,
    allReveals,
    allJobs,
    allDowntime,
  ] = await Promise.all([
    sheets.all() as Promise<ICharSheet[]>,
    npcs.all() as Promise<INPC[]>,
    orgs.all() as Promise<IOrg[]>,
    fronts.all() as Promise<IFront[]>,
    gmMemory.all() as Promise<IGMMemory[]>,
    gmReveals.all() as Promise<IGMReveal[]>,
    jobs.all() as Promise<IJob[]>,
    downtimeActions.all() as Promise<IDowntimeAction[]>,
  ]);

  return {
    characters: allChars.filter((c) => c.status === "approved"),
    npcs: allNpcs,
    orgs: allOrgs,
    fronts: allFronts.filter((f) => f.status === "active"),
    memories: allMemories,
    reveals: allReveals.filter((r) => !r.fired),
    openJobs: allJobs.filter((j) => j.status === "new" || j.status === "open"),
    openDowntime: allDowntime.filter((a) => !a.resolved),
    loadedAt: Date.now(),
  };
}

// ─── Room-level context ───────────────────────────────────────────────────────

export interface IRoomContext {
  scene: IScene | null;
  playersInRoom: ICharSheet[];
  recentExchangeTexts: string[];
}

export async function loadRoomContext(
  roomId: string,
  snapshot: ISessionSnapshot,
  playerIds: string[],
  recentExchangeTexts: string[],
): Promise<IRoomContext> {
  const scene =
    await (scenes.queryOne({ id: roomId }) as Promise<IScene | null>);
  const playersInRoom = snapshot.characters.filter((c) =>
    playerIds.includes(c.playerId)
  );
  return { scene, playersInRoom, recentExchangeTexts };
}

// ─── Wiki lore loader (hits wiki HTTP API) ────────────────────────────────────

export interface ILorePage {
  path: string;
  title: string;
  body?: string;
}

export async function loadLorePages(
  baseUrl = "http://localhost:4201",
): Promise<ILorePage[]> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/wiki/lore`);
    if (!res.ok) return [];
    const data = await res.json() as {
      type?: string;
      children?: ILorePage[];
      path?: string;
      title?: string;
    };
    if (data.type === "directory" && Array.isArray(data.children)) {
      return data.children.filter((c: ILorePage) => c.path && c.title);
    }
    return [];
  } catch {
    return [];
  }
}
