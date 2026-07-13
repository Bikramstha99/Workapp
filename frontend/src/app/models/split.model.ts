export interface CreateSplitRequest {
  title: string;
  totalAmount: number;
  personIds: number[];
  payers: { personId: number; amount: number }[]
}

export interface SplitParticipant {
  Id: number;
  PersonId: number;
  Name: string;
  AmountOwed: number;
  Paid: boolean;
}

export interface SplitGroup {
  Id: number;
  Title: string;
  TotalAmount: number;
  NumberOfPeople: number;
  participants: SplitParticipant[];
}