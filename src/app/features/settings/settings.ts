import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { ThemeService, ACCENT_PRESETS, AccentPreset } from '../../core/theme.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  @Output() close = new EventEmitter<void>();

  private auth = inject(AuthService);
  private usersSvc = inject(UsersService);
  private theme = inject(ThemeService);
  private http = inject(HttpClient);

  user = this.auth.user;
  presets = ACCENT_PRESETS;
  accent = this.theme.accent;
  dark = this.theme.dark;
  bg = this.theme.bg;

  fullName = signal(this.user()?.fullName ?? '');
  avatarUrl = signal(this.user()?.avatar ?? '');
  uploading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  uploadInputId = `avatar-${Math.random().toString(36).slice(2, 8)}`;

  pickAccent(p: AccentPreset) { this.theme.setAccent(p); }
  toggleDark() { this.theme.setDark(!this.dark()); }
  pickBg(v: string) { this.theme.setBg(v); }

  async onAvatarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose an image file');
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<{ url: string }>(`${environment.apiBase}/uploads/avatar`, fd).subscribe({
      next: (res) => {
        this.avatarUrl.set(res.url);
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err?.error?.message ?? 'Upload failed');
      },
    });
  }

  save() {
    const name = this.fullName().trim();
    if (!name) { this.error.set('Name cannot be empty'); return; }
    this.saving.set(true);
    this.error.set(null);
    this.usersSvc.updateMe({ fullName: name, avatar: this.avatarUrl() || null }).subscribe({
      next: (u) => {
        this.auth.applyUser(u);
        this.saving.set(false);
        this.close.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Could not save');
      },
    });
  }

  initial() {
    return (this.fullName() || this.user()?.fullName || '?').charAt(0);
  }
}
