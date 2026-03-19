import { DBO } from "ursamu";
import type { IScene } from "./schema.ts";

export const scenes = new DBO<IScene>("server.scenes");
