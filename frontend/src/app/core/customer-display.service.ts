import { Injectable, signal } from '@angular/core';

export interface CustomerDisplayItem {
  id: number;
  productName: string;
  color?: string;
  size?: string;
  salePrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl?: string;
}

export interface CustomerDisplayState {
  status: 'IDLE' | 'ACTIVE' | 'COMPLETED';
  items: CustomerDisplayItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  customerName?: string;
  updatedAt: number;
}

const EMPTY_STATE: CustomerDisplayState = {
  status: 'IDLE',
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  paymentMethod: 'CASH',
  amountReceived: 0,
  change: 0,
  updatedAt: Date.now()
};

@Injectable({ providedIn: 'root' })
export class CustomerDisplayService {
  private readonly storageKey = 'tresor_customer_display';
  private readonly channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('tresor-customer-display')
    : null;

  readonly state = signal<CustomerDisplayState>(this.readState());

  constructor() {
    this.channel?.addEventListener('message', event => this.accept(event.data));
    window.addEventListener('storage', event => {
      if (event.key === this.storageKey && event.newValue) {
        try { this.accept(JSON.parse(event.newValue)); } catch { /* Ignore invalid external data. */ }
      }
    });
  }

  publish(state: Omit<CustomerDisplayState, 'updatedAt'>) {
    const next = { ...state, updatedAt: Date.now() };
    this.state.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
    this.channel?.postMessage(next);
  }

  reset() {
    this.publish({
      status: 'IDLE',
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      paymentMethod: 'CASH',
      amountReceived: 0,
      change: 0
    });
  }

  private readState(): CustomerDisplayState {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? { ...EMPTY_STATE, ...JSON.parse(saved) } : EMPTY_STATE;
    } catch {
      return EMPTY_STATE;
    }
  }

  private accept(value: unknown) {
    if (!value || typeof value !== 'object') return;
    this.state.set({ ...EMPTY_STATE, ...(value as CustomerDisplayState) });
  }
}
