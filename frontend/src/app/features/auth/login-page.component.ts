import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <div class="login-shell">
      <div class="card login-card">
        <div class="brand-block" style="margin-bottom:18px">
          <img src="/assets/logo.png" alt="Tresor logo">
          <div>
            <div class="brand-title">Trésor Boutique</div>
            <div class="brand-sub">Connexion admin / employé</div>
          </div>
        </div>

        <div class="hero-card" style="margin-bottom:16px">
          <strong>Version V2</strong>
          <div class="muted" style="margin-top:6px">Thème blanc/gold, dépenses détaillées, ventes mensuelles, QR client et POS desktop pour douchette code-barres.</div>
        </div>

        <div class="form-grid" style="grid-template-columns:1fr">
          <input class="input" [(ngModel)]="username" placeholder="Nom d'utilisateur">
          <input class="input" [(ngModel)]="password" type="password" placeholder="Mot de passe">
        </div>

        <button class="btn" style="width:100%;margin-top:16px" (click)="login()">Se connecter</button>

        <p *ngIf="error" class="badge danger" style="margin-top:8px">{{ error }}</p>
      </div>
    </div>
  `
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  error = '';

  login() {
    this.error = '';
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate([this.auth.role() === 'ADMIN' ? '/admin/dashboard' : '/employee/pos']),
      error: (err) => this.error = err?.error?.message || 'Connexion impossible'
    });
  }
}
