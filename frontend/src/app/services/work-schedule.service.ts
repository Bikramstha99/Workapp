import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WorkSchedule } from '../models/schedule.model';

@Injectable({ providedIn: 'root' })
export class WorkScheduleService {
  private baseUrl = `${environment.apiUrl}/work-schedule`;

  constructor(private http: HttpClient) {}

  clockIn(employeeName: string, notes: string, workDate: string): Observable<WorkSchedule> {
  return this.http.post<WorkSchedule>(`${this.baseUrl}/clock-in`, {
    employeeName,
    notes,
    workDate
  });
}
  clockOut(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/clock-out`, {});
  }

  getAllSchedules(): Observable<WorkSchedule[]> {
    return this.http.get<WorkSchedule[]>(this.baseUrl);
  }

  updateSchedule(id: number, notes: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, { notes });
  }

  deleteSchedule(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
