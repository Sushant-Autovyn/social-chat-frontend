import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserSummary {
  id: number;
  fullName: string;
  email: string;
  avatar: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly base = `${environment.apiBase}/users`;
  constructor(private http: HttpClient) {}

  list(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(this.base);
  }

  byId(id: number): Observable<UserSummary> {
    return this.http.get<UserSummary>(`${this.base}/${id}`);
  }

  updateMe(patch: { fullName?: string; avatar?: string | null }): Observable<UserSummary> {
    return this.http.patch<UserSummary>(`${this.base}/me`, patch);
  }
}
