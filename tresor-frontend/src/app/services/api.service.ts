import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map } from 'rxjs/operators';

export interface Product { id:number; name:string; description?:string; category:string; imageUrl?:string; price:number; stock:number; isPublished:boolean; }
export interface CreateOrderItem { productId:number; size:string; color:string; quantity:number; unitPrice:number; }
export interface CreateOrder { customerName:string; phone:string; address:string; note?:string; items: CreateOrderItem[]; }
export interface Expense { id?:number; label:string; amount:number; date:string; notes?:string; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  base = environment.apiBase;

listOrders(){
  return this.http.get<any[]>(`${this.base}/orders`).pipe(
    map(arr => arr.map(o => ({
      ...o,
      status: typeof o.status === 'number' ? (['pending','confirmed','shipped','delivered','canceled'][o.status] ?? 'pending') : (o.status ?? 'pending'),
      callStatus: o.callStatus === 1 || o.callStatus === 'answered' ? 'answered'
                : o.callStatus === 2 || o.callStatus === 'noanswer' ? 'noanswer'
                : 'none'
    })))
  );
}

  // AUTH
  login(payload: { username: string; password: string }) {
    return this.http.post<{ token: string }>(`${this.base}/auth/login`, payload);
  }
  // (facultatif) me() si ton backend le propose
  me() { return this.http.get<any>(`${this.base}/auth/me`); }
  
  uploadImage(file: File){
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{url:string}>(`${this.base}/files`, form);
  }
  // PRODUCTS / ORDERS / EXPENSES (inchangés)
listProducts(published?: boolean){
  const url = published == null
    ? `${this.base}/products`                       // ← sans filtre -> TOUS les produits
    : `${this.base}/products?published=${published}`;
  return this.http.get<Product[]>(url);
}

  getProduct(id:number){ return this.http.get<Product>(`${this.base}/products/${id}`); }
  createOrder(o:CreateOrder){ return this.http.post(`${this.base}/orders`, o); }
// src/app/services/api.service.ts
updateOrderCall(id:number, status:'none'|'answered'|'noanswer'){
  return this.http.patch(`${this.base}/orders/${id}/call`, { status });
}
updateOrderStatus(id:number, status:'pending'|'confirmed'|'shipped'|'delivered'|'canceled'){
  return this.http.patch(`${this.base}/orders/${id}/status`, { status });
}
deleteOrder(id:number){
  return this.http.delete(`${this.base}/orders/${id}`);
}
bulkDeleteOrdersByDate(isoDate:string){ // '2025-10-08'
  return this.http.delete(`${this.base}/orders/bulk?date=${isoDate}`);
}

  createProduct(p:any){ return this.http.post(`${this.base}/products`, p); }
  updateProduct(id:number, p:any){ return this.http.put(`${this.base}/products/${id}`, p); }
  deleteProduct(id:number){ return this.http.delete(`${this.base}/products/${id}`); }

  listExpenses(){ return this.http.get<any[]>(`${this.base}/expenses`); }
  addExpense(e:Expense){ return this.http.post(`${this.base}/expenses`, e); }
  deleteExpense(id:number){ return this.http.delete(`${this.base}/expenses/${id}`); }

  // listOrders() removed due to duplicate implementation
  summary(){ return this.http.get<any>(`${this.base}/dashboard/summary`); }
  chart(days=14){ return this.http.get<any[]>(`${this.base}/dashboard/chart?days=${days}`); }
}
