import type { IHarm } from "../playbooks/schema.ts";

export type { IHarm };

export interface INPC {
  id: string;
  name: string;
  circle?: string;
  harm: IHarm;
  notes: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export const EMPTY_HARM: IHarm = {
  boxes: [false, false, false, false, false],
  armor: 0,
};
