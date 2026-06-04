import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UserSummary, UsersService } from '../users/users.service';
import { ChatMessage, ChatService, ChatSummary } from './chat.service';
import { GroupMessage, GroupSummary, GroupsService } from './groups.service';
import { CallService } from './call.service';
import { CallOverlay } from './call-overlay';
import { Settings } from '../settings/settings';

type ActiveKind = 'dm' | 'group';
type Tab = 'chats' | 'groups' | 'people';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CallOverlay, Settings],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, OnDestroy {
  private authSvc = inject(AuthService);
  private usersSvc = inject(UsersService);
  private chatSvc = inject(ChatService);
  private groupsSvc = inject(GroupsService);
  private callSvc = inject(CallService);

  // Auth + presence
  me = computed(() => this.authSvc.user());
  connected = this.chatSvc.connected;
  onlineUsers = this.chatSvc.onlineUsers;

  // Lists
  users = signal<UserSummary[]>([]);
  chats = signal<ChatSummary[]>([]);
  groups = signal<GroupSummary[]>([]);

  // Active conversation
  activeKind = signal<ActiveKind | null>(null);
  activeChat = signal<ChatSummary | null>(null);
  activePeer = signal<UserSummary | null>(null);
  activeGroup = signal<GroupSummary | null>(null);

  // Messages
  messages = signal<ChatMessage[]>([]);
  groupMessages = signal<GroupMessage[]>([]);
  draft = signal('');
  loading = signal(false);
  error = signal<string | null>(null);

  // Sidebar UI state
  query = signal('');
  tab = signal<Tab>('chats');

  // Group modal
  showGroupModal = signal(false);
  newGroupName = signal('');
  newGroupDesc = signal('');
  selectedMemberIds = signal<number[]>([]);
  creatingGroup = signal(false);

  // Settings
  showSettings = signal(false);
  openSettings() { this.showSettings.set(true); }
  closeSettings() { this.showSettings.set(false); }

  // Filtered lists
  filteredChats = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.chats();
    return this.chats().filter((c) => {
      const peer = this.peerForChat(c);
      return peer?.fullName?.toLowerCase().includes(q) || peer?.email?.toLowerCase().includes(q);
    });
  });
  filteredGroups = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.groups();
    return this.groups().filter(
      (g) => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q),
    );
  });
  filteredPeople = computed(() => {
    const q = this.query().trim().toLowerCase();
    const myId = this.me()?.id;
    const list = this.users().filter((u) => u.id !== myId);
    if (!q) return list;
    return list.filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  private subs: Subscription[] = [];

  ngOnInit(): void {
    const token = this.authSvc.getToken();
    if (token) this.chatSvc.connect(token);
    this.callSvc.ensureSocket();

    this.loadUsers();
    this.loadChats();
    this.loadGroups();

    this.subs.push(
      this.chatSvc.incomingMessage$.subscribe((msg) => {
        if (this.activeKind() === 'dm' && this.activeChat()?.id === msg.chatId) {
          this.messages.update((arr) => [...arr, msg]);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.chatSvc.disconnect();
  }

  // ---------- Loaders ----------
  loadUsers() {
    this.usersSvc.list().subscribe({
      next: (u) => this.users.set(u),
      error: () => this.error.set('Failed to load users'),
    });
  }
  loadChats() {
    this.chatSvc.listChats().subscribe({
      next: (c) => this.chats.set(c),
      error: () => this.error.set('Failed to load chats'),
    });
  }
  loadGroups() {
    this.groupsSvc.list().subscribe({
      next: (g) => this.groups.set(g),
      error: () => this.error.set('Failed to load groups'),
    });
  }

  // ---------- Helpers ----------
  peerForChat(chat: ChatSummary): UserSummary | undefined {
    const myId = this.me()?.id;
    return chat.participants?.find((p) => p.id !== myId);
  }
  isOnline(userId: number): boolean {
    return this.onlineUsers().includes(userId);
  }
  senderName(msg: GroupMessage): string {
    return msg.sender?.fullName ?? `User ${msg.senderId}`;
  }

  // ---------- DM actions ----------
  openWithUser(user: UserSummary) {
    this.chatSvc.createOrGetChat(user.id).subscribe({
      next: (chat) => {
        if (!this.chats().some((c) => c.id === chat.id)) {
          this.chats.update((arr) => [chat, ...arr]);
        }
        this.selectChat(chat);
      },
    });
  }
  selectChat(chat: ChatSummary) {
    this.activeKind.set('dm');
    this.activeChat.set(chat);
    this.activeGroup.set(null);
    this.activePeer.set(this.peerForChat(chat) ?? null);
    this.messages.set([]);
    this.chatSvc.joinChat(chat.id);
    this.loading.set(true);
    this.chatSvc.getHistory(chat.id).subscribe({
      next: (res) => {
        this.messages.set([...res.items].reverse());
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Failed to load messages'); },
    });
  }

  // ---------- Group actions ----------
  selectGroup(g: GroupSummary) {
    this.activeKind.set('group');
    this.activeGroup.set(g);
    this.activeChat.set(null);
    this.activePeer.set(null);
    this.groupMessages.set([]);
    this.loading.set(true);
    this.groupsSvc.history(g.id).subscribe({
      next: (res) => {
        this.groupMessages.set([...res.items].reverse());
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Failed to load group messages'); },
    });
  }
  refreshGroupMessages() {
    const g = this.activeGroup();
    if (!g) return;
    this.groupsSvc.history(g.id).subscribe({
      next: (res) => this.groupMessages.set([...res.items].reverse()),
    });
  }

  // ---------- Send ----------
  send() {
    const text = this.draft().trim();
    if (!text) return;
    if (this.activeKind() === 'dm') {
      const chat = this.activeChat();
      if (!chat) return;
      this.chatSvc.emitSend(chat.id, text);
      this.draft.set('');
    } else if (this.activeKind() === 'group') {
      const g = this.activeGroup();
      if (!g) return;
      this.groupsSvc.sendMessage(g.id, text).subscribe({
        next: (msg) => {
          this.groupMessages.update((arr) => [...arr, msg]);
          this.draft.set('');
        },
      });
    }
  }

  closeActive() {
    this.activeKind.set(null);
    this.activeChat.set(null);
    this.activeGroup.set(null);
    this.activePeer.set(null);
  }

  // ---------- Group modal ----------
  openGroupModal() {
    this.newGroupName.set('');
    this.newGroupDesc.set('');
    this.selectedMemberIds.set([]);
    this.showGroupModal.set(true);
  }
  closeGroupModal() { this.showGroupModal.set(false); }
  toggleMember(userId: number) {
    this.selectedMemberIds.update((arr) =>
      arr.includes(userId) ? arr.filter((id) => id !== userId) : [...arr, userId],
    );
  }
  isMemberSelected(userId: number) { return this.selectedMemberIds().includes(userId); }
  createGroup() {
    const name = this.newGroupName().trim();
    if (!name || this.selectedMemberIds().length === 0) return;
    this.creatingGroup.set(true);
    this.groupsSvc.create({
      name,
      description: this.newGroupDesc().trim() || undefined,
      memberIds: this.selectedMemberIds(),
    }).subscribe({
      next: (g) => {
        this.groups.update((arr) => [g, ...arr]);
        this.creatingGroup.set(false);
        this.closeGroupModal();
        this.tab.set('groups');
        this.selectGroup(g);
      },
      error: () => {
        this.creatingGroup.set(false);
        this.error.set('Failed to create group');
      },
    });
  }

  logout() { this.authSvc.logout(); }

  startVideoCall() {
    const peer = this.activePeer();
    if (!peer) return;
    this.callSvc.startCall(peer.id, 'video').catch((err) => {
      this.error.set(err?.message ?? 'Could not start call (camera/mic blocked?)');
    });
  }
  startAudioCall() {
    const peer = this.activePeer();
    if (!peer) return;
    this.callSvc.startCall(peer.id, 'audio').catch((err) => {
      this.error.set(err?.message ?? 'Could not start call (mic blocked?)');
    });
  }
}
