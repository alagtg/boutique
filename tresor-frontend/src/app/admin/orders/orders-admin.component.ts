import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

type OrderItem = { product?: { name?: string }, size?:string, color?:string, quantity:number, unitPrice:number };
type Order = {
  id:number;
  createdAt:string;
  customerName:string;
  phone:string;
  address?:string;
  note?:string;
  items: OrderItem[];
  status?: 'pending'|'confirmed'|'shipped'|'delivered'|'canceled'|any;
  callStatus?: 'none'|'answered'|'noanswer'|any;
};

type CustomerRow = {
  name: string;
  phone: string;
  address?: string;
  lastOrderAt?: string;
  ordersCount: number;
};

const LS_CUSTOMERS_KEY     = 'tresor_customers';
const LS_HIDDEN_ORDERS_KEY = 'tresor_hidden_orders';
const LS_CALL_STATUS_KEY   = 'tresor_call_status'; // { [orderId:number]: 'none'|'answered'|'noanswer' }

function normalizeCallStatus(v:any): 'none'|'answered'|'noanswer' {
  if (v === 1 || v === 'answered') return 'answered';
  if (v === 2 || v === 'noanswer') return 'noanswer';
  return 'none';
}
function normalizeOrderStatus(v:any): 'pending'|'confirmed'|'shipped'|'delivered'|'canceled' {
  if (typeof v === 'number') {
    return (['pending','confirmed','shipped','delivered','canceled'][v] as any) ?? 'pending';
  }
  return (v as any) ?? 'pending';
}
function normPhone(raw?: string): string {
  if (!raw) return '';
  let p = raw.replace(/\D+/g, '');
  if (p.length === 8) p = '216' + p;          // numéro tunisien court -> +216
  if (p.startsWith('00216')) p = p.replace(/^00/, '');
  return p;
}

@Component({
  selector: 'app-orders-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders-admin.component.html',
  styleUrls: ['./orders-admin.component.css']
})
export class OrdersAdminComponent implements OnInit {
  private api = inject(ApiService);

  orders: Order[] = [];
  loading = false;
  msg = '';

  // --- commandes (recherche + pagination) ---
  q = '';
  pageO = 1;
  pageSizeO = 4; // comme ton exemple

  // --- clients (persistés localement) ---
  customers: CustomerRow[] = [];
  qC = '';
  pageC = 1;
  pageSizeC = 6;

  // --- IDs de commandes “archivées” (UI only) ---
  hiddenOrderIds = new Set<number>();

  // statut d’appel persistant
  private callStatusMap = new Map<number, 'none'|'answered'|'noanswer'>();

  resetDate = new Date().toISOString().substring(0,10); // YYYY-MM-DD

  ngOnInit(){
    this.restoreHiddenOrders();
    this.restoreCustomers();
    this.loadCallStatusFromLS();
    this.load();
  }

