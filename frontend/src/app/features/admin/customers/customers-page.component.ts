import { Component, inject, signal } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/data.service';

@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf, DatePipe],
  template: `
    <div class="grid grid-2">
      <div class="card">
        <div class="section-title">
          <h3>{{ editingCustomerId ? 'Modifier le client' : 'Nouveau client' }}</h3>
          <span class="badge" *ngIf="editingCustomerId">Mode edition</span>
        </div>
        <div class="form-grid">
          <input class="input" [(ngModel)]="form.firstName" placeholder="Prenom">
          <input class="input" [(ngModel)]="form.lastName" placeholder="Nom">
          <input class="input" [(ngModel)]="form.phone" placeholder="Telephone">
          <input class="input" [(ngModel)]="form.email" placeholder="Email">
          <input class="input" [(ngModel)]="form.city" placeholder="Ville">
          <input class="input" [(ngModel)]="form.currentCreditAmount" type="number" placeholder="Credit client">
          <select class="select" [(ngModel)]="form.vipStatus">
            <option [ngValue]="false">Standard</option>
            <option [ngValue]="true">VIP</option>
          </select>
        </div>
        <div class="toolbar-actions" style="margin-top:16px">
          <button class="btn" (click)="save()">{{ editingCustomerId ? 'Enregistrer les modifications' : 'Enregistrer client' }}</button>
          <button class="btn secondary" *ngIf="editingCustomerId" (click)="cancelEdit()">Annuler</button>
        </div>
        <p *ngIf="message()" class="badge" style="margin-top:12px">{{ message() }}</p>
      </div>

      <div class="hero-card">
        <h3>WhatsApp clients</h3>
        <p class="muted">Message nouvelle collection. Un clic prepare WhatsApp pour tous les clients avec telephone.</p>
        <textarea class="textarea" [(ngModel)]="collectionMessage"></textarea>
        <div class="toolbar-actions" style="margin-top:12px">
          <button class="btn" (click)="openCollectionForAll()">Nouvelle collection a tous</button>
        </div>
        <div class="quick-list" style="margin-top:12px">
          <div class="quick-item">Variables disponibles: {{ '{prenom}' }}, {{ '{nom}' }}, {{ '{credit}' }}</div>
          <div class="quick-item">Le rappel credit apparait seulement si le client a un credit.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-title">
        <h3>Fiches clients</h3>
        <span class="badge">{{ customers().length }} client(s) - page {{ page }} / {{ totalPages() }}</span>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Client</th><th>Telephone</th><th>VIP</th><th>Total achats</th><th>Credit</th><th>WhatsApp</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of pagedCustomers()">
            <td>{{ c.firstName }} {{ c.lastName }}</td>
            <td>{{ c.phone }}</td>
            <td><span class="badge" [class.success]="c.vipStatus">{{ c.vipStatus ? 'VIP' : 'Standard' }}</span></td>
            <td>{{ money(c.totalSpentLifetime) }}</td>
            <td><span class="badge" [class.danger]="c.currentCreditAmount > 0">{{ money(c.currentCreditAmount) }}</span></td>
            <td>
              <div class="toolbar-actions">
                <a class="btn secondary" target="_blank" [href]="whatsAppLink(c, collectionMessage)">Nouvelle collection</a>
                <a class="btn secondary" target="_blank" *ngIf="c.currentCreditAmount > 0" [href]="whatsAppLink(c, creditMessage())">Rappel credit</a>
              </div>
            </td>
            <td>
              <div class="toolbar-actions">
                <button class="btn secondary" (click)="editCustomer(c)">Modifier</button>
                <button class="btn ghost" (click)="showDetail(c.id)">Voir detail</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="toolbar-actions" style="margin-top:14px">
        <select class="select compact" [(ngModel)]="pageSize" (ngModelChange)="page = 1">
          <option [ngValue]="10">10</option>
          <option [ngValue]="20">20</option>
          <option [ngValue]="50">50</option>
        </select>
        <button class="btn secondary" [disabled]="page <= 1" (click)="prevPage()">Precedent</button>
        <button class="btn secondary" [disabled]="page >= totalPages()" (click)="nextPage()">Suivant</button>
      </div>
    </div>

    <div class="card" style="margin-top:18px" *ngIf="detail() as d">
      <div class="section-title">
        <h3>Detail client - {{ d.firstName }} {{ d.lastName }}</h3>
        <span class="badge danger" *ngIf="d.currentCreditAmount > 300">Alerte credit &gt; 300 DT</span>
      </div>

      <div class="grid grid-3">
        <div>
          <div class="muted">Telephone</div>
          <strong>{{ d.phone }}</strong>
        </div>
        <div>
          <div class="muted">Fidelite</div>
          <strong>{{ d.loyalty?.pointsBalance || 0 }} points</strong>
        </div>
        <div>
          <div class="muted">Niveau</div>
          <strong>{{ d.loyalty?.tierLevel || '-' }}</strong>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div>
          <h4>Historique achats</h4>
          <div class="quick-list">
            <div class="quick-item" *ngFor="let s of d.salesHistory">
              <strong>{{ s.saleNumber }}</strong> - {{ money(s.totalAmount) }}
              <div class="muted">{{ s.saleDate | date:'yyyy-MM-dd HH:mm' }}</div>
              <div *ngFor="let line of s.lines">
                {{ line.productName }} - {{ line.quantity }} x {{ money(line.unitPrice) }}
              </div>
            </div>
          </div>
        </div>
        <div>
          <h4>Bons d'achat</h4>
          <div class="quick-list">
            <div class="quick-item" *ngFor="let v of d.vouchers">
              <strong>{{ v.code }}</strong> - {{ money(v.value) }}
              <div class="muted">Statut : {{ v.status }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CustomersPageComponent {
  private data = inject(DataService);
  customers = signal<any[]>([]);
  detail = signal<any>(null);
  message = signal('');
  page = 1;
  pageSize = 10;
  editingCustomerId: number | null = null;
  collectionMessage = `Bonjour {prenom},

