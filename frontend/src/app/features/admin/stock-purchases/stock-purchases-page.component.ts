import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DataService } from '../../../core/data.service';
import { API_BASE_URL } from '../../../core/api.config';

@Component({
  selector: 'app-stock-purchases-page',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <div class="page-band">
      <div>
        <span class="eyebrow">Stock distinct des charges</span>
        <h2>Achats de stock article par article</h2>
        <p>Les anciens articles deja payes restent a 0 DT. Seuls les nouveaux achats figurent ici.</p>
      </div>
      <span class="badge">{{ report().inventory?.length || 0 }} article(s)</span>
    </div>

    <div class="grid grid-3">
      <div class="metric-card">
        <span>Valeur achat du stock complet</span>
        <strong>{{ money(report().inventoryTotalAmount) }}</strong>
        <small>Les anciens articles payes comptent 0 DT</small>
      </div>
      <div class="metric-card success">
        <span>Quantite totale en stock</span>
        <strong>{{ report().inventoryTotalQuantity || 0 }}</strong>
        <small>{{ report().inventory?.length || 0 }} article(s) affiches</small>
      </div>
      <div class="metric-card">
        <span>Total nouveaux achats</span>
        <strong>{{ money(report().totalAmount) }}</strong>
        <small>Registre separe des depenses</small>
      </div>
    </div>

    <div class="card" style="margin-top:18px;overflow:auto">
      <div class="section-title">
        <div>
          <span class="eyebrow">Vue complete</span>
          <h3>Tous les articles et leur prix d'achat</h3>
        </div>
        <span class="badge">Somme complete {{ money(report().inventoryTotalAmount) }}</span>
      </div>
      <table class="table">
        <thead><tr><th>Article</th><th>Stock actuel</th><th>Quantite achetee ici</th><th>Dernier prix unitaire</th><th>Total reel paye</th><th>Etat</th></tr></thead>
        <tbody>
          <tr *ngFor="let item of report().inventory">
            <td>
              <div class="sale-line">
                <span class="line-photo">
                  <img *ngIf="item.imageUrl" [src]="imageUrl(item.imageUrl)" [alt]="item.productName">
                  <span *ngIf="!item.imageUrl">{{ initials(item.productName) }}</span>
                </span>
                <span><strong>{{ item.productName }}</strong><br><small>{{ item.reference || item.barcode }}</small></span>
              </div>
            </td>
            <td>{{ item.quantity }}</td>
            <td>{{ item.purchasedQuantity }}</td>
            <td><strong>{{ money(item.unitPurchasePrice) }}</strong></td>
            <td><strong>{{ money(item.totalAmount) }}</strong></td>
            <td><span class="badge" [class.success]="item.alreadyPaid">{{ item.alreadyPaid ? 'Ancien stock deja paye' : 'Nouvel achat' }}</span></td>
          </tr>
          <tr *ngIf="!report().inventory?.length"><td colspan="6" class="muted">Aucun article dans le stock.</td></tr>
        </tbody>
      </table>
    </div>

  `
})
export class StockPurchasesPageComponent {
  private data = inject(DataService);
  private assetBaseUrl = API_BASE_URL.replace('/api', '');
  report = signal<any>({ items: [], inventory: [], totalAmount: 0, totalQuantity: 0, inventoryTotalAmount: 0, inventoryTotalQuantity: 0 });

  constructor() {
    this.data.stockPurchases().subscribe(v => this.report.set(v));
  }
  imageUrl(path: string) { return path.startsWith('http') ? path : `${this.assetBaseUrl}${path}`; }
  initials(name: string) { return (name || 'TB').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
  money(value: number | null | undefined) { return `${Number(value || 0).toFixed(2)} DT`; }
}
