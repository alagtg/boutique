import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private http: HttpClient) {}

  dashboardSummary(range = 'month', year?: number, month?: number, date?: string) {
    const params = new URLSearchParams();
    params.set('range', range);
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    if (date) params.set('date', date);
    return this.http.get<any>(`${API_BASE_URL}/dashboard/summary?${params.toString()}`);
  }

  biDashboard(range = 'month', year?: number, month?: number, date?: string) {
    const params = new URLSearchParams({ range });
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    if (date) params.set('date', date);
    return this.http.get<any>(`${API_BASE_URL}/dashboard/bi?${params.toString()}`);
  }

  products() {
    return this.http.get<any[]>(`${API_BASE_URL}/products`);
  }

  productCategories() {
    return this.http.get<any[]>(`${API_BASE_URL}/products/categories`);
  }

  createProductCategory(name: string) {
    return this.http.post<any>(`${API_BASE_URL}/products/categories`, { name });
  }

  createProduct(payload: any) {
    return this.http.post(`${API_BASE_URL}/products`, payload);
  }

  updateProduct(productId: number, payload: any) {
    return this.http.put(`${API_BASE_URL}/products/${productId}`, payload);
  }

  deleteProduct(productId: number) {
    return this.http.delete(`${API_BASE_URL}/products/${productId}`);
  }

  uploadProductImage(productId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${API_BASE_URL}/products/${productId}/image`, formData);
  }

  stockPurchases(year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return this.http.get<any>(`${API_BASE_URL}/stock-purchases${params.size ? '?' + params.toString() : ''}`);
  }

  createStockPurchase(payload: any) {
    return this.http.post(`${API_BASE_URL}/stock-purchases`, payload);
  }

  variantByBarcode(barcode: string) {
    return this.http.get<any>(`${API_BASE_URL}/productvariants/lookup?barcode=${encodeURIComponent(barcode)}`);
  }

  newBarcode() {
    return this.http.get<{ barcode: string }>(`${API_BASE_URL}/productvariants/new-barcode`);
  }

  customers() {
    return this.http.get<any[]>(`${API_BASE_URL}/customers`);
  }

  customer(id: number) {
    return this.http.get<any>(`${API_BASE_URL}/customers/${id}`);
  }

  createCustomer(payload: any) {
    return this.http.post(`${API_BASE_URL}/customers`, payload);
  }

  updateCustomer(customerId: number, payload: any) {
    return this.http.put(`${API_BASE_URL}/customers/${customerId}`, payload);
  }

  qrRegisterCustomer(payload: any) {
    return this.http.post(`${API_BASE_URL}/customers/qr-register`, payload);
  }

  wheelEligibleCustomers() {
    return this.http.get<any[]>(`${API_BASE_URL}/loyalty/wheel-eligible`);
  }

  monthlyGiftCandidates(year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return this.http.get<any[]>(`${API_BASE_URL}/loyalty/monthly-gift-candidates${params.size ? '?' + params.toString() : ''}`);
  }

  monthlyGiftDraw(year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return this.http.get<any>(`${API_BASE_URL}/loyalty/monthly-gift-draw${params.size ? '?' + params.toString() : ''}`);
  }

  wheelByToken(token: string) {
    return this.http.get<any>(`${API_BASE_URL}/loyalty/wheel-token/${token}`);
  }

  wheelByPhone(phone: string) {
    return this.http.get<any>(`${API_BASE_URL}/loyalty/wheel-phone?phone=${encodeURIComponent(phone)}`);
  }

  sales(year?: number, month?: number, dateFrom?: string, dateTo?: string) {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return this.http.get<any[]>(`${API_BASE_URL}/sales${params.size ? '?' + params.toString() : ''}`);
  }

  salesMonthlyInvoice(year: number, month: number) {
    return this.http.get<any>(`${API_BASE_URL}/sales/monthly-invoice?year=${year}&month=${month}`);
  }

  salesProfitSummary() {
    return this.http.get<any>(`${API_BASE_URL}/sales/profit-summary`);
  }

  createSale(payload: any) {
    return this.http.post(`${API_BASE_URL}/sales`, payload);
  }

  reservations() {
    return this.http.get<any[]>(`${API_BASE_URL}/reservations`);
  }

  createReservation(payload: any) {
    return this.http.post(`${API_BASE_URL}/reservations`, payload);
  }

  cashSessions() {
    return this.http.get<any[]>(`${API_BASE_URL}/cashsessions`);
  }

  openCashSession(payload: any) {
    return this.http.post(`${API_BASE_URL}/cashsessions/open`, payload);
  }

  expenses(year?: number, month?: number) {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    return this.http.get<any[]>(`${API_BASE_URL}/expenses${params.size ? '?' + params.toString() : ''}`);
  }

  expenseCategories() {
    return this.http.get<any[]>(`${API_BASE_URL}/expenses/categories`);
  }

  monthlyExpenseReport(year: number, month: number) {
    return this.http.get<any>(`${API_BASE_URL}/expenses/monthly-report?year=${year}&month=${month}`);
  }

  createExpense(payload: any) {
    return this.http.post(`${API_BASE_URL}/expenses`, payload);
  }

  uploadExpenseReceipt(expenseId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${API_BASE_URL}/expenses/${expenseId}/receipt`, formData);
  }

  storeSettings() {
    return this.http.get<any>(`${API_BASE_URL}/settings/store`);
  }

  updateStoreSettings(payload: any) {
    return this.http.put(`${API_BASE_URL}/settings/store`, payload);
  }
}
