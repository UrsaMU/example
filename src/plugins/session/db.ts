import { DBO } from "ursamu";
import type { ISession, ISessionAnswers } from "./schema.ts";

export const sessions    = new DBO<ISession>("server.sessions");
export const sessAnswers = new DBO<ISessionAnswers>("server.session-answers");
