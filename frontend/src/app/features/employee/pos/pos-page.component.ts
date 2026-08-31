import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { DataService } from '../../../core/data.service';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <div class="hero-card" style="margin-bottom:18px">
      <div class="section-title">
        <div>
          <h2 style="margin-bottom:6px">Caisse desktop - prete pour douchette code-barres</h2>
          <div class="muted">Scanne un code-barres ou ajoute plusieurs articles depuis la liste.</div>
        </div>
        <button class="btn secondary" (click)="focusBarcode()">Focus scanner</button>
      </div>
    </div>

    <div class="pos-grid">
      <div class="card">
        <h3>Articles vente</h3>
        <input #barcodeInput class="input" [(ngModel)]="barcode" (keyup.enter)="scan()" placeholder="Scanner ou saisir le code-barres">
        <div class="toolbar-actions" style="margin-top:12px">
          <button class="btn" (click)="scan()">Ajouter au panier</button>
          <button class="btn ghost" (click)="clearCart()">Vider</button>
        </div>

        <div class="form-grid" style="margin-top:14px">
          <select class="select" [(ngModel)]="selectedVariantId">
            <option [ngValue]="null">Ajouter article sans scan</option>
            <option *ngFor="let p of products()" [ngValue]="p.variants?.[0]?.id">
              {{ p.productName }} - {{ p.variants?.[0]?.barcode }} - {{ money(p.variants?.[0]?.salePrice) }}
            </option>
          </select>
          <input class="input" type="number" min="1" [(ngModel)]="manualQty" placeholder="Quantite">
        </div>
        <button class="btn secondary" style="margin-top:10px" (click)="addSelectedProduct()">Ajouter selection</button>

        <div style="margin-top:18px">
          <div class="product-item" *ngFor="let item of cart(); let i = index">
            <div>
              <strong>{{ item.productName }}</strong><br>
              <small>{{ item.barcode }} - {{ item.color || '-' }} {{ item.size || '-' }}</small>
            </div>
            <div>
              <strong>{{ item.quantity }} x {{ money(item.salePrice) }}</strong><br>
              <small>Total {{ money(item.lineTotal) }}</small><br>
              <div class="toolbar-actions" style="margin-top:8px">
                <button class="btn ghost" (click)="changeQty(i, -1)">-</button>
                <button class="btn ghost" (click)="changeQty(i, 1)">+</button>
                <button class="btn ghost" (click)="remove(i)">Retirer</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Validation vente</h3>
        <div class="customer-picker">
          <div class="section-title">
            <div>
              <span class="eyebrow">Client optionnel</span>
              <strong>Rechercher et selectionner</strong>
            </div>
            <button class="btn secondary" (click)="showNewCustomer.set(!showNewCustomer())">
              {{ showNewCustomer() ? 'Fermer' : 'Nouveau client' }}
            </button>
          </div>

          <input class="input" [(ngModel)]="customerSearch" placeholder="Rechercher par nom ou telephone">
          <select class="select" [(ngModel)]="customerId" style="margin-top:10px">
            <option [ngValue]="null">Vente sans client</option>
            <option *ngFor="let customer of filteredCustomers()" [ngValue]="customer.id">
              {{ customer.firstName }} {{ customer.lastName }} - {{ customer.phone }}
            </option>
          </select>

          <div class="selected-customer" *ngIf="selectedCustomer() as customer">
            <div>
              <strong>{{ customer.firstName }} {{ customer.lastName }}</strong>
              <span>{{ customer.phone }} · Achats mois {{ money(customer.totalSpentCurrentMonth) }}</span>
            </div>
            <button class="btn ghost" (click)="clearCustomer()">Retirer</button>
          </div>

          <div class="new-customer-form" *ngIf="showNewCustomer()">
            <div class="form-grid">
              <input class="input" [(ngModel)]="newCustomer.firstName" placeholder="Prenom">
              <input class="input" [(ngModel)]="newCustomer.lastName" placeholder="Nom">
              <input class="input" [(ngModel)]="newCustomer.phone" placeholder="Telephone">
              <input class="input" [(ngModel)]="newCustomer.city" placeholder="Ville (optionnel)">
            </div>
            <button class="btn secondary" style="margin-top:10px" (click)="createCustomer()">Ajouter et selectionner ce client</button>
          </div>
        </div>
        <input class="input" [(ngModel)]="cashSessionId" type="number" placeholder="ID caisse ouverte" style="margin-top:10px">
        <select class="select" [(ngModel)]="paymentMethod" style="margin-top:10px">
          <option value="CASH">Especes</option>
          <option value="CARD">Carte</option>
          <option value="TRANSFER">Virement</option>
        </select>

        <div class="sale-discount">
          <div class="section-title">
            <div><span class="eyebrow">Reduction</span><strong>Conditions de vente</strong></div>
            <span class="badge" *ngIf="discountAmount() > 0">- {{ money(discountAmount()) }}</span>
          </div>
          <select class="select" [(ngModel)]="discountPreset" (ngModelChange)="applyDiscountPreset()">
            <option value="NONE">Aucune reduction</option>
            <option value="ITEM_2">Petit geste - 2 DT par article</option>
            <option value="ITEM_3">Petit geste - 3 DT par article</option>
            <option value="WHEEL_5">Roue - Reduction 5%</option>
            <option value="WHEEL_10">Roue - Reduction 10%</option>
            <option value="WHEEL_20">Roue - Bon achat 20 DT</option>
            <option value="CUSTOM">Reduction personnalisee</option>
          </select>
          <div class="form-grid" style="margin-top:10px" *ngIf="discountPreset === 'CUSTOM'">
            <select class="select" [(ngModel)]="discountMode">
              <option value="FIXED">Montant total DT</option>
              <option value="PERCENT">Pourcentage %</option>
              <option value="PER_ITEM">Montant par article</option>
            </select>
            <input class="input" type="number" min="0" [(ngModel)]="discountValue" placeholder="Valeur reduction">
          </div>
          <input class="input" style="margin-top:10px" [(ngModel)]="discountReason" placeholder="Motif de la reduction" *ngIf="discountPreset !== 'NONE'">
        </div>

        <div class="cart-totals">
          <div><span>Sous-total</span><strong>{{ money(total()) }}</strong></div>
          <div *ngIf="discountAmount() > 0"><span>Reduction</span><strong class="negative">- {{ money(discountAmount()) }}</strong></div>
          <div class="grand-total"><span>Total a payer</span><strong>{{ money(finalTotal()) }}</strong></div>
        </div>
        <button class="btn" style="width:100%;margin-top:12px" (click)="checkout()">Valider vente</button>
        <p class="subtitle" style="margin-top:12px">{{ message() }}</p>
        <div *ngIf="total() > 300" class="badge success" style="margin-top:12px">Eligible roue de chance &gt; 300 DT</div>
      </div>
    </div>

    <div class="card" style="margin-top:18px" *ngIf="isAdmin() && profitSummary() as s">
      <div class="section-title">
        <h3>CA et gain produits</h3>
        <span class="badge">Visible admin seulement</span>
      </div>
      <div class="grid grid-3">
        <div class="quick-item">
          <strong>Jour</strong>
          <div>CA {{ money(s.today.salesTotal) }}</div>
          <div>Achat {{ money(s.today.purchaseTotal) }} - Gain {{ money(s.today.profit) }}</div>
        </div>
        <div class="quick-item">
          <strong>Semaine</strong>
          <div>CA {{ money(s.week.salesTotal) }}</div>
          <div>Achat {{ money(s.week.purchaseTotal) }} - Gain {{ money(s.week.profit) }}</div>
        </div>
        <div class="quick-item">
          <strong>Mois</strong>
          <div>CA {{ money(s.month.salesTotal) }}</div>
          <div>Achat {{ money(s.month.purchaseTotal) }} - Gain {{ money(s.month.profit) }}</div>
        </div>
      </div>
    </div>
  `
})
export class PosPageComponent implements AfterViewInit {
  private data = inject(DataService);
  private auth = inject(AuthService);

  @ViewChild('barcodeInput') barcodeInput?: ElementRef<HTMLInputElement>;

  barcode = '';
  customerId: number | null = null;
  cashSessionId: number | null = 1;
  paymentMethod = 'CASH';
  selectedVariantId: number | null = null;
  manualQty = 1;
  cart = signal<any[]>([]);
  products = signal<any[]>([]);
  customers = signal<any[]>([]);
  showNewCustomer = signal(false);
  profitSummary = signal<any>(null);
  message = signal('');
  total = signal(0);
  customerSearch = '';
  discountPreset = 'NONE';
  discountMode = 'FIXED';
  discountValue = 0;
  discountReason = '';
  newCustomer = this.emptyCustomer();

  constructor() {
    this.data.products().subscribe(v => this.products.set(v));
    this.loadCustomers();
    this.loadProfitSummary();
  }

  ngAfterViewInit() {
    setTimeout(() => this.focusBarcode(), 100);
  }

  focusBarcode() {
    this.barcodeInput?.nativeElement.focus();
  }

  private recalc() {
    this.total.set(this.cart().reduce((sum, item) => sum + item.lineTotal, 0));
  }

  private addVariantToCart(variant: any, quantity = 1) {
    const current = [...this.cart()];
    const index = current.findIndex(x => x.id === variant.id);
    const qty = Math.max(1, Number(quantity || 1));
    const price = Number(variant.salePrice || 0);

    if (index >= 0) {
      current[index].quantity += qty;
      current[index].lineTotal = current[index].quantity * current[index].salePrice;
    } else {
      current.push({
        id: variant.id,
        productName: variant.product?.productName || variant.productName,
        barcode: variant.barcode,
        color: variant.color,
        size: variant.size,
        salePrice: price,
        quantity: qty,
        lineTotal: price * qty
      });
    }

    this.cart.set(current);
    this.recalc();
  }

  scan() {
    const code = this.barcode.trim();
    if (!code) return;

    this.data.variantByBarcode(code).subscribe({
      next: (variant) => {
        this.addVariantToCart(variant, 1);
        this.message.set('Article ajoute');
        this.barcode = '';
        this.focusBarcode();
      },
      error: () => {
        this.message.set('Code-barres introuvable');
        this.focusBarcode();
      }
    });
  }

  addSelectedProduct() {
    if (!this.selectedVariantId) {
      this.message.set('Choisir un article');
      return;
    }

    const product = this.products().find(p => p.variants?.[0]?.id === this.selectedVariantId);
    const variant = product?.variants?.[0];
    if (!variant) {
      this.message.set('Article introuvable');
      return;
    }

    this.addVariantToCart({ ...variant, productName: product.productName }, this.manualQty);
    this.message.set('Article ajoute');
    this.focusBarcode();
  }

  changeQty(index: number, delta: number) {
    const current = [...this.cart()];
    current[index].quantity = Math.max(1, current[index].quantity + delta);
    current[index].lineTotal = current[index].quantity * current[index].salePrice;
    this.cart.set(current);
    this.recalc();
  }

  remove(index: number) {
    const current = [...this.cart()];
    current.splice(index, 1);
    this.cart.set(current);
    this.recalc();
    this.focusBarcode();
  }

  clearCart() {
    this.cart.set([]);
    this.total.set(0);
    this.focusBarcode();
  }

  filteredCustomers() {
    const term = this.customerSearch.trim().toLocaleLowerCase();
    if (!term) return this.customers();
    return this.customers().filter(customer =>
      `${customer.firstName} ${customer.lastName} ${customer.phone}`.toLocaleLowerCase().includes(term)
    );
  }

  selectedCustomer() {
    return this.customers().find(customer => customer.id === this.customerId) || null;
  }

  clearCustomer() {
    this.customerId = null;
    this.customerSearch = '';
  }

  createCustomer() {
    if (!this.newCustomer.firstName.trim() || !this.newCustomer.lastName.trim() || !this.newCustomer.phone.trim()) {
      this.message.set('Prenom, nom et telephone du client obligatoires');
      return;
    }

    this.data.createCustomer({
      ...this.newCustomer,
      email: null,
      vipStatus: false,
      currentCreditAmount: 0
    }).subscribe({
      next: (created: any) => {
        this.message.set('Client ajoute et selectionne pour la vente');
        this.customerId = created.id;
        this.customerSearch = `${created.firstName} ${created.lastName}`;
        this.showNewCustomer.set(false);
        this.newCustomer = this.emptyCustomer();
        this.loadCustomers();
      },
      error: err => this.message.set(err?.error?.message || 'Erreur creation client')
    });
  }

  checkout() {
    if (!this.cart().length) return;

    if (this.discountAmount() > 0 && !this.discountReason.trim()) {
      this.message.set('Indiquez le motif de la reduction');
      return;
    }

    const payload = {
      userId: this.auth.userId(),
      customerId: this.customerId || null,
      cashSessionId: this.cashSessionId || null,
      discountAmount: this.discountAmount(),
      discountReason: this.discountReason.trim() || null,
      lines: this.cart().map(item => ({
        productVariantId: item.id,
        quantity: item.quantity
      })),
      payments: [
        {
          paymentMethod: this.paymentMethod,
          amount: this.finalTotal()
        }
      ]
    };

    this.data.createSale(payload).subscribe({
      next: () => {
        this.message.set('Vente enregistree avec succes');
        this.cart.set([]);
        this.total.set(0);
        this.resetDiscount();
        this.loadProfitSummary();
        this.focusBarcode();
      },
      error: (err) => {
        this.message.set(err?.error?.message || 'Erreur vente');
        this.focusBarcode();
      }
    });
  }

  applyDiscountPreset() {
    const presets: Record<string, { mode: string; value: number; reason: string }> = {
      NONE: { mode: 'FIXED', value: 0, reason: '' },
      ITEM_2: { mode: 'PER_ITEM', value: 2, reason: 'Petit geste commercial 2 DT par article' },
      ITEM_3: { mode: 'PER_ITEM', value: 3, reason: 'Petit geste commercial 3 DT par article' },
      WHEEL_5: { mode: 'PERCENT', value: 5, reason: 'Gain roue de chance - reduction 5%' },
      WHEEL_10: { mode: 'PERCENT', value: 10, reason: 'Gain roue de chance - reduction 10%' },
      WHEEL_20: { mode: 'FIXED', value: 20, reason: 'Gain roue de chance - bon achat 20 DT' },
      CUSTOM: { mode: 'FIXED', value: 0, reason: 'Reduction autorisee' }
    };
    const preset = presets[this.discountPreset] || presets['NONE'];
    this.discountMode = preset.mode;
    this.discountValue = preset.value;
    this.discountReason = preset.reason;
  }

  discountAmount() {
    const value = Math.max(0, Number(this.discountValue || 0));
    let amount = value;
    if (this.discountMode === 'PERCENT') amount = this.total() * Math.min(100, value) / 100;
    if (this.discountMode === 'PER_ITEM') amount = this.cart().reduce((sum, item) => sum + item.quantity, 0) * value;
    return Math.min(this.total(), Math.round(amount * 100) / 100);
  }

  finalTotal() {
    return Math.max(0, this.total() - this.discountAmount());
  }

  resetDiscount() {
    this.discountPreset = 'NONE';
    this.discountMode = 'FIXED';
    this.discountValue = 0;
    this.discountReason = '';
  }

  isAdmin() {
    return this.auth.role() === 'ADMIN';
  }

  loadProfitSummary() {
    if (!this.isAdmin()) return;
    this.data.salesProfitSummary().subscribe({
      next: v => this.profitSummary.set(v),
      error: () => this.profitSummary.set(null)
    });
  }

  loadCustomers() {
    this.data.customers().subscribe({
      next: customers => this.customers.set(customers),
      error: () => this.customers.set([])
    });
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }

  private emptyCustomer() {
    return { firstName: '', lastName: '', phone: '', city: '' };
  }
}
