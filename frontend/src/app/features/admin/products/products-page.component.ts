import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { DataService } from '../../../core/data.service';
import { API_BASE_URL } from '../../../core/api.config';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <div class="inventory-layout">
      <div class="card">
        <div class="section-title">
          <div>
            <span class="eyebrow">Catalogue</span>
            <h3>{{ editingProductId ? 'Modifier article' : 'Ajouter un article avec photo' }}</h3>
          </div>
          <span class="badge">Image PC ou telephone</span>
        </div>

        <div class="product-form">
          <label class="upload-box">
            <input type="file" accept="image/*" (change)="selectImage($event)">
            <img *ngIf="previewUrl()" [src]="previewUrl()" alt="Apercu produit">
            <span *ngIf="!previewUrl()">Choisir une photo</span>
          </label>

          <div class="form-grid">
            <input class="input" [(ngModel)]="form.productName" placeholder="Nom article">
            <input class="input" [(ngModel)]="form.reference" placeholder="Reference">
            <select class="select" [(ngModel)]="form.categoryId">
              <option *ngFor="let c of categories()" [ngValue]="c.id">{{ c.name }}</option>
            </select>
            <input class="input" [(ngModel)]="form.color" placeholder="Couleur">
            <input class="input" [(ngModel)]="form.size" placeholder="Taille">
            <input *ngIf="isAdmin() && !editingProductId" class="input" [(ngModel)]="form.purchasePrice" type="number" min="0" placeholder="Prix achat unitaire (0 si deja paye)">
            <input *ngIf="isAdmin() && !editingProductId" class="input" [(ngModel)]="form.purchaseDate" type="date" title="Date achat stock">
            <input class="input" [(ngModel)]="form.salePrice" type="number" placeholder="Prix vente">
            <input class="input" [(ngModel)]="form.stock" type="number" placeholder="Stock initial">
            <input class="input" [(ngModel)]="form.barcode" placeholder="Code-barres auto si vide">
          </div>
        </div>

        <div class="profit-preview" *ngIf="isAdmin()">
          <div>
            <span>Benefice par article</span>
            <strong>{{ money(unitProfit()) }}</strong>
          </div>
          <div>
            <span>Benefice stock initial</span>
            <strong>{{ money(stockProfit()) }}</strong>
          </div>
          <div>
            <span>Depense nouvel achat stock</span>
            <strong>{{ money(initialPurchaseTotal()) }}</strong>
          </div>
        </div>
        <p class="muted" *ngIf="isAdmin() && !editingProductId">Mettez le prix d'achat a 0 pour un ancien stock deja paye. Un prix superieur a 0 sera ajoute automatiquement au registre Achats de stock.</p>

        <div class="toolbar-actions" style="margin-top:16px">
          <button class="btn" (click)="save()">Enregistrer article</button>
          <button class="btn secondary" (click)="resetForm()">Vider</button>
          <button class="btn ghost" *ngIf="editingProductId" (click)="cancelEdit()">Annuler edition</button>
        </div>
        <p *ngIf="message()" class="badge" style="margin-top:12px">{{ message() }}</p>
      </div>

      <div class="action-panel">
        <span class="eyebrow">Regles stock</span>
        <h3>Articles prets pour la caisse</h3>
        <p class="muted">Chaque variante a son code-barres. Les photos rendent le catalogue plus clair pour le client et l'equipe.</p>
        <div class="quick-list">
          <div class="quick-item">Scan POS avec douchette USB</div>
          <div class="quick-item">Alerte si stock inferieur au seuil</div>
          <div class="quick-item">Photo JPG, PNG ou WEBP</div>
        </div>
        <div class="type-box" *ngIf="isAdmin()">
          <input class="input" [(ngModel)]="newCategoryName" placeholder="Nouveau type produit">
          <button class="btn secondary" (click)="addCategory()">Ajouter type</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-title">
        <h3>Filtrer le catalogue</h3>
        <div class="toolbar-actions">
          <select class="select compact-select" [(ngModel)]="selectedCategory" (ngModelChange)="page = 1">
            <option value="">Tous les types</option>
            <option *ngFor="let c of categories()" [value]="c.name">{{ c.name }}</option>
          </select>
          <button class="btn secondary" (click)="selectedCategory = ''; page = 1">Reset</button>
        </div>
      </div>
    </div>

    <div class="product-grid" style="margin-top:18px">
      <article class="product-card" *ngFor="let p of pagedProducts()">
        <div class="product-photo">
          <img *ngIf="p.imageUrl; else noImage" [src]="imageUrl(p.imageUrl)" [alt]="p.productName">
          <ng-template #noImage><span>{{ initials(p.productName) }}</span></ng-template>
        </div>
        <div class="product-info">
          <div>
            <h3>{{ p.productName }}</h3>
            <p>{{ p.reference || 'Sans reference' }} - {{ p.category }}</p>
          </div>
          <div class="product-meta">
            <span class="badge">{{ p.variants?.[0]?.barcode }}</span>
            <span class="badge" [class.danger]="isLowStock(p)">
              Stock {{ p.variants?.[0]?.currentStock || 0 }}
            </span>
          </div>
          <div class="product-price">
            <strong>{{ money(p.variants?.[0]?.salePrice || 0) }}</strong>
            <span>{{ p.variants?.[0]?.color || '-' }} / {{ p.variants?.[0]?.size || '-' }}</span>
          </div>
          <div class="product-margin" *ngIf="isAdmin()">
            Achat {{ money(p.variants?.[0]?.purchasePrice || 0) }} - Gain {{ money(productUnitProfit(p)) }}
          </div>
          <div class="product-actions">
            <button class="btn secondary" (click)="editProduct(p)">Editer</button>
            <button class="btn danger" *ngIf="isAdmin()" (click)="deleteProduct(p)">Supprimer</button>
          </div>
        </div>
      </article>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-title">
        <span class="badge">{{ filteredProducts().length }} article(s) - page {{ page }} / {{ totalPages() }}</span>
        <div class="toolbar-actions">
          <select class="select compact" [(ngModel)]="pageSize" (ngModelChange)="page = 1">
            <option [ngValue]="6">6</option>
            <option [ngValue]="12">12</option>
            <option [ngValue]="24">24</option>
          </select>
          <button class="btn secondary" [disabled]="page <= 1" (click)="prevPage()">Precedent</button>
          <button class="btn secondary" [disabled]="page >= totalPages()" (click)="nextPage()">Suivant</button>
        </div>
      </div>
    </div>
  `
})
export class ProductsPageComponent {
  private data = inject(DataService);
  private auth = inject(AuthService);
  private assetBaseUrl = API_BASE_URL.replace('/api', '');

  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  message = signal('');
  previewUrl = signal('');
  newCategoryName = '';
  selectedCategory = '';
  editingProductId: number | null = null;
  page = 1;
  pageSize = 12;
  selectedFile: File | null = null;
  form = this.emptyForm();

  constructor() {
    this.loadCategories();
    this.load();
  }

  load() {
    this.data.products().subscribe(v => this.products.set(v));
  }

  loadCategories() {
    this.data.productCategories().subscribe(v => {
      this.categories.set(v);
      if (v.length && !this.form.categoryId) this.form.categoryId = v[0].id;
    });
  }

  addCategory() {
    const name = this.newCategoryName.trim();
    if (!name) return;
    this.data.createProductCategory(name).subscribe({
      next: category => {
        this.newCategoryName = '';
        this.form.categoryId = category.id;
        this.loadCategories();
      },
      error: err => this.message.set(err?.error?.message || 'Erreur type produit')
    });
  }

  selectImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedFile = file;

    if (!file) {
      this.previewUrl.set('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  save() {
    if (!this.form.productName.trim()) {
      this.message.set('Nom article obligatoire');
      return;
    }

    const payload = {
      productName: this.form.productName,
      reference: this.form.reference,
      description: '',
      categoryId: Number(this.form.categoryId),
      brandId: 1,
      purchaseDate: new Date(this.form.purchaseDate).toISOString(),
      variant: {
        id: this.form.variantId,
        barcode: this.form.barcode,
        color: this.form.color,
        size: this.form.size,
        purchasePrice: this.isAdmin() ? Number(this.form.purchasePrice) : 0,
        salePrice: Number(this.form.salePrice),
        currentStock: Number(this.form.stock),
        minStock: 3
      }
    };

    const request = this.editingProductId
      ? this.data.updateProduct(this.editingProductId, payload)
      : this.data.createProduct(payload);

    request.subscribe({
      next: (created: any) => {
        const productId = this.editingProductId || created.id;
        if (this.selectedFile && productId) {
          this.data.uploadProductImage(productId, this.selectedFile).subscribe({
            next: () => this.afterSave(this.editingProductId ? 'Produit et photo modifies' : 'Produit et photo enregistres'),
            error: () => {
              this.message.set('Produit enregistre, mais upload photo impossible');
              this.load();
            }
          });
          return;
        }

        this.afterSave(this.editingProductId ? 'Produit modifie' : 'Produit enregistre');
      },
      error: (err) => this.message.set(err?.error?.message || 'Erreur enregistrement')
    });
  }

  resetForm() {
    this.form = this.emptyForm();
    this.selectedFile = null;
    this.previewUrl.set('');
    this.editingProductId = null;
  }

  cancelEdit() {
    this.resetForm();
    this.message.set('');
  }

  editProduct(product: any) {
    const variant = product.variants?.[0] || {};
    this.editingProductId = product.id;
    this.form = {
      productName: product.productName || '',
      reference: product.reference || '',
      categoryId: product.categoryId || this.categories()[0]?.id || 1,
      color: variant.color || '',
      size: variant.size || '',
      purchasePrice: Number(variant.purchasePrice || 0),
      purchaseDate: new Date().toISOString().slice(0, 10),
      salePrice: Number(variant.salePrice || 0),
      stock: Number(variant.currentStock || 0),
      barcode: variant.barcode || '',
      variantId: variant.id || 0
    };
    this.previewUrl.set(product.imageUrl ? this.imageUrl(product.imageUrl) : '');
    this.selectedFile = null;
    this.message.set('Mode edition active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteProduct(product: any) {
    if (!confirm(`Supprimer ${product.productName} du catalogue ?`)) return;
    this.data.deleteProduct(product.id).subscribe({
      next: () => {
        this.message.set('Produit supprime');
        this.load();
      },
      error: err => this.message.set(err?.error?.message || 'Erreur suppression')
    });
  }

  imageUrl(path: string) {
    return path.startsWith('http') ? path : `${this.assetBaseUrl}${path}`;
  }

  initials(name: string) {
    return (name || 'TB').split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
  }

  isLowStock(product: any) {
    const variant = product.variants?.[0];
    return (variant?.currentStock || 0) <= (variant?.minStock || 0);
  }

  filteredProducts() {
    if (!this.selectedCategory) return this.products();
    return this.products().filter(p => p.category === this.selectedCategory);
  }

  pagedProducts() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredProducts().slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize));
  }

  nextPage() {
    this.page = Math.min(this.totalPages(), this.page + 1);
  }

  prevPage() {
    this.page = Math.max(1, this.page - 1);
  }

  isAdmin() {
    return this.auth.role() === 'ADMIN';
  }

  unitProfit() {
    return Number(this.form.salePrice || 0) - Number(this.form.purchasePrice || 0);
  }

  stockProfit() {
    return this.unitProfit() * Number(this.form.stock || 0);
  }

  initialPurchaseTotal() {
    return Number(this.form.purchasePrice || 0) * Number(this.form.stock || 0);
  }

  productUnitProfit(product: any) {
    const variant = product.variants?.[0];
    return Number(variant?.salePrice || 0) - Number(variant?.purchasePrice || 0);
  }

  money(value: number | null | undefined) {
    return `${Number(value || 0).toFixed(2)} DT`;
  }

  private afterSave(message: string) {
    this.message.set(message);
    this.resetForm();
    this.load();
  }

  private emptyForm() {
    return {
      productName: '',
      reference: '',
      categoryId: this.categories()[0]?.id || 1,
      color: '',
      size: '',
      purchasePrice: null as number | null,
      purchaseDate: new Date().toISOString().slice(0, 10),
      salePrice: null as number | null,
      stock: null as number | null,
      barcode: '',
      variantId: 0
    };
  }
}
