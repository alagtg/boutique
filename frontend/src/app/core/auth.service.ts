import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { API_BASE_URL } from './api.config';
import { tap } from 'rxjs';

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'tresor_token';
  private readonly roleKey = 'tresor_role';
  private readonly nameKey = 'tresor_name';
  private readonly userIdKey = 'tresor_user_id';

  token = signal(localStorage.getItem(this.tokenKey));
  role = signal(localStorage.getItem(this.roleKey));
  fullName = signal(localStorage.getItem(this.nameKey));
  userId = signal(Number(localStorage.getItem(this.userIdKey) || '0'));

  isLoggedIn = computed(() => !!this.token());

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string) {
    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.roleKey, res.role);
        localStorage.setItem(this.nameKey, res.fullName);
        localStorage.setItem(this.userIdKey, String(res.userId));
        this.token.set(res.token);
        this.role.set(res.role);
        this.fullName.set(res.fullName);
        this.userId.set(res.userId);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.nameKey);
    localStorage.removeItem(this.userIdKey);
    this.token.set(null);
    this.role.set(null);
    this.fullName.set(null);
    this.userId.set(0);
    this.router.navigate(['/login']);
  }
}
