import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Product } from '../../services/api.service';

type ProductModel = {
  id?: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  isPublished: boolean;
  description?: string;
};

@Component({
  selector: 'app-products-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products-admin.component.html',
  styleUrls: ['./products-admin.component.css'] // Ensure this file exists in the same folder as this component
})
export class ProductsAdminComponent implements OnInit {
  private api = inject(ApiService);

  products: Product[] = [];
  filtered: Product[] = [];
  q = ''; // recherche

  // formulaire
  model: ProductModel = this.emptyModel();
  editingId: number | null = null;

  // upload image
  selectedFile?: File;
  imagePreview: string | null = null;
  isUploading = false;

  // feedback
  msg = '';
  loading = false;

  ngOnInit(){ this.refresh(); }

  emptyModel(): ProductModel {
    return { name:'', price:0, stock:0, category:'Autre', isPublished:true, imageUrl:'', description:'' };
  }

 refresh(){
  this.loading = true;
  this.api.listProducts(/* pas de param ici */).subscribe({
    next: p => { this.products = p; this.applyFilter(); this.loading = false; },
    error: _ => { this.loading = false; }
  });
}


  applyFilter(){
    const k = this.q.trim().toLowerCase();
    this.filtered = !k ? this.products : this.products.filter(p =>
      (p.name || '').toLowerCase().includes(k) ||
      (p.category || '').toLowerCase().includes(k)
    );
  }

  onFileChange(ev: Event){
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // contrôle simple
    if (!file.type.startsWith('image/')) {
      this.msg = 'Fichier invalide : image requise';
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      this.msg = 'Image trop volumineuse (max 5MB)';
      return;
    }

    this.selectedFile = file;
    // preview
    const reader = new FileReader();
    reader.onload = () => this.imagePreview = reader.result as string;
    reader.readAsDataURL(file);
  }

 // Dans src/app/admin/products/products-admin.component.ts
private fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 1) Essaie l’upload serveur (/api/files)
 * 2) Si 404 ou erreur -> fallback DataURL (base64) directement dans imageUrl
 */
uploadIfNeeded(): Promise<string | undefined> {
  return new Promise(async (resolve) => {
    // Aucun nouveau fichier -> on garde l’URL existante (ou vide)
    if (!this.selectedFile) return resolve(this.model.imageUrl);

    this.isUploading = true;

    // Tentative d’upload serveur (si jamais l’endpoint existe chez toi)
    this.api.uploadImage(this.selectedFile!).subscribe({
      next: ({ url }) => {
        this.isUploading = false;
        this.msg = '✅ Upload serveur';
        resolve(url);
      },
      error: async () => {
        // Fallback 100% front : conversion base64
        this.isUploading = false;
        try {
          const dataUrl = await this.fileToDataUrl(this.selectedFile!);

          // (optionnel) limiter la taille du base64 (~2 Mo) :
          if (dataUrl.length > 2_000_000 * 1.37) {
            this.msg = '⚠️ Image trop lourde en base64 (>~2Mo). Réduis la taille.';
            return resolve(undefined);
          }

          this.msg = 'ℹ️ Endpoint /files absent : image enregistrée en base64.';
          resolve(dataUrl);
        } catch {
          this.msg = '❌ Upload échoué (et fallback base64 impossible)';
          resolve(undefined);
        }
      }
    });
  });
}


  async save(){
    this.msg = '';
    try {
      const url = await this.uploadIfNeeded();
      const payload = { ...this.model, imageUrl: url ?? '' };

      if (this.editingId) {
        this.api.updateProduct(this.editingId, payload).subscribe({
          next: () => { this.msg='✅ Produit mis à jour'; this.resetForm(); this.refresh(); },
          error: () => this.msg='❌ Erreur mise à jour'
        });
      } else {
        this.api.createProduct(payload).subscribe({
          next: () => { this.msg='✅ Produit créé'; this.resetForm(); this.refresh(); },
          error: () => this.msg='❌ Erreur création'
        });
      }
    } catch { /* msg déjà posé */ }
  }

  edit(p: Product){
    this.editingId = p.id;
    this.model = {
      id: p.id, name: p.name, price: p.price, stock: p.stock,
      category: p.category, imageUrl: p.imageUrl, isPublished: p.isPublished,
      description: (p as any).description ?? ''
    };
    this.selectedFile = undefined;
    this.imagePreview = p.imageUrl || null;
    this.msg = '';
  }

  togglePublish(p: Product){
    this.api.updateProduct(p.id, { ...p, isPublished: !p.isPublished }).subscribe({
      next: () => { p.isPublished = !p.isPublished; },
      error: () => this.msg='❌ Erreur publication'
    });
  }

  remove(p: Product){
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    this.api.deleteProduct(p.id).subscribe({
      next: () => { this.msg = '🗑️ Supprimé'; this.refresh(); },
      error: () => this.msg = '❌ Erreur suppression'
    });
  }

  resetForm(){
    this.model = this.emptyModel();
    this.editingId = null;
    this.selectedFile = undefined;
    this.imagePreview = null;
  }
}
