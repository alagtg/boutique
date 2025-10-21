import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Product } from '../../../services/api.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit {
  private api = inject(ApiService);

  products: Product[] = [];
  loading = true;
  page = 1;
  pageSize = 12;
  heroUrl = 'assets/images/robe1.jpg';

  ngOnInit() {
    this.api.listProducts(true).subscribe({
      next: (data) => {
        this.products = data || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.products.length / this.pageSize));
  }

  get pageItems(): Product[] {
    const start = (this.page - 1) * this.pageSize;
    return this.products.slice(start, start + this.pageSize);
  }

  trackById = (_: number, p: Product) => p.id;

  goTo(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  prev() { this.goTo(this.page - 1); }
  next() { this.goTo(this.page + 1); }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.page;
    const delta = 2;
    const pages: number[] = [];
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);

    pages.push(1);
    if (left > 2) pages.push(-1);
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push(-1);
    if (total > 1) pages.push(total);

    return pages;
  }
}
