import type { CircleName } from "../playbooks/schema.ts";
export type { CircleName };

export interface IOrg {
  id: string;
  name: string;
  circle: CircleName;
  description: string;
  notes: string;       // staff-only private notes
  isPublic: boolean;   // whether players can see this org
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
