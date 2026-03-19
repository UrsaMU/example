import { DBO } from "ursamu";
import type { IFront } from "./schema.ts";

export const fronts = new DBO<IFront>("server.fronts");