  // Chargement commandes + construction carnet clients
  load(){
    this.loading = true;
    this.api.listOrders().subscribe({
      next: (d:any[]) => {
        const normalized = (d as Order[]).map(o=>({
          ...o,
          status: normalizeOrderStatus(o.status),
          callStatus: normalizeCallStatus(o.callStatus)
        })).sort((a,b)=> (a.createdAt > b.createdAt ? -1 : 1));

        // Appliquer les statuts d’appel sauvegardés
        for (const o of normalized) {
          const saved = this.callStatusMap.get(o.id);
          if (saved) o.callStatus = saved;
        }

        this.orders = normalized;

        // Construire carnet clients (dédupe par téléphone normalisé)
        const map = new Map<string, CustomerRow>();
        const seenByPhone = new Map<string, Set<number>>();

        for (const o of this.orders) {
          const phoneN = normPhone(o.phone);
          if (!phoneN) continue;

          const seen = seenByPhone.get(phoneN) ?? new Set<number>();
          if (!seen.has(o.id)) {
            seen.add(o.id);
            seenByPhone.set(phoneN, seen);
          }
          const prev = map.get(phoneN);
          const row: CustomerRow = {
            name: o.customerName || prev?.name || '',
            phone: phoneN,
            address: o.address || prev?.address,
            lastOrderAt: (!prev?.lastOrderAt || (prev.lastOrderAt ?? '') < o.createdAt) ? o.createdAt : prev?.lastOrderAt,
            ordersCount: seen.size
          };
          map.set(phoneN, row);
        }

        this.customers = Array.from(map.values())
          .sort((a,b)=> (a.lastOrderAt ?? '') > (b.lastOrderAt ?? '') ? -1 : 1);
        this.persistCustomers();

        // Corriger page si dépasse
        if (this.pageO > this.totalPagesO) this.pageO = this.totalPagesO || 1;
        if (this.pageC > this.totalPagesC) this.pageC = this.totalPagesC || 1;

        this.loading = false;
      },
      error: _ => { this.loading = false; this.msg='❌ Erreur de chargement'; }
    });
  }

