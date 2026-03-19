import { DBO } from "ursamu";
import type { IDowntimePeriod, IDowntimeAction } from "./schema.ts";

export const periods = new DBO<IDowntimePeriod>("server.downtime.periods");
export const actions = new DBO<IDowntimeAction>("server.downtime.actions");
