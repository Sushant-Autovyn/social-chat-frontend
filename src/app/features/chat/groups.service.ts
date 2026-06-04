import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserSummary } from '../users/users.service';
import { environment } from '../../../environments/environment';

export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  user: UserSummary;
  role: 'owner' | 'admin' | 'member' | string;
  joinedAt: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  ownerId: number;
  members?: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupMessage {
  id: number;
  groupId: number;
  senderId: number;
  sender?: UserSummary;
  content: string;
  createdAt: string;
}

export interface PaginatedGroupMessages {
  items: GroupMessage[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private readonly base = `${environment.apiBase}/groups`;
  constructor(private http: HttpClient) {}

  list(): Observable<GroupSummary[]> {
    return this.http.get<GroupSummary[]>(this.base);
  }

  get(id: number): Observable<GroupSummary> {
    return this.http.get<GroupSummary>(`${this.base}/${id}`);
  }

  create(payload: {
    name: string;
    description?: string;
    avatar?: string;
    memberIds: number[];
  }): Observable<GroupSummary> {
    return this.http.post<GroupSummary>(this.base, payload);
  }

  addMembers(id: number, userIds: number[]): Observable<GroupSummary> {
    return this.http.post<GroupSummary>(`${this.base}/${id}/members`, { userIds });
  }

  removeMember(id: number, userId: number): Observable<GroupSummary> {
    return this.http.delete<GroupSummary>(`${this.base}/${id}/members/${userId}`);
  }

  promote(id: number, userId: number): Observable<GroupSummary> {
    return this.http.patch<GroupSummary>(`${this.base}/${id}/members/${userId}/promote`, {});
  }

  sendMessage(id: number, content: string): Observable<GroupMessage> {
    return this.http.post<GroupMessage>(`${this.base}/${id}/messages`, { content });
  }

  history(id: number, page = 1, limit = 50): Observable<PaginatedGroupMessages> {
    return this.http.get<PaginatedGroupMessages>(`${this.base}/${id}/messages`, {
      params: { page, limit } as any,
    });
  }
}
