import { DBO } from "ursamu";
import type { IDebtRecord } from "./schema.ts";

export const debts = new DBO<IDebtRecord>("server.debts");
