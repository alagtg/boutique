import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { DataService } from '../../../core/data.service';
import { AuthService } from '../../../core/auth.service';
import { CustomerDisplayService } from '../../../core/customer-display.service';
import { StoreService } from '../../../core/store.service';
import { API_BASE_URL } from '../../../core/api.config';

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
        <div class="toolbar-actions">
          <a class="btn secondary" href="/customer-display" target="_blank" rel="noopener">Ouvrir ecran client</a>
          <button class="btn secondary" (click)="focusBarcode()">Focus scanner</button>
        </div>
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
          <select class="select" [(ngModel)]="customerId" (ngModelChange)="syncDisplay()" style="margin-top:10px">
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
        <select class="select" [(ngModel)]="paymentMethod" (ngModelChange)="syncDisplay()" style="margin-top:10px">
          <option value="CASH">Especes</option>
          <option value="CARD">Carte</option>
          <option value="TRANSFER">Virement</option>
        </select>
        <input *ngIf="paymentMethod === 'CASH'" class="input" [(ngModel)]="cashReceived" (ngModelChange)="syncDisplay()" type="number" min="0" placeholder="Montant recu (pour calculer la monnaie)" style="margin-top:10px">

        <div class="sale-discount">
          <div class="section-title">
            <div><span class="eyebrow">Reduction</span><strong>Conditions de vente</strong></div>
            <span class="badge" *ngIf="discountAmount() > 0">- {{ money(discountAmount()) }}</span>
          </div>
          <select class="select" [(ngModel)]="discountPreset" (ngModelChange)="applyDiscountPreset(); syncDisplay()">
            <option value="NONE">Aucune reduction</option>
            <option value="ITEM_2">Petit geste - 2 DT par article</option>
            <option value="ITEM_3">Petit geste - 3 DT par article</option>
            <option value="WHEEL_5">Roue - Reduction 5%</option>
            <option value="WHEEL_10">Roue - Reduction 10%</option>
            <option value="WHEEL_20">Roue - Bon achat 20 DT</option>
            <option value="CUSTOM">Reduction personnalisee</option>
          </select>
          <div class="form-grid" style="margin-top:10px" *ngIf="discountPreset === 'CUSTOM'">
            <select class="select" [(ngModel)]="discountMode" (ngModelChange)="syncDisplay()">
              <option value="FIXED">Montant total DT</option>
              <option value="PERCENT">Pourcentage %</option>
              <option value="PER_ITEM">Montant par article</option>
            </select>
            <input class="input" type="number" min="0" [(ngModel)]="discountValue" (ngModelChange)="syncDisplay()" placeholder="Valeur reduction">
          </div>
          <input class="input" style="margin-top:10px" [(ngModel)]="discountReason" placeholder="Motif de la reduction" *ngIf="discountPreset !== 'NONE'">
        </div>

        <div class="cart-totals">
          <div><span>Sous-total</span><strong>{{ money(total()) }}</strong></div>
          <div *ngIf="discountAmount() > 0"><span>Reduction</span><strong class="negative">- {{ money(discountAmount()) }}</strong></div>
          <div class="grand-total"><span>Total a payer</span><strong>{{ money(finalTotal()) }}</strong></div>
          <div *ngIf="paymentMethod === 'CASH' && cashReceived > 0"><span>Monnaie a rendre</span><strong>{{ money(changeDue()) }}</strong></div>
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
  private customerDisplay = inject(CustomerDisplayService);
  private store = inject(StoreService);
  private assetBaseUrl = API_BASE_URL.replace('/api', '');

  @ViewChild('barcodeInput') barcodeInput?: ElementRef<HTMLInputElement>;

  barcode = '';
  customerId: number | null = null;
  cashSessionId: number | null = 1;
  paymentMethod = 'CASH';
  cashReceived = 0;
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
    const availableStock = Math.max(0, Number(variant.currentStock || 0));
    const product = this.products().find(p => p.variants?.some((v: any) => v.id === variant.id));
    const imageUrl = product?.imageUrl ? `${this.assetBaseUrl}${product.imageUrl}` : undefined;

    if (availableStock <= 0) {
      this.message.set(`Stock epuise pour ${variant.product?.productName || variant.productName || 'cet article'}`);
      return false;
    }

    const requestedQuantity = (index >= 0 ? current[index].quantity : 0) + qty;
    if (requestedQuantity > availableStock) {
      this.message.set(`Stock insuffisant : ${availableStock} exemplaire(s) disponible(s)`);
      return false;
    }

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
        lineTotal: price * qty,
        imageUrl,
        currentStock: availableStock
      });
    }

    this.cart.set(current);
    this.recalc();
    this.syncDisplay();
    return true;
  }

  scan() {
    const code = this.barcode.trim();
    if (!code) return;

    this.data.variantByBarcode(code).subscribe({
      next: (variant) => {
        if (this.addVariantToCart(variant, 1)) this.message.set('Article ajoute');
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

    if (this.addVariantToCart({ ...variant, productName: product.productName }, this.manualQty)) {
      this.message.set('Article ajoute');
    }
    this.focusBarcode();
  }

  changeQty(index: number, delta: number) {
    const current = [...this.cart()];
    const nextQuantity = Math.max(1, current[index].quantity + delta);
    if (nextQuantity > current[index].currentStock) {
      this.message.set(`Stock insuffisant : ${current[index].currentStock} exemplaire(s) disponible(s)`);
      return;
    }
    current[index].quantity = nextQuantity;
    current[index].lineTotal = current[index].quantity * current[index].salePrice;
    this.cart.set(current);
    this.recalc();
    this.syncDisplay();
  }

  remove(index: number) {
    const current = [...this.cart()];
    current.splice(index, 1);
    this.cart.set(current);
    this.recalc();
    this.syncDisplay();
    this.focusBarcode();
  }

  clearCart() {
    this.cart.set([]);
    this.total.set(0);
    this.cashReceived = 0;
    this.customerDisplay.reset();
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
    this.syncDisplay();
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

    const unavailableItem = this.cart().find(item => item.quantity > item.currentStock);
    if (unavailableItem) {
      this.message.set(`Stock insuffisant pour ${unavailableItem.productName}`);
      return;
    }

    if (this.discountAmount() > 0 && !this.discountReason.trim()) {
      this.message.set('Indiquez le motif de la reduction');
      return;
    }

    const ticketWindow = window.open('', 'tresor-ticket', 'width=420,height=720');
    if (ticketWindow) {
      ticketWindow.document.write('<!doctype html><title>Preparation du ticket...</title><p style="font-family:sans-serif;padding:24px">Preparation du ticket...</p>');
    }

    const ticketData = this.displayState();
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
      next: (sale: any) => {
        this.message.set('Vente enregistree avec succes');
        this.customerDisplay.publish({
          ...this.displayState(),
          status: 'COMPLETED'
        });
        this.printTicket(ticketWindow, sale, ticketData);
        window.setTimeout(() => this.customerDisplay.reset(), 6000);
        this.cart.set([]);
        this.total.set(0);
        this.cashReceived = 0;
        this.resetDiscount();
        this.loadProfitSummary();
        this.focusBarcode();
      },
      error: (err) => {
        ticketWindow?.close();
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

  changeDue() {
    return Math.max(0, Number(this.cashReceived || 0) - this.finalTotal());
  }

  syncDisplay() {
    if (!this.cart().length) {
      this.customerDisplay.reset();
      return;
    }
    this.customerDisplay.publish(this.displayState());
  }

  private displayState() {
    const customer = this.selectedCustomer();
    return {
      status: 'ACTIVE' as const,
      items: this.cart().map(item => ({
        id: item.id,
        productName: item.productName,
        color: item.color,
        size: item.size,
        salePrice: item.salePrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        imageUrl: item.imageUrl
      })),
      subtotal: this.total(),
      discount: this.discountAmount(),
      total: this.finalTotal(),
      paymentMethod: this.paymentMethod,
      amountReceived: Number(this.cashReceived || 0),
      change: this.changeDue(),
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : undefined
    };
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

  private printTicket(ticketWindow: Window | null, sale: any, ticket: ReturnType<PosPageComponent['displayState']>) {
    if (!ticketWindow) {
      this.message.set('Vente enregistree. Autorisez les fenetres pop-up pour imprimer le ticket automatiquement.');
      return;
    }

    const settings = this.store.settings() || {};
    const logo = settings.logoPath ? `${this.assetBaseUrl}${settings.logoPath}` : `${location.origin}/assets/logo.png`;
    const lines = ticket.items.map(item => `
      <tr>
        <td>${this.escapeHtml(item.productName)}<small>${this.escapeHtml([item.color, item.size].filter(Boolean).join(' '))}</small></td>
        <td>${item.quantity} x ${this.money(item.salePrice)}</td>
        <td>${this.money(item.lineTotal)}</td>
      </tr>`).join('');
    const received = ticket.paymentMethod === 'CASH' && ticket.amountReceived > 0
      ? `<div class="row"><span>Recu</span><b>${this.money(ticket.amountReceived)}</b></div><div class="row change"><span>Monnaie</span><b>${this.money(ticket.change)}</b></div>`
      : '';
    const discount = ticket.discount > 0
      ? `<div class="row"><span>Reduction</span><b>- ${this.money(ticket.discount)}</b></div>`
      : '';

    ticketWindow.document.open();
    ticketWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${this.escapeHtml(sale.saleNumber || '')}</title><style>
      @page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;color:#111;font:12px Arial,sans-serif}.logo{display:block;max-width:42mm;max-height:22mm;margin:0 auto 5px;object-fit:contain}h1{text-align:center;font-size:17px;margin:3px 0}.meta{text-align:center;font-size:10px;line-height:1.45;margin-bottom:8px}.rule{border-top:1px dashed #222;margin:7px 0}table{width:100%;border-collapse:collapse}td{padding:5px 1px;border-bottom:1px dotted #aaa;vertical-align:top}td:nth-child(2){text-align:center;white-space:nowrap;font-size:10px}td:last-child{text-align:right;white-space:nowrap;font-weight:bold}small{display:block;color:#555;margin-top:2px}.row{display:flex;justify-content:space-between;gap:8px;padding:3px 0}.total{font-size:17px;border-top:2px solid #111;margin-top:5px;padding-top:7px}.change{font-size:14px}.thanks{text-align:center;font-weight:bold;margin:12px 0 4px}.footer{text-align:center;font-size:10px;line-height:1.4}</style></head><body>
      <img class="logo" src="${this.escapeHtml(logo)}" alt="Logo"><h1>${this.escapeHtml(settings.storeName || 'Tresor Boutique')}</h1>
      <div class="meta">Ticket ${this.escapeHtml(sale.saleNumber || '')}<br>${new Date(sale.saleDate || Date.now()).toLocaleString('fr-FR')}</div><div class="rule"></div>
      <table><tbody>${lines}</tbody></table>
      <div class="row"><span>Sous-total</span><b>${this.money(ticket.subtotal)}</b></div>${discount}
      <div class="row total"><span>TOTAL</span><b>${this.money(ticket.total)}</b></div>
      <div class="row"><span>Paiement</span><b>${this.paymentLabel(ticket.paymentMethod)}</b></div>${received}
      <div class="rule"></div><div class="thanks">Merci pour votre achat</div>
      <div class="footer">${this.escapeHtml(settings.address || '')}<br>${this.escapeHtml(settings.phone || '')}</div>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));window.addEventListener('afterprint',()=>window.close());<\/script>
      </body></html>`);
    ticketWindow.document.close();
  }

  private paymentLabel(value: string) {
    return ({ CASH: 'Especes', CARD: 'Carte bancaire', TRANSFER: 'Virement' } as Record<string, string>)[value] || value;
  }

  private escapeHtml(value: unknown) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
  }
}
