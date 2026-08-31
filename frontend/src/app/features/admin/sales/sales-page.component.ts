import { Component, inject, signal } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../../core/data.service';
import { API_BASE_URL } from '../../../core/api.config';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DatePipe, RouterLink],
  template: `
    <section class="page-band">
      <div>
        <span class="eyebrow">Admin</span>
        <h2>Historique des ventes</h2>
        <p>Suivi facture du mois, paiements, reste a payer et detail des articles vendus.</p>
      </div>
      <div class="toolbar-actions">
        <input class="input compact" type="number" [(ngModel)]="year">
        <input class="input compact" type="number" [(ngModel)]="month">
        <input class="input" style="width:170px" type="date" [(ngModel)]="dateFrom">
        <input class="input" style="width:170px" type="date" [(ngModel)]="dateTo">
        <button class="btn" (click)="load()">Filtrer</button>
      </div>
    </section>

    <div class="empty-state error" *ngIf="error()">
      <strong>Impossible de charger les ventes</strong>
      <span>{{ error() }}</span>
      <button class="btn" (click)="load()">Reessayer</button>
    </div>

    <div class="grid grid-4" *ngIf="invoice() as inv">
      <div class="metric-card">
        <span>Nombre ventes</span>
        <strong>{{ inv.salesCount }}</strong>
        <small>{{ inv.month }}/{{ inv.year }}</small>
      </div>
      <div class="metric-card success">
        <span>Total ventes</span>
        <strong>{{ money(inv.salesTotal) }}</strong>
        <small>Chiffre facture</small>
      </div>
      <div class="metric-card">
        <span>Total encaisse</span>
        <strong>{{ money(inv.paidTotal) }}</strong>
        <small>Paiements recus</small>
      </div>
      <div class="metric-card warning">
        <span>Reste</span>
        <strong>{{ money(inv.remainingTotal) }}</strong>
        <small>Credits vente</small>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:18px" *ngIf="invoice() as inv">
      <div class="card">
        <h3>Par moyen de paiement</h3>
        <div class="quick-list">
          <div class="quick-item" *ngFor="let p of inv.byPaymentMethod">
            {{ p.paymentMethod }} <strong style="float:right">{{ money(p.total) }}</strong>
          </div>
        </div>
      </div>

      <div class="action-panel">
        <span class="eyebrow">Controle</span>
        <h3>Facture mensuelle</h3>
        <p class="muted">La liste ci-dessous affiche chaque vente avec son client, employe et articles. Elle supporte plusieurs ventes sans erreur.</p>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-title">
        <h3>Ventes ligne par ligne</h3>
        <span class="badge">{{ sales().length }} vente(s) {{ periodLabel() }}</span>
      </div>

      <table class="table">
        <thead>
          <tr><th>N</th><th>Date</th><th>Client</th><th>Employe</th><th>Articles</th><th>Total</th><th>Paye</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of sales()">
            <td>{{ s.saleNumber }}</td>
            <td>{{ s.saleDate | date:'yyyy-MM-dd HH:mm' }}</td>
            <td>{{ s.customer || '-' }}</td>
            <td>{{ s.employee }}</td>
            <td>
              <div class="sale-line" *ngFor="let line of s.lines">
                <span class="line-photo">
                  <img *ngIf="line.imageUrl; else saleNoImage" [src]="imageUrl(line.imageUrl)" [alt]="line.productName">
                  <ng-template #saleNoImage>{{ initials(line.productName) }}</ng-template>
                </span>
                <span>{{ line.productName }}<br><small>{{ line.quantity }} x {{ money(line.unitPrice) }}</small></span>
              </div>
            </td>
            <td><strong>{{ money(s.totalAmount) }}</strong></td>
            <td>{{ money(s.paidAmount) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="period-panel">
      <div class="card">
        <div class="section-title">
          <div>
            <h3>Vue periode</h3>
            <span class="muted">Clique pour voir jour, semaine, mois, annee ou tout l'historique.</span>
          </div>
          <div class="toolbar-actions">
            <button class="btn secondary" [class.active-filter]="range === 'day'" (click)="setRange('day')">Jour</button>
            <button class="btn secondary" [class.active-filter]="range === 'week'" (click)="setRange('week')">Semaine</button>
            <button class="btn secondary" [class.active-filter]="range === 'month'" (click)="setRange('month')">Mois</button>
            <button class="btn secondary" [class.active-filter]="range === 'year'" (click)="setRange('year')">Annee</button>
            <button class="btn secondary" [class.active-filter]="range === 'all'" (click)="setRange('all')">Tout</button>
          </div>
        </div>
        <div class="period-toolbar" *ngIf="range === 'day' || range === 'week'">
          <input class="input" style="width:170px" type="date" [(ngModel)]="selectedDate">
          <button class="btn" (click)="loadPeriod()">Appliquer</button>
          <a class="btn secondary" routerLink="/admin/sales" [queryParams]="salesHistoryQuery()">Voir historique ventes</a>
        </div>
        <div class="period-toolbar" *ngIf="range === 'month' || range === 'year'">
          <input class="input compact" type="number" [(ngModel)]="year">
          <input class="input compact" *ngIf="range === 'month'" type="number" min="1" max="12" [(ngModel)]="month">
          <button class="btn" (click)="loadPeriod()">Appliquer</button>
          <a class="btn secondary" routerLink="/admin/sales" [queryParams]="salesHistoryQuery()">Voir historique ventes</a>
        </div>
        <div class="period-toolbar" *ngIf="range === 'all'">
          <button class="btn" (click)="loadPeriod()">Appliquer</button>
          <a class="btn secondary" routerLink="/admin/sales" [queryParams]="salesHistoryQuery()">Voir tout l'historique ventes</a>
        </div>
      </div>

      <div class="grid grid-4" style="margin-top:18px" *ngIf="summary() as dash">
        <div class="metric-card">
          <span>CA du jour</span>
          <strong>{{ money(dash.salesToday) }}</strong>
          <small>Encaissements aujourd'hui</small>
          <div class="mini-profit">Achat {{ money(dash.productProfitToday?.purchaseTotal) }} - Gain {{ money(dash.productProfitToday?.profit) }}</div>
        </div>
        <div class="metric-card">
          <span>CA semaine</span>
          <strong>{{ money(dash.salesWeek) }}</strong>
          <small>Ventes de la semaine</small>
          <div class="mini-profit">Achat {{ money(dash.productProfitWeek?.purchaseTotal) }} - Gain {{ money(dash.productProfitWeek?.profit) }}</div>
        </div>
        <div class="metric-card">
          <span>CA du mois</span>
          <strong>{{ money(dash.salesMonth) }}</strong>
          <small>Ventes mensuelles</small>
          <div class="mini-profit">Achat {{ money(dash.productProfitSalesMonth?.purchaseTotal) }} - Gain {{ money(dash.productProfitSalesMonth?.profit) }}</div>
        </div>
        <div class="metric-card warning">
          <span>Depenses mois</span>
          <strong>{{ money(dash.expensesMonth) }}</strong>
          <small>Charges et achats stock</small>
        </div>
        <div class="metric-card success">
          <span>Gain potentiel stock</span>
          <strong>{{ money(dash.stockPotentialProfit) }}</strong>
          <small>Si tout le stock est vendu</small>
          <div class="mini-profit">Achat stock {{ money(dash.stockPurchaseValue) }} - Vente stock {{ money(dash.stockSaleValue) }}</div>
        </div>
        <div class="metric-card success">
          <span>{{ periodTitle() }}</span>
          <strong>{{ money(dash.selectedPeriod?.salesTotal) }}</strong>
          <small>{{ dash.selectedPeriod?.quantity || 0 }} article(s) vendu(s)</small>
          <div class="mini-profit">Achat {{ money(dash.selectedPeriod?.purchaseTotal) }} - Gain {{ money(dash.selectedPeriod?.profit) }}</div>
        </div>
        <div class="metric-card success">
          <span>Difference CA - charges</span>
          <strong [class.negative]="dash.selectedPeriod?.resultAfterExpenses < 0">{{ money(dash.selectedPeriod?.resultAfterExpenses) }}</strong>
          <small>{{ periodTitle() }}</small>
          <div class="mini-profit">CA {{ money(dash.selectedPeriod?.salesTotal) }} - Charges {{ money(dash.selectedPeriod?.expensesTotal) }}</div>
        </div>
        <div class="metric-card">
          <span>CA annee</span>
          <strong>{{ money(dash.salesYear) }}</strong>
          <small>Annee en cours</small>
        </div>
      </div>
    </section>
  `
})
export class SalesPageComponent {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  private assetBaseUrl = API_BASE_URL.replace('/api', '');
  sales = signal<any[]>([]);
  invoice = signal<any>(null);
  summary = signal<any>(null);
  error = signal('');
  range = 'month';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  dateFrom = '';
  dateTo = '';
  selectedDate = new Date().toISOString().slice(0, 10);

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    this.year = Number(params.get('year') || this.year);
    this.month = Number(params.get('month') || this.month);
    this.dateFrom = params.get('dateFrom') || '';
    this.dateTo = params.get('dateTo') || '';
    if (params.get('all')) {
      this.year = 0;
      this.month = 0;
    }
    this.load();
    this.loadPeriod();
  }

  load() {
    this.error.set('');
    const y = this.year || undefined;
    const m = this.month || undefined;
    this.data.sales(y, m, this.dateFrom || undefined, this.dateTo || undefined).subscribe({
      next: v => this.sales.set(v),
      error: err => this.error.set(err?.error?.message || 'Erreur ventes')
    });
    if (this.year && this.month) {
      this.data.salesMonthlyInvoice(this.year, this.month).subscribe({
        next: v => this.invoice.set(v),
        error: err => this.error.set(err?.error?.message || 'Erreur facture mensuelle')
      });
    } else {
      this.invoice.set(null);
    }
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }

  imageUrl(path: string) {
    return path.startsWith('http') ? path : `${this.assetBaseUrl}${path}`;
  }

  initials(name: string) {
    return (name || 'TB').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }

  periodLabel() {
    if (this.dateFrom || this.dateTo) return `du ${this.dateFrom || 'debut'} au ${this.dateTo || 'fin'}`;
    if (this.year && this.month) return `${this.month}/${this.year}`;
    if (this.year) return `${this.year}`;
    return 'tout historique';
  }

  setRange(value: string) {
    this.range = value;
    this.loadPeriod();
  }

  loadPeriod() {
    this.data.dashboardSummary(this.range, this.year, this.month, this.selectedDate).subscribe({
      next: v => this.summary.set(v),
      error: err => this.error.set(err?.error?.message || 'Erreur vue periode')
    });
  }

  periodTitle() {
    if (this.range === 'day') return `Periode jour ${this.selectedDate}`;
    if (this.range === 'week') return `Periode semaine ${this.selectedDate}`;
    if (this.range === 'year') return `Periode annee ${this.year}`;
    if (this.range === 'all') return 'Tout historique';
    return `Periode mois ${this.month}/${this.year}`;
  }

  salesHistoryQuery() {
    if (this.range === 'day') {
      return { dateFrom: this.selectedDate, dateTo: this.addDays(this.selectedDate, 1) };
    }

    if (this.range === 'week') {
      const start = this.weekStart(this.selectedDate);
      return { dateFrom: start, dateTo: this.addDays(start, 7) };
    }

    if (this.range === 'year') return { year: this.year };
    if (this.range === 'all') return { all: 1 };
    return { year: this.year, month: this.month };
  }

  private addDays(value: string, days: number) {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private weekStart(value: string) {
    const date = new Date(`${value}T00:00:00`);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date.toISOString().slice(0, 10);
  }
}
