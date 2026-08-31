import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataService } from '../../../core/data.service';

@Component({
  selector: 'app-bi-dashboard-page',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink],
  template: `
    <div class="bi-page">
      <header class="bi-header">
        <div>
          <span class="eyebrow">Tresor Boutique Intelligence</span>
          <h2>Analyse complete de l'activite</h2>
          <p>Ventes, rentabilite, equipe, clients et stock selon la periode selectionnee.</p>
        </div>
        <a class="btn secondary" routerLink="/admin/dashboard">Retour pilotage</a>
      </header>

      <section class="bi-filter-band">
        <div class="bi-range-tabs">
          <button *ngFor="let option of ranges" class="btn secondary" [class.active-filter]="range === option.value" (click)="selectRange(option.value)">{{ option.label }}</button>
        </div>
        <div class="bi-date-controls">
          <input class="input" type="date" [(ngModel)]="selectedDate" *ngIf="range === 'day' || range === 'week'">
          <input class="input" type="number" [(ngModel)]="year" min="2020" max="2100" *ngIf="range === 'month' || range === 'year'">
          <select class="select" [(ngModel)]="month" *ngIf="range === 'month'">
            <option *ngFor="let m of months" [ngValue]="m">Mois {{ m }}</option>
          </select>
          <button class="btn" (click)="load()">Actualiser</button>
        </div>
      </section>

      <div class="empty-state" *ngIf="loading()"><div class="spinner"></div><strong>Calcul des statistiques...</strong></div>
      <div class="empty-state error" *ngIf="error()"><strong>Statistiques indisponibles</strong><span>{{ error() }}</span><button class="btn" (click)="load()">Reessayer</button></div>

      <ng-container *ngIf="report() as r">
        <section class="bi-kpi-grid">
          <article class="bi-kpi"><span>Chiffre d'affaires</span><strong>{{ money(r.metrics.revenue) }}</strong><small>{{ r.metrics.salesCount }} vente(s)</small></article>
          <article class="bi-kpi"><span>Marge brute</span><strong>{{ money(r.metrics.grossProfit) }}</strong><small>Cout articles {{ money(r.metrics.purchaseCost) }}</small></article>
          <article class="bi-kpi warning"><span>Depenses</span><strong>{{ money(r.metrics.expenseTotal) }}</strong><small>Charges de la periode</small></article>
          <article class="bi-kpi" [class.negative-kpi]="r.metrics.netResult < 0"><span>Resultat net</span><strong>{{ money(r.metrics.netResult) }}</strong><small>Marge moins charges</small></article>
          <article class="bi-kpi"><span>Panier moyen</span><strong>{{ money(r.metrics.averageBasket) }}</strong><small>{{ r.metrics.quantity }} article(s)</small></article>
          <article class="bi-kpi"><span>Clients</span><strong>{{ r.metrics.totalCustomers }}</strong><small>{{ r.metrics.vipCustomers }} VIP</small></article>
          <article class="bi-kpi warning"><span>Stock faible</span><strong>{{ r.metrics.lowStock }}</strong><small>Article(s) a suivre</small></article>
          <article class="bi-kpi warning"><span>Reservations</span><strong>{{ r.metrics.lateReservations }}</strong><small>En retard</small></article>
        </section>

        <section class="bi-chart-grid">
          <article class="bi-panel bi-wide">
            <div class="section-title"><div><span class="eyebrow">Evolution</span><h3>CA, depenses et resultat</h3></div><span class="badge">{{ periodText(r) }}</span></div>
            <div class="bi-legend"><span class="sales-dot">CA</span><span class="expense-dot">Depenses</span></div>
            <div class="bi-line-chart">
              <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-label="Evolution chiffre d'affaires et depenses">
                <line *ngFor="let y of gridLines" x1="0" [attr.y1]="y" x2="1000" [attr.y2]="y" class="chart-grid-line" />
                <polyline [attr.points]="linePoints(r.timeline, 'sales')" class="sales-line" />
                <polyline [attr.points]="linePoints(r.timeline, 'expenses')" class="expense-line" />
              </svg>
              <div class="bi-axis-labels"><span *ngFor="let point of sampledTimeline(r.timeline)">{{ point.label }}</span></div>
            </div>
          </article>

          <article class="bi-panel">
            <div class="section-title"><div><span class="eyebrow">Paiements</span><h3>Repartition encaissements</h3></div></div>
            <div class="bi-donut-wrap">
              <div class="bi-donut" [style.background]="paymentGradient(r.paymentMethods)"><div><strong>{{ money(r.metrics.revenue) }}</strong><span>Total</span></div></div>
              <div class="bi-legend-list"><div *ngFor="let p of r.paymentMethods; let i = index"><i [style.background]="chartColors[i % chartColors.length]"></i><span>{{ paymentLabel(p.method) }}</span><strong>{{ money(p.amount) }}</strong></div></div>
            </div>
          </article>

          <article class="bi-panel">
            <div class="section-title"><div><span class="eyebrow">Equipe</span><h3>Recette par employee</h3></div></div>
            <div class="bi-bars">
              <div *ngFor="let e of r.employeePerformance" class="bi-bar-row">
                <div><strong>{{ e.employee }}</strong><span>{{ e.salesCount }} ventes · {{ e.quantity }} articles</span></div>
                <div class="bi-bar-track"><span [style.width.%]="barPercent(e.revenue, maxEmployeeRevenue(r.employeePerformance))"></span></div>
                <strong>{{ money(e.revenue) }}</strong>
                <small>Gain {{ money(e.profit) }}</small>
              </div>
              <p class="muted" *ngIf="!r.employeePerformance.length">Aucune vente sur cette periode.</p>
            </div>
          </article>

          <article class="bi-panel bi-wide">
            <div class="section-title"><div><span class="eyebrow">Produits</span><h3>Meilleures ventes</h3></div></div>
            <div class="bi-product-bars">
              <div *ngFor="let p of r.topProducts">
                <span>{{ p.productName }}</span>
                <div class="bi-product-track"><i [style.width.%]="barPercent(p.revenue, maxProductRevenue(r.topProducts))"></i></div>
                <strong>{{ p.quantity }} pcs</strong><strong>{{ money(p.revenue) }}</strong>
              </div>
              <p class="muted" *ngIf="!r.topProducts.length">Aucun produit vendu sur cette periode.</p>
            </div>
          </article>
        </section>
      </ng-container>
    </div>
  `
})
export class BiDashboardPageComponent {
  private data = inject(DataService);
  report = signal<any>(null);
  loading = signal(false);
  error = signal('');
  range = 'month';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  selectedDate = new Date().toISOString().slice(0, 10);
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  ranges = [{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }, { value: 'year', label: 'Annee' }, { value: 'all', label: 'Tout' }];
  gridLines = [0, 75, 150, 225, 300];
  chartColors = ['#d4a62a', '#3f7c68', '#d77088', '#537aa3', '#c67b32'];

