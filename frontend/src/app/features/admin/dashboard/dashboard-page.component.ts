import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../../core/data.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink],
  template: `
    <div *ngIf="summary(); else dashboardState">
      <section class="dashboard-hero">
        <div>
          <span class="eyebrow">Pilotage boutique</span>
          <h2>{{ isAdmin() ? 'Vue complete de la journee' : 'Espace equipe boutique' }}</h2>
          <p>{{ isAdmin() ? 'Ventes, depenses, clients VIP, alertes stock et reservations a suivre en un seul ecran.' : 'Acces rapide a la caisse, au stock, aux clients et aux reservations sans indicateurs financiers.' }}</p>
        </div>
        <div class="hero-metrics" *ngIf="isAdmin(); else employeeHero">
          <div>
            <span>Marge mois</span>
            <strong [class.negative]="summary()?.profitMonth < 0">{{ money(summary()?.profitMonth) }}</strong>
          </div>
          <div>
            <span>Clients VIP</span>
            <strong>{{ summary()?.vipCustomers }}</strong>
          </div>
        </div>
        <a class="btn bi-open-button" *ngIf="isAdmin()" routerLink="/admin/bi-dashboard">Ouvrir Dashboard BI</a>
        <ng-template #employeeHero>
          <div class="hero-metrics">
            <div>
              <span>Stock faible</span>
              <strong>{{ summary()?.lowStock }}</strong>
            </div>
            <div>
              <span>Reservations</span>
              <strong>{{ summary()?.reservationsLate }}</strong>
            </div>
          </div>
        </ng-template>
      </section>

      <div class="grid grid-4" *ngIf="isAdmin(); else employeeMetrics">
        <div class="metric-card">
          <span>CA du jour</span>
          <strong>{{ money(summary()?.salesToday) }}</strong>
          <small>Encaissements aujourd'hui</small>
          <div class="mini-profit">Achat {{ money(summary()?.productProfitToday?.purchaseTotal) }} - Gain {{ money(summary()?.productProfitToday?.profit) }}</div>
        </div>
        <div class="metric-card">
          <span>CA semaine</span>
          <strong>{{ money(summary()?.salesWeek) }}</strong>
          <small>Ventes de la semaine</small>
          <div class="mini-profit">Achat {{ money(summary()?.productProfitWeek?.purchaseTotal) }} - Gain {{ money(summary()?.productProfitWeek?.profit) }}</div>
        </div>
        <div class="metric-card">
          <span>CA du mois</span>
          <strong>{{ money(summary()?.salesMonth) }}</strong>
          <small>Ventes mensuelles</small>
          <div class="mini-profit">Achat {{ money(summary()?.productProfitSalesMonth?.purchaseTotal) }} - Gain {{ money(summary()?.productProfitSalesMonth?.profit) }}</div>
        </div>
        <div class="metric-card warning">
          <span>Depenses mois</span>
          <strong>{{ money(summary()?.expensesMonth) }}</strong>
          <small>Charges et achats stock</small>
        </div>
        <div class="metric-card success">
          <span>Difference CA - charges</span>
          <strong [class.negative]="summary()?.profitMonth < 0">{{ money(summary()?.profitMonth) }}</strong>
          <small>Mois en cours</small>
          <div class="mini-profit">CA {{ money(summary()?.salesMonth) }} - Charges {{ money(summary()?.expensesMonth) }}</div>
        </div>
        <div class="metric-card success">
          <span>Gain potentiel stock</span>
          <strong>{{ money(summary()?.stockPotentialProfit) }}</strong>
          <small>Si tout le stock est vendu</small>
          <div class="mini-profit">Achat stock {{ money(summary()?.stockPurchaseValue) }} - Vente stock {{ money(summary()?.stockSaleValue) }}</div>
        </div>
      </div>

      <ng-template #employeeMetrics>
        <div class="grid grid-4">
          <div class="metric-card">
            <span>Articles stock faible</span>
            <strong>{{ summary()?.lowStock }}</strong>
            <small>A controler avant la vente</small>
          </div>
          <div class="metric-card warning">
            <span>Reservations en retard</span>
            <strong>{{ summary()?.reservationsLate }}</strong>
            <small>Clients a relancer</small>
          </div>
          <div class="metric-card">
            <span>Clients VIP</span>
            <strong>{{ summary()?.vipCustomers }}</strong>
            <small>Service prioritaire</small>
          </div>
          <div class="metric-card success">
            <span>Clients total</span>
            <strong>{{ summary()?.totalCustomers }}</strong>
            <small>Base fidelite</small>
          </div>
        </div>
      </ng-template>

      <div class="split" style="margin-top:18px">
        <div class="card" *ngIf="isAdmin()">
          <div class="section-title">
            <h3>Controle boutique</h3>
            <span class="badge danger" *ngIf="summary()?.creditAlerts">Credits &gt; 300 DT : {{ summary()?.creditAlerts }}</span>
          </div>
          <div class="status-grid">
            <div class="status-item danger">
              <span>Reservations en retard</span>
              <strong>{{ summary()?.reservationsLate }}</strong>
            </div>
            <div class="status-item warning">
              <span>Articles stock faible</span>
              <strong>{{ summary()?.lowStock }}</strong>
            </div>
            <div class="status-item">
              <span>Clients VIP</span>
              <strong>{{ summary()?.vipCustomers }}</strong>
            </div>
            <div class="status-item">
              <span>Clients total</span>
              <strong>{{ summary()?.totalCustomers }}</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Articles a reapprovisionner</h3>
          <div class="quick-list" *ngIf="summary()?.lowStockItems?.length; else noStockAlert">
            <div class="quick-item" *ngFor="let item of summary()?.lowStockItems">
              <strong>{{ item.productName }}</strong><br>
              <span class="muted">{{ item.barcode }}</span><br>
              <span class="badge danger">Stock {{ item.currentStock }} / seuil {{ item.minStock }}</span>
            </div>
          </div>
          <ng-template #noStockAlert>
            <p class="muted">Aucune alerte stock pour le moment.</p>
          </ng-template>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="card" *ngIf="isAdmin()">
          <div class="section-title">
            <h3>Ventes par employe</h3>
            <span class="badge">Mois en cours</span>
          </div>
          <div class="quick-list">
            <div class="quick-item" *ngFor="let e of summary()?.employeePerformance">
              <div class="section-title">
                <div>
                  <strong>{{ e.employee }}</strong>
                  <div class="muted">{{ e.quantity }} article(s) - CA {{ money(e.salesTotal) }}</div>
                  <div class="mini-profit">Achat {{ money(e.purchaseTotal) }} - Gain {{ money(e.profit) }}</div>
                </div>
              <a class="btn secondary" routerLink="/admin/sales" [queryParams]="{ year: year, month: month }">Voir ventes</a>
              </div>
              <div class="reserved-line" *ngFor="let p of e.products">
                {{ p.productName }} - {{ p.quantity }} pcs - {{ money(p.salesTotal) }}
              </div>
            </div>
          </div>
        </div>

        <div class="card" *ngIf="isAdmin()">
          <h3>Top benefices produits</h3>
          <table class="table">
            <thead><tr><th>Produit</th><th>Qte</th><th>Gain</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of summary()?.topProductProfits">
                <td>{{ p.productName }}</td>
                <td>{{ p.quantity }}</td>
                <td>{{ money(p.profit) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3>Top clients du mois</h3>
          <table class="table">
            <thead><tr><th>Client</th><th>Depense mois</th></tr></thead>
            <tbody>
              <tr *ngFor="let c of summary()?.topCustomers">
                <td>{{ c.name }}</td>
                <td>{{ money(c.totalSpentCurrentMonth) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="action-panel">
          <span class="eyebrow">Actions rapides</span>
          <h3>Faire vivre la boutique</h3>
          <p class="muted">Scanne une vente, consulte les depenses ou ajoute un article pour tester le parcours complet client et caisse.</p>
          <div class="toolbar-actions">
            <a class="btn" routerLink="/employee/pos">Aller a la caisse</a>
            <a class="btn secondary" routerLink="/admin/products">Stock</a>
            <a class="btn secondary" *ngIf="isAdmin()" routerLink="/admin/expenses">Depenses</a>
          </div>
        </div>
      </div>
    </div>

    <ng-template #dashboardState>
      <div class="empty-state" *ngIf="!error(); else dashboardError">
        <div class="spinner"></div>
        <strong>Chargement dashboard...</strong>
        <span>Connexion a l'API et preparation des indicateurs.</span>
      </div>
      <ng-template #dashboardError>
        <div class="empty-state error">
          <strong>Dashboard indisponible</strong>
          <span>{{ error() }}</span>
          <div class="toolbar-actions">
            <button class="btn" (click)="load()">Reessayer</button>
            <a class="btn secondary" routerLink="/login">Se reconnecter</a>
          </div>
        </div>
      </ng-template>
    </ng-template>
  `
})
export class DashboardPageComponent {
  private data = inject(DataService);
  private auth = inject(AuthService);
  summary = signal<any>(null);
  error = signal('');
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;

  constructor() {
    this.load();
  }

  load() {
    this.error.set('');
    this.data.dashboardSummary('month', this.year, this.month).subscribe({
      next: v => this.summary.set(v),
      error: err => {
        this.summary.set(null);
        this.error.set(err?.status === 0
          ? 'API backend non joignable. Lance le backend .NET puis reessaie.'
          : err?.status === 401
            ? 'Session expiree ou token invalide. Reconnecte-toi avec admin / Admin@123.'
            : err?.error?.message || 'Impossible de charger les donnees du dashboard.');
      }
    });
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }

  isAdmin() {
    return this.auth.role() === 'ADMIN';
  }
}
