// ─── In-Play Debt Record ──────────────────────────────────────────────────────
//
// Each record is stored from the owner's (authenticated player's) perspective.
//
//   direction "owed" → the other party owes the owner  (owner has leverage)
//   direction "owes" → the owner owes the other party  (owner is in debt)

export interface IDebtRecord {
  id: string;           // uuid
  ownerId: string;      // player who holds this record
  ownerName: string;    // display name of the owner

  direction: "owed" | "owes";

  otherName: string;    // name of the other party (PC name or NPC)
  otherId?: string;     // player ID if the other party is a PC

  description: string;  // narrative context / what the debt is for

  cashedIn: boolean;
  cashedInAt?: number;

  createdAt: number;
  updatedAt: number;
}
