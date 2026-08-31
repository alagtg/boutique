import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from './core/auth.service';
import { StoreService } from './core/store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf],
  template: `
    <ng-container *ngIf="!isPublicRoute(); else publicOnly">
      <div class="layout">
        <aside class="sidebar">
          <div class="brand-block">
            <img src="/assets/logo.png" alt="Tresor logo">
            <div>
              <div class="brand-title">{{ storeName() }}</div>
              <div class="brand-sub">Admin - Employe - Client - POS</div>
            </div>
          </div>

          <nav class="nav">
            <a routerLink="/admin/dashboard" routerLinkActive="active">Dashboard</a>
            <a routerLink="/admin/products" routerLinkActive="active">Produits & code-barres</a>
            <a *ngIf="isAdmin()" routerLink="/admin/stock-purchases" routerLinkActive="active">Achats de stock</a>
            <a routerLink="/admin/customers" routerLinkActive="active">Clients & fidelite</a>
            <a *ngIf="isAdmin()" routerLink="/admin/sales" routerLinkActive="active">Ventes / facture mois</a>
            <a *ngIf="isAdmin()" routerLink="/admin/expenses" routerLinkActive="active">Depenses ligne par ligne</a>
            <a routerLink="/employee/pos" routerLinkActive="active">POS caisse desktop</a>
            <a routerLink="/employee/reservations" routerLinkActive="active">Reservations</a>
            <a routerLink="/client/loyalty" routerLinkActive="active">Espace fidelite</a>
            <a routerLink="/client/wheel" routerLinkActive="active">Roue</a>
            <a *ngIf="isAdmin()" routerLink="/admin/settings" routerLinkActive="active">Parametres boutique</a>
            <a routerLink="/qr-client" routerLinkActive="active">Formulaire QR client</a>
          </nav>

          <div style="margin-top:24px" class="user-panel">
            <div style="font-weight:800">{{ auth.fullName() || 'Utilisateur' }}</div>
            <div class="subtitle">{{ auth.role() || '-' }}</div>
            <button class="btn secondary" style="margin-top:12px;width:100%" (click)="logout()">Deconnexion</button>
          </div>
        </aside>

        <main class="content">
          <div class="topbar">
            <div>
              <h1 class="page-title">{{ storeName() }}</h1>
              <div class="subtitle">Application boutique V2 - QR client, POS, stock, fidelite et rapports admin.</div>
            </div>
            <div class="toolbar-actions">
              <a class="btn secondary" routerLink="/employee/pos">Ouvrir caisse</a>
              <a class="btn" routerLink="/qr-client">QR client</a>
            </div>
          </div>
          <router-outlet></router-outlet>
        </main>
      </div>
    </ng-container>

    <ng-template #publicOnly>
      <router-outlet></router-outlet>
    </ng-template>
  `
})
export class AppComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  store = inject(StoreService);
  storeName = computed(() => this.store.settings()?.storeName ?? 'Tresor Boutique');

  constructor() {
    this.store.load();
  }

  isPublicRoute() {
    return this.router.url.startsWith('/login') || this.router.url.startsWith('/qr-client') || this.router.url.startsWith('/client/wheel');
  }

  isAdmin() {
    return this.auth.role() === 'ADMIN';
  }

  logout() {
    this.auth.logout();
  }
}
