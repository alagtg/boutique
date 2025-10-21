import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
  <!-- ✅ TOPBAR -->
  <header class="topbar">
    <div class="container nav">
      <a class="brand" routerLink="/">
        <img src="assets/logo.png" alt="Trésor Boutique">
        <span class="title">Trésor Boutique</span>
      </a>

      <!-- ✅ MENU BURGER MOBILE -->
      <button class="menu-toggle" (click)="toggleMenu()">
        <span [class.open]="menuOpen"></span>
        <span [class.open]="menuOpen"></span>
        <span [class.open]="menuOpen"></span>
      </button>

      <nav class="menu" [class.open]="menuOpen">
        <a routerLink="/" routerLinkActive="active" (click)="closeMenu()">Accueil</a>
      <!--  <a routerLink="/produits" routerLinkActive="active" (click)="closeMenu()">Produits</a>-->
        <a routerLink="/contact" routerLinkActive="active" (click)="closeMenu()">Contact</a>

        <ng-container *ngIf="auth.isAuthenticated; else guest">
          <a routerLink="/admin" class="btn" (click)="closeMenu()">Admin</a>
          <button class="btn ghost" (click)="logout()">Se déconnecter</button>
        </ng-container>
        <ng-template #guest>
          <a routerLink="/admin/login" class="btn" (click)="closeMenu()">Admin</a>
        </ng-template>
      </nav>
    </div>
  </header>

  <router-outlet></router-outlet>

  <!-- ✅ FOOTER -->
  <footer>
    <div class="container">
      <div class="card-grid">
        <div>
          <div class="section-title">À propos</div>
          <p>Trésor Boutique – Élégance, féminité et charme à Djerba.</p>
        </div>
        <div>
          <div class="section-title">Coordonnées</div>
          <p>Téléphone / WhatsApp : +216 50 878 068<br>Email : contact&#64;tresor-boutique.tn</p>
        </div>
        <div>
          <div class="section-title">Adresse</div>
          <p>Djerba, Tunisie</p>
        </div>
      </div>
      <p class="small">© 2025 Trésor Boutique. Tous droits réservés.</p>
    </div>
  </footer>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  auth = inject(AuthService);
  menuOpen = false;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  logout() {
    this.auth.logout();
    this.closeMenu();
  }
}
