import { Injectable, signal, effect } from '@angular/core';

export interface AccentPreset {
  id: string;
  name: string;
  from: string;
  to: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'sunset', name: 'Sunset',  from: '#6366f1', to: '#ec4899' },
  { id: 'ocean',  name: 'Ocean',   from: '#06b6d4', to: '#3b82f6' },
  { id: 'forest', name: 'Forest',  from: '#10b981', to: '#06b6d4' },
  { id: 'mango',  name: 'Mango',   from: '#f59e0b', to: '#ef4444' },
  { id: 'grape',  name: 'Grape',   from: '#8b5cf6', to: '#d946ef' },
  { id: 'mono',   name: 'Mono',    from: '#475569', to: '#0f172a' },
];

const KEY_ACCENT = 'sc_accent';
const KEY_DARK = 'sc_dark';
const KEY_BG = 'sc_bg';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly accent = signal<AccentPreset>(this.readAccent());
  readonly dark = signal<boolean>(localStorage.getItem(KEY_DARK) === '1');
  readonly bg = signal<string>(localStorage.getItem(KEY_BG) ?? 'aurora');

  private styleEl: HTMLStyleElement;

  constructor() {
    this.styleEl = document.createElement('style');
    this.styleEl.id = 'sc-theme';
    document.head.appendChild(this.styleEl);
    effect(() => this.apply());
  }

  setAccent(p: AccentPreset) {
    this.accent.set(p);
    localStorage.setItem(KEY_ACCENT, p.id);
  }
  setDark(v: boolean) {
    this.dark.set(v);
    localStorage.setItem(KEY_DARK, v ? '1' : '0');
  }
  setBg(v: string) {
    this.bg.set(v);
    localStorage.setItem(KEY_BG, v);
  }

  private readAccent(): AccentPreset {
    const id = localStorage.getItem(KEY_ACCENT);
    return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
  }

  private apply() {
    const a = this.accent();
    const dark = this.dark();
    const bg = this.bg();

    const grad = `linear-gradient(135deg, ${a.from}, ${a.to})`;
    const shadow = `0 8px 20px -6px ${a.to}80`;

    const bgs: Record<string, string> = {
      aurora: `radial-gradient(circle at 20% 20%, ${a.from}22 0%, transparent 40%), radial-gradient(circle at 80% 80%, ${a.to}22 0%, transparent 45%), #f6f7fb`,
      mesh: `radial-gradient(circle at 80% 0%, ${a.from}33 0%, transparent 50%), radial-gradient(circle at 0% 100%, ${a.to}33 0%, transparent 50%), #f6f7fb`,
      plain: `#f6f7fb`,
    };
    const darkBgs: Record<string, string> = {
      aurora: `radial-gradient(circle at 20% 20%, ${a.from}33 0%, transparent 40%), radial-gradient(circle at 80% 80%, ${a.to}33 0%, transparent 45%), #0f172a`,
      mesh: `radial-gradient(circle at 80% 0%, ${a.from}44 0%, transparent 50%), radial-gradient(circle at 0% 100%, ${a.to}44 0%, transparent 50%), #0f172a`,
      plain: `#0f172a`,
    };

    const accentRules = `
      :root {
        --sc-accent-from: ${a.from};
        --sc-accent-to: ${a.to};
        --sc-accent-grad: ${grad};
        --sc-accent-shadow: ${shadow};
      }
      .avatar.gradient,
      .send,
      .modal-actions .primary,
      .header-logout.primary,
      .call-btn.primary,
      .row.active::before,
      .ringer-actions .btn-accept,
      .auth-submit,
      .btn-primary { background: ${grad} !important; }
      .send, .modal-actions .primary, .call-btn.primary { box-shadow: ${shadow} !important; }
      .row.active { background: ${a.from}1A !important; }
      .row:hover { background: ${a.from}10 !important; }
      .search input:focus, .composer input:focus, .field input[type='text']:focus, .field input[type='email']:focus, .field input[type='password']:focus { border-color: ${a.from} !important; box-shadow: 0 0 0 4px ${a.from}26 !important; }
      .tabs button.active { color: ${a.from}; }
      .bubble .sender { color: ${a.from}; }
      .msg.mine .bubble { background: ${grad} !important; }
      .chat-shell { background: ${dark ? darkBgs[bg] : bgs[bg]} !important; }
    `;

    const darkRules = dark ? `
      body { background: #0f172a !important; color: #e2e8f0 !important; }
      .sidebar, .main-header, .composer { background: rgba(15,23,42,.78) !important; border-color: rgba(255,255,255,.06) !important; color: #e2e8f0; }
      .main { background: rgba(15,23,42,.4) !important; }
      .me-name, .row-name, .peer-name, .empty h2 { color: #f1f5f9 !important; }
      .me-status, .row-sub, .peer-status, .muted, .empty p { color: #94a3b8 !important; }
      .search input, .composer input, .field input, .member-picker { background: #1e293b !important; color: #e2e8f0 !important; border-color: rgba(255,255,255,.08) !important; }
      .tabs button { color: #94a3b8; }
      .tabs button.active { background: #1e293b !important; }
      .row:hover { background: rgba(255,255,255,.05) !important; }
      .header-logout { background: #1e293b !important; color: #cbd5e1 !important; border-color: rgba(255,255,255,.08) !important; }
      .bubble { background: #1e293b !important; border-color: rgba(255,255,255,.06) !important; color: #e2e8f0; }
      .modal { background: #1e293b !important; color: #e2e8f0 !important; }
      .modal h2, .field > span { color: #f1f5f9 !important; }
      .modal-actions .ghost { background: #0f172a !important; border-color: rgba(255,255,255,.08) !important; color: #e2e8f0 !important; }
      .composer-icon, .mini-btn, .call-btn { background: #1e293b !important; color: #cbd5e1 !important; }
      .messages { background: transparent !important; }
    ` : '';

    this.styleEl.textContent = accentRules + darkRules;
  }
}
