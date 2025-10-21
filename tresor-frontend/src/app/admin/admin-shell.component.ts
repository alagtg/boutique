import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive],
  template: `
  <div class="admin-shell">
    <header class="admin-topbar">
      <div class="container">
        <div class="left">

                <!--  <a routerLink="/" class="btn btn-ghost">← Boutique</a>   -->

        </div>
        <div class="right">
                      <nav class="tabs">

               <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Dashboard</a>
            <a routerLink="/admin/produits" routerLinkActive="active">Produits</a>
            <a routerLink="/admin/depenses" routerLinkActive="active">Dépenses</a>
            <a routerLink="/admin/commandes" routerLinkActive="active">Commandes</a>
                      </nav>

        </div>
      </div>
    </header>

    <main class="admin-content">
      <div class="container">
        <router-outlet></router-outlet>
      </div>
    </main>
  </div>
  `,
  styles: [`
    .admin-topbar{position:sticky;top:0;background:#fff;border-bottom:2px solid var(--beige);z-index:10}
    .container{max-width:1100px;margin:0 auto;padding:0 16px}
    .admin-topbar .container{display:flex;align-items:center;justify-content:space-between;padding:10px 0}
    .left{display:flex;align-items:center;gap:16px}
    .brand{font-weight:700}
    .tabs a{margin-right:10px;text-decoration:none}
    .tabs a.active{font-weight:700;border-bottom:2px solid var(--gold)}
    .btn{display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid var(--gold);background:#fff}
    .btn-ghost{border-color:transparent}
    .btn-outline{background:#fff}
    .admin-content{padding:16px 0}
  `]
})
export class AdminShellComponent {
  private auth = inject(AuthService);
  logout(){ this.auth.logout(); }
}
