export const DOWNTIME_TYPES = [
  "recover",
  "indulge",
  "consolidate",
  "work-contact",
  "pursue-lead",
  "other",
] as const;

export type DowntimeActionType = typeof DOWNTIME_TYPES[number];
export type DowntimePeriodStatus = "open" | "closed";

export interface IDowntimePeriod {
  id: string;
  label: string;          // e.g. "Between Session 3 and 4"
  status: DowntimePeriodStatus;
  openedBy: string;
  openedByName: string;
  closedBy?: string;
  closedByName?: string;
  openedAt: number;
  closedAt?: number;
}

export interface IDowntimeAction {
  id: string;
  periodId: string;
  playerId: string;
  playerName: string;
  type: DowntimeActionType;
  description: string;
  resolved: boolean;
  resolution?: string;     // MC narrative response
  resolvedBy?: string;
  resolvedByName?: string;
  createdAt: number;
  resolvedAt?: number;
}
