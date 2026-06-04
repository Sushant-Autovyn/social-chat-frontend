import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/theme.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('social-chat-ui');
  // Eagerly construct ThemeService so saved theme is applied before any view renders.
  private theme = inject(ThemeService);
  private swUpdate = inject(SwUpdate);

  installEvent = signal<BeforeInstallPromptEvent | null>(null);
  showInstall = signal(false);
  showUpdate = signal(false);

  ngOnInit(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installEvent.set(e as BeforeInstallPromptEvent);
      if (sessionStorage.getItem('sc_install_dismissed') !== '1') {
        this.showInstall.set(true);
      }
    });
    window.addEventListener('appinstalled', () => {
      this.installEvent.set(null);
      this.showInstall.set(false);
    });

    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => this.showUpdate.set(true));
    }
  }

  async install() {
    const ev = this.installEvent();
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    this.installEvent.set(null);
    this.showInstall.set(false);
  }

  dismissInstall() {
    sessionStorage.setItem('sc_install_dismissed', '1');
    this.showInstall.set(false);
  }

  async applyUpdate() {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}
