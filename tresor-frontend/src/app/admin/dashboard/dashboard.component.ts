import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

type OrderItem = { quantity: number; unitPrice: number };
type Order = {
  id: number;
  createdAt: string;              // ISO
  status?: string | number;       // 'canceled' etc. (optionnel)
  items?: OrderItem[];
};

type Expense = {
  id: number;
  label?: string;
  amount: number;                 // montant (positif pour charge)
  date: string;                   // ISO (yyyy-mm-dd ou ISO complet)
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);

  // états
  loading = signal(true);
  error   = signal<string>('');

  // données brutes
  orders   = signal<Order[]>([]);
  expenses = signal<Expense[]>([]);

  // dates pivot
  now = new Date();
  startOfDay   = new Date(new Date().setHours(0,0,0,0));
  startOfMonth = new Date(new Date(new Date().getFullYear(), new Date().getMonth(), 1).setHours(0,0,0,0));

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.error.set('');
    // On charge en parallèle
    let ordersLoaded = false, expensesLoaded = false;

    const done = () => {
      if (ordersLoaded && expensesLoaded) this.loading.set(false);
    };

    this.api.listOrders().subscribe({
      next: (o:any[]) => { this.orders.set((o ?? []) as Order[]); ordersLoaded = true; done(); },
      error: _ => { this.error.set('Impossible de charger les commandes'); ordersLoaded = true; done(); }
    });

    this.api.listExpenses().subscribe({
      next: (e:any[]) => { this.expenses.set((e ?? []) as Expense[]); expensesLoaded = true; done(); },
      error: _ => { this.error.set('Impossible de charger les dépenses'); expensesLoaded = true; done(); }
    });
  }

  // ---- helpers ----
  private asDate(v?: string): Date {
    if (!v) return new Date(0);
    // Permet d'accepter "2025-10-08" ou "2025-10-08T10:22:00Z"
    return v.length <= 10 ? new Date(v + 'T00:00:00') : new Date(v);
  }
  private isCanceled(status: any): boolean {
    if (status == null) return false;
    if (typeof status === 'string') return status.toLowerCase() === 'canceled';
    if (typeof status === 'number') {
      // mapping optionnel (ex: 4 = canceled)
      return status === 4;
    }
    return false;
  }
  private orderTotal(o: Order): number {
    if (!o?.items?.length) return 0;
    return o.items.reduce((s, i) => s + (Number(i.unitPrice || 0) * Number(i.quantity || 0)), 0);
    // NB: si tu veux forcer 2 décimales côté affichage -> use pipe dans le template
  }

  // ---- calculs KPI (computed = recalcul auto si orders/expenses changent) ----
  caJour = computed(() => {
    const start = this.startOfDay.getTime();
    return this.orders().reduce((sum, o) => {
      const d = this.asDate(o.createdAt).getTime();
      if (d >= start && !this.isCanceled(o.status)) {
        sum += this.orderTotal(o);
      }
      return sum;
    }, 0);
  });

  caMois = computed(() => {
    const start = this.startOfMonth.getTime();
    return this.orders().reduce((sum, o) => {
      const d = this.asDate(o.createdAt).getTime();
      if (d >= start && !this.isCanceled(o.status)) {
        sum += this.orderTotal(o);
      }
      return sum;
    }, 0);
  });

  depensesMois = computed(() => {
    const start = this.startOfMonth.getTime();
    return this.expenses().reduce((sum, e) => {
      const d = this.asDate(e.date).getTime();
      if (d >= start) sum += Number(e.amount || 0);
      return sum;
    }, 0);
  });

  beneficeNet = computed(() => this.caMois() - this.depensesMois());

  // cartes "mini-infos"
  nbCmdJour = computed(() => {
    const start = this.startOfDay.getTime();
    return this.orders().filter(o =>
      this.asDate(o.createdAt).getTime() >= start && !this.isCanceled(o.status)
    ).length;
  });

  nbCmdMois = computed(() => {
    const start = this.startOfMonth.getTime();
    return this.orders().filter(o =>
      this.asDate(o.createdAt).getTime() >= start && !this.isCanceled(o.status)
    ).length;
  });

  // formatage date entête
  get todayNice(): string {
    const d = this.now;
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
}
