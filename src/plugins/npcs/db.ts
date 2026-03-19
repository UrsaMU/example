import { DBO } from "ursamu";
import type { INPC } from "./schema.ts";

export const npcs = new DBO<INPC>("server.npcs");
