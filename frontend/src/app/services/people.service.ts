import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Person } from '../models/person.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private baseUrl = `${environment.apiUrl}/people`;

  constructor(private http: HttpClient) {}

  getAllPeople(): Observable<Person[]> {
    return this.http.get<Person[]>(this.baseUrl);
  }

  addPerson(name: string): Observable<Person> {
    return this.http.post<Person>(this.baseUrl, { name });
  }

  deletePerson(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}