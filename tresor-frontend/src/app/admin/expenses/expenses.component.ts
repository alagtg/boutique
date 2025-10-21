import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Expense } from '../../services/api.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css']
})
export class ExpensesComponent implements OnInit {
  private api = inject(ApiService);

  // Données
  items: Expense[] = [];
  loading = false;
  msg = '';

  // Filtres
  q = '';                        // recherche texte
  month = this.defaultMonth();   // filtre par mois (YYYY-MM)

  // Formulaire
  model: Expense = {
    label: '',
    amount: -10,
    date: new Date().toISOString().substring(0,10), // YYYY-MM-DD
    notes: ''
  };

  ngOnInit(){ this.load(); }

  defaultMonth(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  }

  load(){
    this.loading = true;
    this.api.listExpenses().subscribe({
      next: (d:any[]) => { this.items = d as Expense[]; this.loading = false; },
      error: _ => { this.loading = false; this.msg = '❌ Erreur de chargement'; }
    });
  }

  // --- Helpers de filtre ---
  get filtered(): Expense[] {
    const k = this.q.trim().toLowerCase();
    const [y, m] = this.month.split('-').map(n=>+n);
    return this.items
      .filter(e => {
        // filtre mois
        const ed = new Date(e.date as any);
        const okMonth = (!y || !m) ? true : (ed.getFullYear()===y && (ed.getMonth()+1)===m);
        // filtre texte
        const txt = `${e.label||''} ${e.notes||''}`.toLowerCase();
        const okText = !k || txt.includes(k);
        return okMonth && okText;
      })
      .sort((a,b) => (a.date > b.date ? -1 : 1)); // récentes d’abord
  }

  // --- Totaux du mois filtré ---
  get totalMois(): number {
    return this.filtered.reduce((s,e)=> s + (Number(e.amount)||0), 0);
  }
  get depensesMois(): number {
    return this.filtered.reduce((s,e)=> s + (e.amount<0 ? e.amount : 0), 0);
  }
  get recettesMois(): number {
    return this.filtered.reduce((s,e)=> s + (e.amount>0 ? e.amount : 0), 0);
  }

  // --- Actions ---
  add(){
    this.msg = '';
    const payload: Expense = {
      label: (this.model.label||'').trim(),
      amount: Number(this.model.amount),
      date: this.model.date,   // format YYYY-MM-DD (attendu par ton API)
      notes: (this.model.notes||'').trim()
    };
    if (!payload.label) { this.msg = 'Veuillez saisir un libellé'; return; }
    if (!payload.date)  { this.msg = 'Veuillez saisir une date'; return; }

    this.api.addExpense(payload).subscribe({
      next: () => {
        this.msg = '✅ Dépense enregistrée';
        this.resetForm();
        this.load();
      },
      error: _ => this.msg = '❌ Erreur à l’enregistrement'
    });
  }

  del(id?: number){
    if (!id) return;
    if (!confirm('Supprimer cette ligne ?')) return;
    this.api.deleteExpense(id).subscribe({
      next: () => { this.msg = '🗑️ Supprimé'; this.load(); },
      error: _ => this.msg = '❌ Erreur suppression'
    });
  }

  resetForm(){
    this.model = {
      label: '',
      amount: -10,
      date: new Date().toISOString().substring(0,10),
      notes: ''
    };
  }

  // Format simple TND
  formatTND(v:number){ return `${(Number(v)||0).toFixed(2)} TND`; }
}
