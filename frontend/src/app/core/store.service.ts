import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class StoreService {
  settings = signal<any>(null);

  constructor(private http: HttpClient) {}

  load() {
    this.http.get(`${API_BASE_URL}/settings/store`).subscribe(v => this.settings.set(v));
  }
}
