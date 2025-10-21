import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { tap } from 'rxjs/operators';

const TOKEN_KEY = 'tb_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private api = inject(ApiService);

  get token(): string | null { return localStorage.getItem(TOKEN_KEY); }
  get isAuthenticated(): boolean { return !!this.token; }

  // Login par username
  loginWithUsername(username: string, password: string) {
    return this.api.login({ username, password }).pipe(
      tap(({ token }) => localStorage.setItem(TOKEN_KEY, token))
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigate(['/admin/login']);
  }
}
