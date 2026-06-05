import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, AuthUser } from '../auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="oauth-shell">
      @if (error()) {
        <div class="card">
          <h2>Sign-in failed</h2>
          <p>{{ error() }}</p>
          <a routerLink="/login">Back to login</a>
        </div>
      } @else {
        <div class="card">
          <div class="spinner"></div>
          <p>Signing you in…</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .oauth-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; padding: 1rem; }
    .card { background: #fff; padding: 2rem 2.5rem; border-radius: 14px; box-shadow: 0 6px 24px rgba(0,0,0,.08); text-align: center; max-width: 360px; }
    h2 { margin: 0 0 .5rem; font-size: 1.2rem; }
    p { margin: .5rem 0 0; color: #475569; }
    a { color: #2563eb; text-decoration: none; font-weight: 600; }
    .spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin .8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class OAuthCallback implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  error = signal<string | null>(null);

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const token = params.get('token');
    const errParam = params.get('error');

    if (errParam) {
      this.error.set('Social sign-in was cancelled or failed.');
      return;
    }
    if (!token) {
      this.error.set('Missing authentication token.');
      return;
    }

    localStorage.setItem('sc_token', token);

    this.http
      .get<AuthUser>(`${environment.apiBase}/auth/me`)
      .subscribe({
        next: (user) => {
          this.auth.applySession(token, user);
          this.router.navigateByUrl('/chat');
        },
        error: () => {
          localStorage.removeItem('sc_token');
          this.error.set('Could not load your account. Please try again.');
        },
      });
  }
}
