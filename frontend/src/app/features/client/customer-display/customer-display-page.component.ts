import { Component, computed, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { CustomerDisplayService } from '../../../core/customer-display.service';
import { StoreService } from '../../../core/store.service';

@Component({
  selector: 'app-customer-display-page',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <main class="customer-screen">
      <header class="customer-header">
        <div class="customer-brand">
          <img src="/assets/logo.png" alt="Logo de la boutique">
          <div>
            <h1>{{ storeName() }}</h1>
            <p>Merci pour votre visite</p>
          </div>
        </div>
        <div class="live-indicator"><i></i> Caisse en direct</div>
      </header>

      <section class="welcome-screen" *ngIf="state().status === 'IDLE'">
        <img src="/assets/logo.png" alt="Logo de la boutique">
        <p class="welcome-kicker">Bienvenue chez</p>
        <h2>{{ storeName() }}</h2>
        <p>Votre selection apparaitra ici.</p>
      </section>

      <section class="completed-screen" *ngIf="state().status === 'COMPLETED'">
        <div class="completed-mark">&#10003;</div>
        <p class="welcome-kicker">Paiement accepte</p>
        <h2>Merci pour votre achat</h2>
        <div class="completed-total">{{ money(state().total) }}</div>
        <div class="change-due" *ngIf="state().paymentMethod === 'CASH' && state().change > 0">
          Monnaie a rendre <strong>{{ money(state().change) }}</strong>
        </div>
        <p>A tres bientot chez {{ storeName() }}.</p>
      </section>

      <section class="sale-screen" *ngIf="state().status === 'ACTIVE'">
        <div class="sale-lines">
          <div class="sale-heading">
            <div>
              <span>Votre selection</span>
              <strong>{{ itemCount() }} article{{ itemCount() > 1 ? 's' : '' }}</strong>
            </div>
            <span *ngIf="state().customerName">Client : {{ state().customerName }}</span>
          </div>

          <div class="customer-items">
            <article class="customer-item" *ngFor="let item of state().items">
              <div class="item-photo" [class.no-photo]="!item.imageUrl">
                <img *ngIf="item.imageUrl" [src]="item.imageUrl" [alt]="item.productName">
                <span *ngIf="!item.imageUrl">{{ initials(item.productName) }}</span>
              </div>
              <div class="item-description">
                <strong>{{ item.productName }}</strong>
                <span *ngIf="item.color || item.size">{{ item.color || '' }} {{ item.size || '' }}</span>
                <small><b>{{ item.quantity }}x</b> &middot; {{ money(item.salePrice) }} l'unite</small>
              </div>
              <div class="item-total">{{ money(item.lineTotal) }}</div>
            </article>
          </div>
        </div>

        <aside class="customer-summary">
          <div class="summary-title">Montant de la vente</div>
          <div class="summary-row"><span>Sous-total</span><strong>{{ money(state().subtotal) }}</strong></div>
          <div class="summary-row discount-row" *ngIf="state().discount > 0">
            <span>Reduction</span><strong>- {{ money(state().discount) }}</strong>
          </div>
          <div class="total-block">
            <span>Total a payer</span>
            <strong>{{ money(state().total) }}</strong>
          </div>
          <div class="payment-detail">
            <span>Mode de paiement</span>
            <strong>{{ paymentLabel(state().paymentMethod) }}</strong>
          </div>
          <ng-container *ngIf="state().paymentMethod === 'CASH' && state().amountReceived > 0">
            <div class="payment-detail"><span>Montant recu</span><strong>{{ money(state().amountReceived) }}</strong></div>
            <div class="change-block"><span>Monnaie</span><strong>{{ money(state().change) }}</strong></div>
          </ng-container>
        </aside>
      </section>

      <footer>{{ storeAddress() }} <span *ngIf="storePhone()">&middot; {{ storePhone() }}</span></footer>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;background:#f7f3e9;color:#272015}
    .customer-screen{height:100vh;min-height:480px;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;background:#f7f3e9}
    .customer-header{height:96px;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px;background:#fff;border-bottom:3px solid #c9a13b}
    .customer-brand{display:flex;align-items:center;gap:15px;min-width:0}.customer-brand img{width:68px;height:62px;object-fit:contain}.customer-brand h1{margin:0;font-size:1.55rem;color:#765512}.customer-brand p{margin:3px 0 0;color:#756b5e}
    .live-indicator{display:flex;align-items:center;gap:8px;font-weight:800;color:#24584a;white-space:nowrap}.live-indicator i{width:10px;height:10px;border-radius:50%;background:#2f8a68;box-shadow:0 0 0 5px rgba(47,138,104,.12)}
    .welcome-screen,.completed-screen{display:grid;place-content:center;justify-items:center;text-align:center;padding:24px}.welcome-screen img{width:min(190px,28vh);max-height:170px;object-fit:contain;margin-bottom:14px}.welcome-kicker{text-transform:uppercase;font-size:.85rem;font-weight:900;color:#8b5e1b;margin:0 0 8px}.welcome-screen h2,.completed-screen h2{font-size:clamp(2rem,6vh,4.3rem);margin:0;color:#2b2114}.welcome-screen>p:last-child,.completed-screen>p:last-child{color:#756b5e;font-size:1.15rem;margin:16px 0 0}
    .sale-screen{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.75fr);min-height:0}.sale-lines{display:grid;grid-template-rows:auto 1fr;min-width:0;padding:20px 26px}.sale-heading{display:flex;justify-content:space-between;align-items:end;gap:16px;padding-bottom:14px;border-bottom:1px solid #ddd4c0}.sale-heading span{display:block;color:#756b5e;font-size:.85rem}.sale-heading strong{display:block;margin-top:4px;font-size:1.25rem}
    .customer-items{overflow:auto;padding-right:8px}.customer-item{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #e2dac8}.item-photo{width:68px;height:68px;border-radius:6px;background:#fff;border:1px solid #dec985;overflow:hidden;display:grid;place-items:center}.item-photo img{width:100%;height:100%;object-fit:contain}.item-photo.no-photo{background:#fff9e9;color:#765512;font-weight:900;font-size:1.1rem}.item-description{min-width:0}.item-description strong,.item-description span,.item-description small{display:block}.item-description strong{font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item-description span,.item-description small{color:#756b5e;margin-top:3px}.item-description small b{color:#765512}.item-total{font-size:1.08rem;font-weight:900;white-space:nowrap}
    .customer-summary{display:flex;flex-direction:column;padding:24px;background:#2b2114;color:#fff}.summary-title{text-transform:uppercase;color:#e7c867;font-size:.82rem;font-weight:900;margin-bottom:18px}.summary-row,.payment-detail,.change-block{display:flex;justify-content:space-between;gap:16px;padding:10px 0}.summary-row{font-size:1.05rem}.discount-row{color:#efc4ce}.total-block{margin:10px 0 18px;padding:18px 0;border-top:1px solid rgba(255,255,255,.24);border-bottom:1px solid rgba(255,255,255,.24)}.total-block span{display:block;color:#e8dfd1}.total-block strong{display:block;margin-top:5px;color:#f2ce62;font-size:clamp(2rem,5vw,3.8rem);line-height:1;white-space:nowrap}.payment-detail{color:#ddd4c5}.payment-detail strong{color:#fff}.change-block{margin-top:auto;padding:16px;border-radius:6px;background:#f2ce62;color:#2b2114;font-size:1.1rem}.change-block strong{font-size:1.35rem}
    .completed-mark{width:76px;height:76px;display:grid;place-items:center;border-radius:50%;background:#24584a;color:white;font-size:2.8rem;margin-bottom:16px}.completed-total{font-size:clamp(2.4rem,7vh,5rem);font-weight:900;color:#8b5e1b;margin:12px 0}.change-due{padding:13px 20px;background:#fff;border:1px solid #dec985;border-radius:6px;font-size:1.15rem}.change-due strong{margin-left:18px;color:#24584a;font-size:1.4rem}
    footer{height:38px;display:flex;align-items:center;justify-content:center;padding:0 18px;background:#fff;border-top:1px solid #ded5c3;color:#756b5e;font-size:.82rem;text-align:center}
    @media(max-width:700px){.customer-header{height:76px;padding:8px 14px}.customer-brand img{width:50px;height:48px}.customer-brand h1{font-size:1.1rem}.customer-brand p,.live-indicator{font-size:.72rem}.sale-screen{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}.sale-lines{padding:12px 16px}.customer-summary{padding:14px 16px}.summary-title,.summary-row{display:none}.total-block{margin:0 0 8px;padding:8px 0}.total-block strong{font-size:2rem}.payment-detail{padding:5px 0}.change-block{margin-top:6px;padding:9px 12px}.customer-item{padding:9px 0}}
  `]
})
export class CustomerDisplayPageComponent {
  private display = inject(CustomerDisplayService);
  private store = inject(StoreService);
  readonly state = this.display.state;
  readonly itemCount = computed(() => this.state().items.reduce((sum, item) => sum + item.quantity, 0));
  readonly storeName = computed(() => this.store.settings()?.storeName ?? 'Tresor Boutique');
  readonly storeAddress = computed(() => this.store.settings()?.address ?? '');
  readonly storePhone = computed(() => this.store.settings()?.phone ?? '');

  money(value: number | null | undefined) { return `${Number(value || 0).toFixed(2)} DT`; }
  paymentLabel(value: string) {
    return ({ CASH: 'Especes', CARD: 'Carte bancaire', TRANSFER: 'Virement' } as Record<string, string>)[value] || value;
  }
  initials(value: string) { return value.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }
}
