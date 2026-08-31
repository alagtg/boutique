import { Component, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/data.service';

@Component({
  selector: 'app-loyalty-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <section class="page-band">
      <div>
        <span class="eyebrow">Fidelite</span>
        <h2>Roue et cadeau mensuel</h2>
        <p>Liste des clients qui passent 300 DT, lien QR roue a envoyer, et tirage cadeau fin de mois.</p>
      </div>
      <div class="toolbar-actions">
        <input class="input compact" type="number" [(ngModel)]="year">
        <input class="input compact" type="number" [(ngModel)]="month">
        <button class="btn" (click)="load()">Filtrer</button>
      </div>
    </section>

    <div class="grid grid-2">
      <div class="card">
        <div class="section-title">
          <h3>Clients eligibles roue (+300 DT)</h3>
          <span class="badge success">{{ eligible().length }} eligible(s)</span>
        </div>
        <textarea class="textarea" [(ngModel)]="wheelMessage"></textarea>
        <div class="quick-list" style="margin-top:12px">
          <div class="quick-item" *ngFor="let c of eligible()">
            <strong>{{ c.firstName }} {{ c.lastName }}</strong>
            <div class="muted">{{ c.phone }} - {{ money(c.totalSpentCurrentMonth) }} ce mois</div>
            <div class="toolbar-actions" style="margin-top:10px">
              <a class="btn secondary" target="_blank" [href]="wheelLink(c)">Ouvrir roue QR</a>
              <a class="btn" target="_blank" [href]="whatsAppLink(c, wheelMessage)">Envoyer WhatsApp</a>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <h3>Cadeau fin de mois</h3>
          <span class="badge">{{ candidates().length }} participant(s)</span>
        </div>
        <p class="muted">Tous les clients qui ont achete au moins un article ce mois entrent dans le tirage.</p>
        <div class="quick-item" *ngIf="settings() as st">
          <strong>Cadeau a gagner</strong>
          <div>{{ st.monthlyGiftPrize }}</div>
          <div class="muted">{{ st.monthlyGiftReminderMessage }}</div>
        </div>
        <button class="btn" (click)="drawGift()">Tirage au hasard</button>
        <div class="hero-card" style="margin-top:14px" *ngIf="winner() as w">
          <span class="eyebrow">Gagnant</span>
          <h3>{{ w.firstName }} {{ w.lastName }}</h3>
          <p class="muted">{{ w.phone }}</p>
          <a class="btn" target="_blank" [href]="whatsAppLink(w, giftMessage)">Envoyer message cadeau</a>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-title">
        <h3>Liste tirage cadeau</h3>
        <span class="badge">{{ month }}/{{ year }}</span>
      </div>
      <table class="table">
        <thead><tr><th>Client</th><th>Telephone</th><th>Achats</th><th>Total mois</th><th>WhatsApp</th></tr></thead>
        <tbody>
          <tr *ngFor="let c of candidates()">
            <td>{{ c.firstName }} {{ c.lastName }}</td>
            <td>{{ c.phone }}</td>
            <td>{{ c.purchasesCount }}</td>
            <td>{{ money(c.totalMonth) }}</td>
            <td><a class="btn secondary" target="_blank" [href]="whatsAppLink(c, giftInfoMessage)">Informer</a></td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class LoyaltyPageComponent {
  private data = inject(DataService);

  eligible = signal<any[]>([]);
  candidates = signal<any[]>([]);
  winner = signal<any>(null);
  settings = signal<any>(null);
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;

  wheelMessage = `Bonjour {prenom},

Vous avez depasse 300 DT d'achats chez Tresor Boutique ce mois-ci.
Votre roue de chance est disponible ici:
{lien}

Bonne chance!
Tresor Boutique`;

  giftInfoMessage = `Bonjour {prenom},

Merci pour votre achat chez Tresor Boutique.
Vous etes dans la liste du tirage cadeau de fin de mois.

Tresor Boutique`;

  giftMessage = `Bonjour {prenom},

Felicitations! Vous avez gagne: {cadeau}.
Contactez-nous ou passez en boutique pour recuperer votre cadeau.

Tresor Boutique`;

  constructor() {
    this.load();
  }

  load() {
    this.data.wheelEligibleCustomers().subscribe(v => this.eligible.set(v));
    this.data.monthlyGiftCandidates(this.year, this.month).subscribe(v => this.candidates.set(v));
    this.data.storeSettings().subscribe(v => this.settings.set(v));
    this.winner.set(null);
  }

  drawGift() {
    this.data.monthlyGiftDraw(this.year, this.month).subscribe(v => this.winner.set(v.winner));
  }

  wheelLink(customer: any) {
    const token = customer.qrCodeToken || '';
    return `${window.location.origin}/client/wheel?token=${encodeURIComponent(token)}`;
  }

  whatsAppLink(customer: any, message: string) {
    const gift = this.settings()?.monthlyGiftPrize || 'cadeau mensuel Tresor Boutique';
    const text = message
      .replaceAll('{prenom}', customer.firstName || '')
      .replaceAll('{nom}', customer.lastName || '')
      .replaceAll('{lien}', this.wheelLink(customer))
      .replaceAll('{cadeau}', gift);
    return `https://wa.me/${this.normalizePhone(customer.phone)}?text=${encodeURIComponent(text)}`;
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }

  private normalizePhone(phone: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('216')) return digits;
    return `216${digits}`;
  }
}
