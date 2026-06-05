import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly permission = signal<NotificationPermission>(this.read());
  private audioCtx: AudioContext | null = null;
  private audioUnlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.ensureAudioContext();
        this.audioCtx?.resume?.().catch(() => undefined);
        this.audioUnlocked = true;
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    }
  }

  /**
   * Ask the browser for permission to show notifications. Safe to call
   * multiple times; resolves with the resulting permission state.
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission !== 'default') {
      this.permission.set(Notification.permission);
      return Notification.permission;
    }
    const result = await Notification.requestPermission();
    this.permission.set(result);
    return result;
  }

  /**
   * Show a notification for an incoming message. The browser notification
   * is suppressed when the tab is focused; the sound always plays.
   */
  notifyMessage(opts: {
    title: string;
    body: string;
    icon?: string | null;
    onClick?: () => void;
  }): void {
    this.beep();

    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      document.hasFocus()
    ) {
      return;
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const n = new Notification(opts.title, {
        body: opts.body,
        icon: opts.icon ?? '/icons/icon-192.png',
        tag: 'social-chat-message',
        renotify: true,
      } as NotificationOptions);
      n.onclick = () => {
        window.focus();
        opts.onClick?.();
        n.close();
      };
    } catch {
      // older browsers throw on tag/renotify; ignore
    }
  }

  private beep(): void {
    try {
      this.ensureAudioContext();
      const ctx = this.audioCtx;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume?.().catch(() => undefined);
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        660,
        ctx.currentTime + 0.18,
      );
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.32,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore
    }
  }

  private ensureAudioContext(): void {
    if (this.audioCtx) return;
    try {
      type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctx =
        window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (Ctx) this.audioCtx = new Ctx();
    } catch {
      // ignore
    }
  }

  private read(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }
}
