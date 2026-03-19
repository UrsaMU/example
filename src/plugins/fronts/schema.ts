export const CLOCK_SIZES = [4, 6, 8] as const;
export type ClockSize = typeof CLOCK_SIZES[number];

export type FrontStatus = "active" | "resolved" | "abandoned";

export interface IGrimPortent {
  id: string;
  text: string;
  triggered: boolean;
  triggeredAt?: number;
}

export interface IFront {
  id: string;
  name: string;
  description: string;
  clockSize: ClockSize;
  clockTicks: number;
  grimPortents: IGrimPortent[];
  status: FrontStatus;
  resolvedAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
