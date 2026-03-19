import { DBO } from "ursamu";
import type { ICharSheet } from "./schema.ts";

// ─── Character Sheet store ─────────────────────────────────────────────────────
// Key in config.json: server.charsheets  → prefix "charsheets"
export const sheets = new DBO<ICharSheet>("server.charsheets");
