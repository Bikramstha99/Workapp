export interface PersonBalance {
  personId: number;
  name: string;
  totalOwed: number;
  owesTo: { toPersonId: number; toName: string; amount: number }[];
}