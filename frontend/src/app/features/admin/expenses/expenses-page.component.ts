import { Component, inject, signal } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataService } from '../../../core/data.service';
import { API_BASE_URL } from '../../../core/api.config';

@Component({
  selector: 'app-expenses-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DatePipe, RouterLink],
  template: `
    <section class="page-band">
      <div>
        <span class="eyebrow">Admin</span>
        <h2>Depenses ligne par ligne</h2>
        <p>Suivi des charges, fournisseurs, achats stock, publicite et remarques justificatives.</p>
      </div>
      <div class="toolbar-actions">
        <input class="input compact" type="number" [(ngModel)]="year">
        <input class="input compact" type="number" [(ngModel)]="month">
        <button class="btn" (click)="load()">Filtrer</button>
      </div>
    </section>

    <div class="grid grid-2">
      <div class="card">
        <h3>Nouvelle depense</h3>
        <div class="form-grid">
          <select class="select" [(ngModel)]="form.expenseCategoryId">
            <option *ngFor="let c of categories()" [ngValue]="c.id">{{ c.name }}</option>
          </select>
          <input class="input" [(ngModel)]="form.amount" type="number" placeholder="Montant">
          <input class="input" [(ngModel)]="form.expenseDate" type="date">
          <select class="select" [(ngModel)]="form.paymentMethod">
            <option value="CASH">Especes</option>
            <option value="CARD">Carte</option>
            <option value="TRANSFER">Virement</option>
          </select>
          <input class="input" [(ngModel)]="form.supplierName" placeholder="Fournisseur">
          <input class="input" [(ngModel)]="form.description" placeholder="Description">
        </div>
        <textarea class="textarea" [(ngModel)]="form.remark" placeholder="Remarque / justificatif"></textarea>
        <label class="receipt-upload">
          <input type="file" accept="image/*" (change)="selectReceipt($event)">
          <img *ngIf="receiptPreview()" [src]="receiptPreview()" alt="Justificatif depense">
          <span *ngIf="!receiptPreview()">Ajouter photo justificatif</span>
        </label>
        <div class="toolbar-actions" style="margin-top:16px">
          <button class="btn" (click)="save()">Enregistrer</button>
          <button class="btn secondary" (click)="resetForm()">Vider</button>
        </div>
        <p *ngIf="message()" class="badge" style="margin-top:12px">{{ message() }}</p>
      </div>

      <div class="action-panel" *ngIf="report() as rep">
        <span class="eyebrow">Rapport mois</span>
        <h3>{{ money(rep.total) }}</h3>
        <p class="muted">Total depenses pour {{ rep.month }}/{{ rep.year }}</p>
        <div class="quick-list">
          <div class="quick-item" *ngFor="let c of rep.byCategory">
            {{ c.category }} <strong style="float:right">{{ money(c.total) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="empty-state error" *ngIf="error()" style="margin-top:18px">
      <strong>Impossible de charger les depenses</strong>
      <span>{{ error() }}</span>
      <button class="btn" (click)="load()">Reessayer</button>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-title">
        <h3>Depenses detaillees</h3>
        <span class="badge">{{ expenses().length }} ligne(s)</span>
      </div>

      <table class="table">
        <thead>
          <tr><th>Photo</th><th>Date</th><th>Categorie</th><th>Montant</th><th>Mode</th><th>Fournisseur</th><th>Description</th><th>Remarque</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let e of expenses()">
            <td>
              <span class="line-photo receipt">
                <img *ngIf="e.receiptImageUrl; else noReceipt" [src]="imageUrl(e.receiptImageUrl)" alt="Justificatif">
                <ng-template #noReceipt>-</ng-template>
              </span>
            </td>
            <td>{{ e.expenseDate | date:'yyyy-MM-dd' }}</td>
            <td>{{ e.category }}</td>
            <td><strong>{{ money(e.amount) }}</strong></td>
            <td>{{ e.paymentMethod }}</td>
            <td>{{ e.supplierName || '-' }}</td>
            <td>{{ e.description || '-' }}</td>
            <td>{{ e.remark || '-' }}</td>
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
export class ExpensesPageComponent {
  private data = inject(DataService);
  private assetBaseUrl = API_BASE_URL.replace('/api', '');
  expenses = signal<any[]>([]);
  report = signal<any>(null);
  summary = signal<any>(null);
  categories = signal<any[]>([]);
  message = signal('');
  error = signal('');
  receiptPreview = signal('');
  receiptFile: File | null = null;
  range = 'month';
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  selectedDate = new Date().toISOString().slice(0, 10);
  form = this.emptyForm();

  constructor() {
    this.data.expenseCategories().subscribe(v => {
      this.categories.set(v);
      if (v.length) this.form.expenseCategoryId = v[0].id;
    });
    this.load();
    this.loadPeriod();
  }

  load() {
    this.error.set('');
    this.data.expenses(this.year, this.month).subscribe({
      next: v => this.expenses.set(v),
      error: err => this.error.set(err?.error?.message || 'Erreur depenses')
    });
    this.data.monthlyExpenseReport(this.year, this.month).subscribe({
      next: v => this.report.set(v),
      error: err => this.error.set(err?.error?.message || 'Erreur rapport depenses')
    });
  }

  setRange(value: string) {
    this.range = value;
    this.loadPeriod();
  }

  loadPeriod() {
    this.error.set('');
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

  save() {
    this.data.createExpense({
      ...this.form,
      amount: Number(this.form.amount),
      expenseDate: new Date(this.form.expenseDate).toISOString()
    }).subscribe({
      next: (created: any) => {
        if (this.receiptFile) {
          this.data.uploadExpenseReceipt(created.id, this.receiptFile).subscribe({
            next: () => this.afterSave('Depense et justificatif enregistres'),
            error: () => {
              this.message.set('Depense enregistree, mais upload photo impossible');
              this.load();
            }
          });
          return;
        }

        this.afterSave('Depense enregistree');
      },
      error: err => this.message.set(err?.error?.message || 'Erreur depense')
    });
  }

  selectReceipt(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.receiptFile = file;

    if (!file) {
      this.receiptPreview.set('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.receiptPreview.set(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  resetForm() {
    const currentCategoryId = this.form.expenseCategoryId || this.categories()[0]?.id || 1;
    this.form = this.emptyForm();
    this.form.expenseCategoryId = currentCategoryId;
    this.receiptFile = null;
    this.receiptPreview.set('');
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }

  imageUrl(path: string) {
    return path.startsWith('http') ? path : `${this.assetBaseUrl}${path}`;
  }

  private afterSave(message: string) {
    this.message.set(message);
    this.resetForm();
    this.load();
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

  private emptyForm() {
    return {
      expenseCategoryId: 1,
      amount: 0,
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'CASH',
      supplierName: '',
      description: '',
      remark: ''
    };
  }
}
