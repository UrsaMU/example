import { DBO } from "ursamu";
import type { IOrg } from "./schema.ts";

export const orgs = new DBO<IOrg>("server.orgs");
