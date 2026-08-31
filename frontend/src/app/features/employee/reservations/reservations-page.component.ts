import { Component, inject, signal } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/data.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [FormsModule, NgFor, DatePipe, NgIf],
  template: `
    <div class="grid grid-2">
      <div class="card">
        <h3>Nouvelle reservation</h3>
        <div class="form-grid">
          <select class="select" [(ngModel)]="customerId">
            <option *ngFor="let c of customers()" [ngValue]="c.id">{{ c.firstName }} {{ c.lastName }} - {{ c.phone }}</option>
          </select>
          <select class="select" [(ngModel)]="productVariantId">
            <option *ngFor="let v of variants()" [ngValue]="v.id">
              {{ v.productName }} - {{ v.category }} - {{ v.color || '-' }} {{ v.size || '-' }} - stock {{ v.currentStock }}
            </option>
          </select>
          <input class="input" [(ngModel)]="quantity" type="number" placeholder="Quantite reservee">
          <input class="input" [(ngModel)]="depositAmount" type="number" placeholder="Acompte">
          <input class="input" [(ngModel)]="dueDate" type="date" placeholder="Date limite">
        </div>

        <div class="reservation-preview" *ngIf="selectedVariant() as v">
          <strong>{{ v.productName }}</strong>
          <span>{{ v.category }} - {{ v.barcode }}</span>
          <span>Prix {{ money(v.salePrice) }} - Stock actuel {{ v.currentStock }} - Apres reservation {{ v.currentStock - quantity }}</span>
        </div>

        <button class="btn" style="margin-top:16px" (click)="save()">Creer reservation</button>
        <p *ngIf="message()" class="badge" style="margin-top:12px">{{ message() }}</p>
      </div>

      <div class="hero-card">
        <h3>Stock reserve</h3>
        <ul>
          <li>Quand tu reserves 1 article, le stock baisse de 1 directement.</li>
          <li>Le tableau affiche le detail article: nom, code-barres, couleur, taille, quantite.</li>
          <li>Si la date limite est depassee, l'app affiche un rappel client.</li>
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <table class="table">
        <thead>
          <tr><th>N</th><th>Client</th><th>Articles reserves</th><th>Date limite</th><th>Total</th><th>Reste</th><th>Statut</th><th>Rappel</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of reservations()">
            <td>{{ r.reservationNumber }}</td>
            <td>
              {{ r.customer?.firstName }} {{ r.customer?.lastName }}<br>
              <span class="muted">{{ r.customer?.phone }}</span>
            </td>
            <td>
              <div class="reserved-line" *ngFor="let item of r.items">
                <strong>{{ item.quantity }} reserve(s)</strong> - {{ item.productName }}<br>
                <span class="muted">{{ item.barcode }} - {{ item.color || '-' }} / {{ item.size || '-' }}</span><br>
                <span class="badge">Stock restant {{ item.stockRestant }}</span>
                <span class="badge success">{{ money(item.lineTotal) }}</span>
              </div>
            </td>
            <td>{{ r.dueDate | date:'yyyy-MM-dd' }}</td>
            <td>{{ money(r.totalAmount) }}</td>
            <td>{{ money(r.remainingAmount) }}</td>
            <td><span class="badge" [class.danger]="r.status === 'RESERVED'">{{ r.status }}</span></td>
            <td><span class="badge danger" *ngIf="r.late">Appeler le client</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class ReservationsPageComponent {
  private data = inject(DataService);
  private auth = inject(AuthService);

  reservations = signal<any[]>([]);
  products = signal<any[]>([]);
  customers = signal<any[]>([]);
  message = signal('');
  customerId = 1;
  productVariantId = 1;
  quantity = 1;
  depositAmount = 50;
  dueDate = new Date().toISOString().slice(0, 10);

  constructor() {
    this.data.customers().subscribe(v => {
      this.customers.set(v);
      if (v.length) this.customerId = v[0].id;
    });
    this.data.products().subscribe(v => {
      this.products.set(v);
      const firstVariant = this.variants()[0];
      if (firstVariant) this.productVariantId = firstVariant.id;
    });
    this.load();
  }

  load() {
    this.data.reservations().subscribe(v => this.reservations.set(v));
  }

  variants() {
    return this.products().flatMap(p => (p.variants || []).map((v: any) => ({
      ...v,
      productName: p.productName,
      category: p.category
    })));
  }

  selectedVariant() {
    return this.variants().find(v => v.id === this.productVariantId);
  }

  save() {
    this.data.createReservation({
      customerId: this.customerId,
      createdByUserId: this.auth.userId(),
      dueDate: new Date(this.dueDate).toISOString(),
      depositAmount: Number(this.depositAmount),
      items: [
        {
          productVariantId: this.productVariantId,
          quantity: Number(this.quantity)
        }
      ]
    }).subscribe({
      next: (res: any) => {
        this.message.set(res?.message || `${this.quantity} article(s) reserve(s). Stock diminue automatiquement.`);
        this.load();
        this.data.products().subscribe(v => this.products.set(v));
      },
      error: err => this.message.set(err?.error?.message || 'Erreur reservation')
    });
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }
}