Nouvelle collection disponible chez Tresor Boutique: robes, sacs, accessoires et nouveautes selectionnees.

Passez en boutique ou repondez a ce message pour reserver votre article prefere.

Tresor Boutique`;

  form = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    vipStatus: false,
    currentCreditAmount: 0
  };

  constructor() {
    this.load();
  }

  load() {
    this.data.customers().subscribe(v => this.customers.set(v));
  }

  showDetail(id: number) {
    this.data.customer(id).subscribe(v => this.detail.set(v));
  }

  pagedCustomers() {
    const start = (this.page - 1) * this.pageSize;
    return this.customers().slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.customers().length / this.pageSize));
  }

  nextPage() {
    this.page = Math.min(this.totalPages(), this.page + 1);
  }

  prevPage() {
    this.page = Math.max(1, this.page - 1);
  }

  save() {
    if (!this.form.firstName.trim() || !this.form.lastName.trim() || !this.form.phone.trim()) {
      this.message.set('Prenom, nom et telephone obligatoires');
      return;
    }

    const request = this.editingCustomerId
      ? this.data.updateCustomer(this.editingCustomerId, this.form)
      : this.data.createCustomer(this.form);

    request.subscribe({
      next: () => {
        this.message.set(this.editingCustomerId ? 'Client modifie avec succes' : 'Client enregistre');
        this.resetForm();
        this.load();
      },
      error: err => this.message.set(err?.error?.message || 'Erreur enregistrement client')
    });
  }

  editCustomer(customer: any) {
    this.editingCustomerId = customer.id;
    this.form = {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      phone: customer.phone || '',
      email: customer.email || '',
      city: customer.city || '',
      vipStatus: Boolean(customer.vipStatus),
      currentCreditAmount: Number(customer.currentCreditAmount || 0)
    };
    this.message.set('Modification de la fiche client');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.resetForm();
    this.message.set('');
  }

  private resetForm() {
    this.editingCustomerId = null;
    this.form = { firstName: '', lastName: '', phone: '', email: '', city: '', vipStatus: false, currentCreditAmount: 0 };
  }

  whatsAppLink(customer: any, message: string) {
    const text = message
      .replaceAll('{prenom}', customer.firstName || '')
      .replaceAll('{nom}', customer.lastName || '')
      .replaceAll('{credit}', this.money(customer.currentCreditAmount));

    return `https://wa.me/${this.normalizePhone(customer.phone)}?text=${encodeURIComponent(text)}`;
  }

  openCollectionForAll() {
    const list = this.customers().filter(c => this.normalizePhone(c.phone).length >= 8);
    if (!list.length) {
      this.message.set('Aucun telephone client');
      return;
    }

    const tabs = list.map(() => window.open('about:blank', '_blank'));
    let opened = 0;

    tabs.forEach((tab, index) => {
      if (!tab) return;
      opened += 1;
      tab.location.href = this.whatsAppLink(list[index], this.collectionMessage);
    });

    this.message.set(opened === list.length
      ? `${opened} message(s) WhatsApp ouverts`
      : `${opened}/${list.length} message(s) ouverts. Autorise les popups pour tout ouvrir en un clic.`);
  }

  creditMessage() {
    return `Bonjour {prenom},

Petit rappel de Tresor Boutique: votre credit actuel est de {credit}.
Merci de passer en boutique ou de nous contacter pour regulariser.

Tresor Boutique`;
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