  constructor() { this.load(); }

  selectRange(range: string) { this.range = range; this.load(); }
  load() {
    this.loading.set(true); this.error.set(''); this.report.set(null);
    this.data.biDashboard(this.range, this.year, this.month, this.selectedDate).subscribe({
      next: value => { this.report.set(value); this.loading.set(false); },
      error: err => { this.error.set(err?.error?.message || 'Impossible de charger les statistiques.'); this.loading.set(false); }
    });
  }

  linePoints(items: any[], key: string) {
    if (!items?.length) return '';
    const max = Math.max(1, ...items.flatMap(x => [Number(x.sales || 0), Number(x.expenses || 0)]));
    return items.map((item, index) => `${items.length === 1 ? 500 : index * 1000 / (items.length - 1)},${290 - Number(item[key] || 0) * 270 / max}`).join(' ');
  }
  sampledTimeline(items: any[]) {
    if (items.length <= 8) return items;
    const step = Math.ceil(items.length / 7);
    return items.filter((_: any, index: number) => index % step === 0 || index === items.length - 1);
  }
  paymentGradient(items: any[]) {
    const total = items.reduce((sum, x) => sum + Number(x.amount || 0), 0) || 1;
    let current = 0;
    const stops = items.map((item, index) => { const start = current; current += Number(item.amount || 0) / total * 100; return `${this.chartColors[index % this.chartColors.length]} ${start}% ${current}%`; });
    return `conic-gradient(${stops.length ? stops.join(',') : '#eee 0 100%'})`;
  }
  barPercent(value: number, max: number) { return max > 0 ? Math.max(2, Number(value || 0) / max * 100) : 0; }
  maxEmployeeRevenue(items: any[]) { return Math.max(0, ...items.map(x => Number(x.revenue || 0))); }
  maxProductRevenue(items: any[]) { return Math.max(0, ...items.map(x => Number(x.revenue || 0))); }
  paymentLabel(value: string) { return ({ CASH: 'Especes', CARD: 'Carte', TRANSFER: 'Virement' } as any)[value] || value; }
  periodText(report: any) { return `${String(report.range).toUpperCase()} · ${String(report.start).slice(0, 10)}`; }
  money(value: number | null | undefined) { return `${Number(value || 0).toFixed(2)} DT`; }
}
