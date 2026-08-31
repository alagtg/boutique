import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { DataService } from '../../../core/data.service';
import { StoreService } from '../../../core/store.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <div class="grid grid-2">
      <div class="card" *ngIf="form() as f">
        <h3>Parametres boutique</h3>
        <div class="form-grid">
          <input class="input" [(ngModel)]="f.storeName" placeholder="Nom boutique">
          <input class="input" [(ngModel)]="f.phone" placeholder="Telephone">
          <input class="input" [(ngModel)]="f.whatsAppNumber" placeholder="WhatsApp">
          <input class="input" [(ngModel)]="f.address" placeholder="Adresse">
          <input class="input" [(ngModel)]="f.primaryColor" placeholder="Couleur principale">
          <input class="input" [(ngModel)]="f.secondaryColor" placeholder="Couleur secondaire">
          <input class="input" [(ngModel)]="f.backgroundColor" placeholder="Fond">
          <input class="input" [(ngModel)]="f.textColor" placeholder="Texte">
          <input class="input" [(ngModel)]="f.wheelEligibilityAmount" type="number" placeholder="Seuil roue">
          <input class="input" [(ngModel)]="f.reservationReminderDaysDefault" type="number" placeholder="Rappel reservation">
          <input class="input" [(ngModel)]="f.employeeMaxDiscountPercent" type="number" placeholder="Remise employe max">
          <input class="input" [(ngModel)]="f.monthlyGiftPrize" placeholder="Cadeau tirage mensuel">
        </div>
        <div class="wheel-settings">
          <div class="section-title">
            <div>
              <span class="eyebrow">Roue de chance</span>
              <h3>Les 12 cadeaux de la roue</h3>
            </div>
            <span class="badge">Modifiables</span>
          </div>
          <div class="wheel-prize-grid">
            <label *ngFor="let prize of wheelPrizes(); let i = index">
              <span>Case {{ i + 1 }}</span>
              <input class="input" [ngModel]="prize" (ngModelChange)="updatePrize(i, $event)" [placeholder]="'Cadeau case ' + (i + 1)">
            </label>
          </div>
        </div>
        <textarea class="textarea" [(ngModel)]="f.monthlyGiftReminderMessage" placeholder="Rappel fin de mois tirage cadeau"></textarea>
        <textarea class="textarea" [(ngModel)]="f.receiptFooterMessage" placeholder="Message ticket"></textarea>
        <button class="btn" style="margin-top:16px" (click)="save()">Enregistrer</button>
        <p *ngIf="message()" class="badge" style="margin-top:12px">{{ message() }}</p>
      </div>

      <div class="hero-card" *ngIf="form() as f">
        <h3>Apercu boutique</h3>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="quick-item" [style.background]="f.primaryColor" style="min-width:120px">Primary</div>
          <div class="quick-item" [style.background]="f.secondaryColor" style="min-width:120px">Secondary</div>
          <div class="quick-item" [style.background]="f.backgroundColor" style="min-width:120px">Background</div>
        </div>
        <div class="quick-list" style="margin-top:14px">
          <div class="quick-item">Roue: 12 cadeaux personnalises</div>
          <div class="quick-item">Tirage mensuel: {{ f.monthlyGiftPrize }}</div>
          <div class="quick-item">{{ f.monthlyGiftReminderMessage }}</div>
        </div>
      </div>
    </div>
  `
})
export class SettingsPageComponent {
  private data = inject(DataService);
  private store = inject(StoreService);
  form = signal<any>(null);
  message = signal('');
  wheelPrizes = signal<string[]>([]);

  constructor() {
    this.data.storeSettings().subscribe(v => {
      this.form.set(v);
      this.wheelPrizes.set(this.normalizePrizes(v?.wheelPrizes));
    });
  }

  save() {
    const payload = { ...this.form(), wheelPrizes: this.wheelPrizes().join('|') };
    this.data.updateStoreSettings(payload).subscribe({
      next: (v) => {
        this.message.set('Parametres enregistres');
        this.form.set(v);
        this.store.load();
      },
      error: (err) => this.message.set(err?.error?.message || 'Erreur mise a jour')
    });
  }

  updatePrize(index: number, value: string) {
    const prizes = [...this.wheelPrizes()];
    prizes[index] = value;
    this.wheelPrizes.set(prizes);
  }

  private normalizePrizes(value: string | null | undefined) {
    const defaults = [
      'Bon achat 5 DT', 'Reduction 5%', 'Petit cadeau', 'Bon achat 10 DT',
      'Reduction 10%', 'Accessoire offert', 'Bon achat 15 DT', 'Surprise boutique',
      'Reduction 15%', 'Bon achat 20 DT', 'Cadeau premium', 'Merci et a bientot'
    ];
    const saved = (value || '').split('|').map(x => x.trim()).filter(Boolean);
    return defaults.map((fallback, index) => saved[index] || fallback);
  }
}
