import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateSplitRequest, SplitGroup } from '../models/split.model';

@Injectable({ providedIn: 'root' })
export class SplitMoneyService {
  private baseUrl = `${environment.apiUrl}/split-money`;

  constructor(private http: HttpClient) {}

  createSplit(payload: CreateSplitRequest): Observable<{ id: number; amountPerPerson: number, payers: { personId: number; amount: number }[] }> {
    return this.http.post<{ id: number; amountPerPerson: number, payers: { personId: number; amount: number }[] }>(this.baseUrl, payload);
  }

  getAllSplits(): Observable<SplitGroup[]> {
    return this.http.get<SplitGroup[]>(this.baseUrl);
  }

  getSplitById(id: number): Observable<SplitGroup> {
    return this.http.get<SplitGroup>(`${this.baseUrl}/${id}`);
  }

  updateParticipantPaid(splitId: number, participantId: number, paid: boolean): Observable<any> {
    return this.http.put(`${this.baseUrl}/${splitId}/participants/${participantId}`, { paid });
  }

  deleteSplit(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
  
}
