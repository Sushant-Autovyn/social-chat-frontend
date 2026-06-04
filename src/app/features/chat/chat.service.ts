
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { UserSummary } from '../users/users.service';
import { environment } from '../../../environments/environment';

export interface ChatSummary {
  id: number;
  userAId: number;
  userBId: number;
  participants: UserSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  senderId: number;
  sender?: UserSummary;
  content: string;
  createdAt: string;
}

export interface PaginatedMessages {
  items: ChatMessage[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly base = `${environment.apiBase}/chats`;
  private socket: Socket | null = null;

  readonly connected = signal(false);
  readonly onlineUsers = signal<number[]>([]);
  readonly incomingMessage$ = new Subject<ChatMessage>();
  readonly userOnline$ = new Subject<number>();
  readonly userOffline$ = new Subject<number>();

  constructor(private http: HttpClient) {}

  // ---------- REST ----------
  listChats(): Observable<ChatSummary[]> {
    return this.http.get<ChatSummary[]>(this.base);
  }

  createOrGetChat(participantId: number): Observable<ChatSummary> {
    return this.http.post<ChatSummary>(this.base, { participantId });
  }

  getHistory(chatId: number, page = 1, limit = 50): Observable<PaginatedMessages> {
    return this.http.get<PaginatedMessages>(`${this.base}/${chatId}/messages`, {
      params: { page, limit } as any,
    });
  }

  sendMessageRest(chatId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.base}/${chatId}/messages`, { content });
  }

  // ---------- Socket ----------
  connect(token: string): void {
    if (this.socket?.connected) return;
    this.socket = io(`${environment.apiBase}/chat`, {
      auth: { token },
    });

    this.socket.on('connected', (payload: { userId: number; onlineUsers: number[] }) => {
      this.connected.set(true);
      this.onlineUsers.set(payload.onlineUsers ?? []);
    });
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('message:new', (msg: ChatMessage) => this.incomingMessage$.next(msg));
    this.socket.on('user:online', (p: { userId: number }) => {
      this.userOnline$.next(p.userId);
      this.onlineUsers.update((arr) => Array.from(new Set([...arr, p.userId])));
    });
    this.socket.on('user:offline', (p: { userId: number }) => {
      this.userOffline$.next(p.userId);
      this.onlineUsers.update((arr) => arr.filter((id) => id !== p.userId));
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  emitSend(chatId: number, content: string): void {
    this.socket?.emit('message:send', { chatId, content });
  }

  joinChat(chatId: number): void {
    this.socket?.emit('chat:join', { chatId });
  }
}
