import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { DataService } from '../../../core/data.service';

@Component({
  selector: 'app-qr-page',
  standalone: true,
  imports: [FormsModule, NgIf],
  template: `
    <div class="login-shell" style="padding-top:40px;padding-bottom:40px">
      <div class="card login-card" style="max-width:620px">
        <div class="brand-block">
          <img src="/assets/logo.png" alt="Tresor logo">
          <div>
            <div class="brand-title">Bienvenue chez Trésor Boutique</div>
            <div class="brand-sub">Formulaire client via QR code</div>
          </div>
        </div>

        <div class="qr-box" style="margin-bottom:18px">
          <strong>Scannez, remplissez, rejoignez notre programme fidélité.</strong>
          <div class="muted" style="margin-top:6px">À la fin du mois : cadeau mensuel. À partir de 300 DT : roue de chance.</div>
        </div>

        <div class="form-grid">
          <input class="input" [(ngModel)]="form.firstName" placeholder="Prénom">
          <input class="input" [(ngModel)]="form.lastName" placeholder="Nom">
          <input class="input" [(ngModel)]="form.phone" placeholder="Téléphone">
          <input class="input" [(ngModel)]="form.email" placeholder="Email">
          <input class="input" [(ngModel)]="form.city" placeholder="Ville">
        </div>

        <button class="btn" style="width:100%;margin-top:16px" (click)="submit()">Envoyer mes coordonnées</button>

        <div class="card" style="margin-top:16px" *ngIf="result() as r">
          <strong>{{ r.message }}</strong>
          <div class="muted" style="margin-top:6px">ID client : {{ r.customerId }}</div>
          <div class="muted">Token QR : {{ r.qrCodeToken }}</div>
          <a class="btn secondary" style="margin-top:12px" [href]="wheelLink(r.qrCodeToken)">Voir lien roue</a>
        </div>
      </div>
    </div>
  `
})
export class QrPageComponent {
  private data = inject(DataService);
  result = signal<any>(null);
  form = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: ''
  };

  submit() {
    this.data.qrRegisterCustomer(this.form).subscribe(v => this.result.set(v));
  }

  wheelLink(token: string) {
    return `/client/wheel?token=${encodeURIComponent(token || '')}`;
  }
}
