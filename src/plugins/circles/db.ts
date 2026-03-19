import { DBO } from "ursamu";
import type { IFactionEntry } from "./schema.ts";

export const factions = new DBO<IFactionEntry>("server.factions");