  // ----------------- Commandes : filtre + pagination + pages -----------------
  get filteredOrders(): Order[] {
    const k = this.q.trim().toLowerCase();
    return this.orders
      .filter(o => !this.hiddenOrderIds.has(o.id)) // masque celles archivées
      .filter(o => {
        const hay = `${o.customerName||''} ${o.phone||''} ${o.address||''} ${o.note||''}`.toLowerCase();
        return !k || hay.includes(k);
      });
  }
  get totalPagesO(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSizeO));
  }
  get pageItemsO(): Order[] {
    const start = (this.pageO - 1) * this.pageSizeO;
    return this.filteredOrders.slice(start, start + this.pageSizeO);
  }
  goToO(p:number){ if (p<1 || p>this.totalPagesO) return; this.pageO = p; }
  prevO(){ this.goToO(this.pageO-1); }
  nextO(){ this.goToO(this.pageO+1); }

  // fabrique la liste des boutons [1 ... n] avec ellipses
  get pagesO(): number[] {
    return this.makePages(this.totalPagesO, this.pageO);
  }

  total(o:Order): number {
    if (!o?.items) return 0;
    return o.items.reduce((s,i)=> s + ((i?.unitPrice||0)*(i?.quantity||0)), 0);
  }

  // Appel tel
  telHref(num?:string){ return num ? `tel:${num.replace(/\s+/g,'')}` : ''; }

  // --- Call status (persistant UI)
  markAnswered(o: Order){
    o.callStatus = 'answered';
    this.callStatusMap.set(o.id, 'answered');
    this.saveCallStatusToLS();
    this.msg='📞 Répondu (OK)';
  }
  markNoAnswer(o: Order){
    o.callStatus = 'noanswer';
    this.callStatusMap.set(o.id, 'noanswer');
    this.saveCallStatusToLS();
    this.msg='📞 Pas de réponse (NON)';
  }
  resetCall(o: Order){
    o.callStatus = 'none';
    this.callStatusMap.set(o.id, 'none');
    this.saveCallStatusToLS();
    this.msg='↺ Appel à faire';
  }

  // ARCHIVE UI (ne touche pas l’API ni le stock)
  archive(o:Order){
    if (!confirm(`Archiver la commande #${o.id} (elle disparaîtra de la liste, le client reste) ?`)) return;
    this.hiddenOrderIds.add(o.id);
    this.persistHiddenOrders();
    this.msg = '🗂️ Commande archivée (UI uniquement)';

    // si la page devient vide, recule d’une page
    if (this.pageItemsO.length===0 && this.pageO>1) this.pageO--;
  }

  // Reset du jour (archive UI toutes les commandes de la date)
  resetDay(){
    if (!this.resetDate) return;
    if (!confirm(`Archiver TOUTES les commandes du ${this.resetDate} (UI uniquement) ?`)) return;
    const day = this.resetDate;
    for (const o of this.orders) {
      const d = (o.createdAt||'').substring(0,10);
      if (d === day) this.hiddenOrderIds.add(o.id);
    }
    this.persistHiddenOrders();
    this.msg = '✅ Journée archivée (UI uniquement)';
    if (this.pageItemsO.length===0 && this.pageO>1) this.pageO = 1;
  }

  // Persistance “archivées”
  persistHiddenOrders(){
    try {
      localStorage.setItem(LS_HIDDEN_ORDERS_KEY, JSON.stringify(Array.from(this.hiddenOrderIds)));
    } catch {}
  }
  restoreHiddenOrders(){
    try {
      const raw = localStorage.getItem(LS_HIDDEN_ORDERS_KEY);
      if (raw) this.hiddenOrderIds = new Set<number>(JSON.parse(raw) as number[]);
    } catch {}
  }

  // ----------------- Carnet clients : filtre + pagination + pages -----------------
  get filteredCustomers(): CustomerRow[] {
    const k = this.qC.trim().toLowerCase();
    return this.customers.filter(c=>{
      const hay = `${c.name||''} ${c.phone||''} ${c.address||''}`.toLowerCase();
      return !k || hay.includes(k);
    });
  }
  get totalPagesC(): number {
    return Math.max(1, Math.ceil(this.filteredCustomers.length / this.pageSizeC));
  }
  get pageItemsC(): CustomerRow[] {
    const start = (this.pageC - 1) * this.pageSizeC;
    return this.filteredCustomers.slice(start, start + this.pageSizeC);
  }
  goToC(p:number){ if (p<1 || p>this.totalPagesC) return; this.pageC = p; }
  prevC(){ this.goToC(this.pageC-1); }
  nextC(){ this.goToC(this.pageC+1); }

  get pagesC(): number[] {
    return this.makePages(this.totalPagesC, this.pageC);
  }

  // Persist carnet clients
  persistCustomers(){
    try { localStorage.setItem(LS_CUSTOMERS_KEY, JSON.stringify(this.customers)); } catch {}
  }
  restoreCustomers(){
    try {
      const raw = localStorage.getItem(LS_CUSTOMERS_KEY);
      if (raw) this.customers = JSON.parse(raw) as CustomerRow[];
    } catch {}
  }

  // --- Call status LS helpers
  private loadCallStatusFromLS(){
    try{
      const raw = localStorage.getItem(LS_CALL_STATUS_KEY);
      if(raw){
        const obj = JSON.parse(raw) as Record<string, 'none'|'answered'|'noanswer'>;
        this.callStatusMap = new Map<number, 'none'|'answered'|'noanswer'>(
          Object.entries(obj).map(([k,v])=> [Number(k), normalizeCallStatus(v)])
        );
      }
    }catch{}
  }
  private saveCallStatusToLS(){
    try{
      const obj: Record<number, 'none'|'answered'|'noanswer'> = {};
      for(const [k,v] of this.callStatusMap.entries()) obj[k]=v;
      localStorage.setItem(LS_CALL_STATUS_KEY, JSON.stringify(obj));
    }catch{}
  }

  // --- Générateur de pagination avec ellipses (…)
  private makePages(total:number, current:number): number[] {
    // If peu de pages, on les montre toutes
    if (total <= 7) return Array.from({length: total}, (_,i)=> i+1);

    const pages:number[] = [];
    const push = (n:number)=> pages.push(n);

    const addRange = (from:number, to:number) => {
      for(let i=from;i<=to;i++) push(i);
    };

    push(1);

    const left = Math.max(2, current - 2);
    const right = Math.min(total - 1, current + 2);

    if (left > 2) push(-1);           // ellipses
    addRange(left, right);
    if (right < total - 1) push(-1);  // ellipses

    push(total);
    return pages;
  }
}
