export interface WorkSchedule {
  Id?: number;
  EmployeeName: string;
  WorkDate: string;
  ClockIn: string | null;
  ClockOut: string | null;
  Notes?: string | null;
}
