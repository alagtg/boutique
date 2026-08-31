import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../../core/data.service';

@Component({
  selector: 'app-wheel-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <div class="login-shell wheel-shell">
      <div class="card login-card wheel-card">
        <div class="brand-block">
          <img src="/assets/logo.png" alt="Tresor logo">
          <div>
            <div class="brand-title">Roue de chance Tresor Boutique</div>
            <div class="brand-sub">Acces client avec telephone ou lien WhatsApp</div>
          </div>
        </div>

        <div class="card wheel-search" *ngIf="!customer()">
          <h3>Entrer le telephone client</h3>
          <p class="muted">Pas besoin de QR. Le client saisit son numero et la boutique verifie ses achats du mois.</p>
          <div class="form-grid">
            <input class="input" [(ngModel)]="phone" placeholder="Ex: 54424213">
            <button class="btn" (click)="checkPhone()">Verifier</button>
          </div>
          <p class="badge danger" style="margin-top:12px" *ngIf="error()">{{ error() }}</p>
        </div>

        <ng-container *ngIf="customer() as c">
          <div class="qr-box" style="margin-bottom:18px">
            <strong>{{ c.firstName }} {{ c.lastName }}</strong>
            <div class="muted" style="margin-top:6px">{{ c.message }}</div>
            <div class="toolbar-actions" style="justify-content:center;margin-top:10px">
              <span class="badge">Achats mois: {{ money(c.totalSpentCurrentMonth) }}</span>
              <span class="badge">Minimum: {{ money(c.threshold) }}</span>
            </div>
          </div>

          <div class="wheel-stage">
            <div class="wheel-pointer"></div>
            <div class="wheel-circle" [class.spin]="spinning()">
              <span class="wheel-label" *ngFor="let p of wheelSegments(c.prizes); let i = index" [style.transform]="segmentRotation(i, wheelSegments(c.prizes).length)">
                {{ p }}
              </span>
            </div>
            <div class="wheel-center"><img src="/assets/logo.png" alt="Tresor Boutique"></div>
          </div>

          <div class="hero-card result-card" *ngIf="result()">
            <span class="eyebrow">Resultat</span>
            <h3>{{ result() }}</h3>
          </div>

          <button class="btn" style="width:100%;margin-top:14px" [disabled]="!c.eligible || hasSpun() || spinning()" (click)="spin()">
            {{ hasSpun() ? 'Roue deja tournee' : c.eligible ? 'Tourner la roue' : 'Roue bloquee' }}
          </button>
          <button class="btn secondary" style="width:100%;margin-top:10px" (click)="reset()">Verifier un autre client</button>
        </ng-container>
      </div>
    </div>
  `
})
export class WheelPageComponent {
  private route = inject(ActivatedRoute);
  private data = inject(DataService);

  phone = '';
  customer = signal<any>(null);
  result = signal('');
  error = signal('');
  hasSpun = signal(false);
  spinning = signal(false);

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    this.data.wheelByToken(token).subscribe({
      next: v => this.customer.set(v),
      error: err => this.error.set(err?.error?.message || 'Client introuvable ou lien invalide.')
    });
  }

  checkPhone() {
    this.error.set('');
    if (!this.phone.trim()) {
      this.error.set('Telephone obligatoire');
      return;
    }

    this.data.wheelByPhone(this.phone).subscribe({
      next: v => this.customer.set(v),
      error: err => this.error.set(err?.error?.message || 'Client introuvable avec ce telephone.')
    });
  }

  spin() {
    if (!this.customer()?.eligible || this.hasSpun() || this.spinning()) return;
    const options = this.wheelSegments(this.customer().prizes);
    this.spinning.set(true);
    setTimeout(() => {
      const index = Math.floor(Math.random() * options.length);
      this.result.set(options[index]);
      this.hasSpun.set(true);
      this.spinning.set(false);
    }, 900);
  }

  reset() {
    this.customer.set(null);
    this.result.set('');
    this.error.set('');
    this.hasSpun.set(false);
    this.spinning.set(false);
  }

  prizes(values: string[] | null | undefined) {
    return values?.length ? values : this.defaultPrizes;
  }

  wheelSegments(values: string[] | null | undefined) {
    const base = this.prizes(values);
    return Array.from({ length: 12 }, (_, index) => base[index]?.trim() || this.defaultPrizes[index]);
  }

  segmentRotation(index: number, total: number) {
    const angle = (360 / total) * index;
    return `translate(-50%, -50%) rotate(${angle}deg) translateY(-132px) rotate(${-angle}deg)`;
  }

  private defaultPrizes = [
    'Bon achat 5 DT', 'Reduction 5%', 'Petit cadeau', 'Bon achat 10 DT',
    'Reduction 10%', 'Accessoire offert', 'Bon achat 15 DT', 'Surprise boutique',
    'Reduction 15%', 'Bon achat 20 DT', 'Cadeau premium', 'Merci et a bientot'
  ];

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }
}
