import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginPageComponent } from './features/auth/login-page.component';
import { DashboardPageComponent } from './features/admin/dashboard/dashboard-page.component';
import { ProductsPageComponent } from './features/admin/products/products-page.component';
import { CustomersPageComponent } from './features/admin/customers/customers-page.component';
import { SalesPageComponent } from './features/admin/sales/sales-page.component';
import { ExpensesPageComponent } from './features/admin/expenses/expenses-page.component';
import { SettingsPageComponent } from './features/admin/settings/settings-page.component';
import { PosPageComponent } from './features/employee/pos/pos-page.component';
import { ReservationsPageComponent } from './features/employee/reservations/reservations-page.component';
import { LoyaltyPageComponent } from './features/client/loyalty/loyalty-page.component';
import { QrPageComponent } from './features/client/qr/qr-page.component';
import { WheelPageComponent } from './features/client/wheel/wheel-page.component';
import { StockPurchasesPageComponent } from './features/admin/stock-purchases/stock-purchases-page.component';
import { BiDashboardPageComponent } from './features/admin/bi-dashboard/bi-dashboard-page.component';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'qr-client', component: QrPageComponent },
  { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: 'admin/dashboard', component: DashboardPageComponent, canActivate: [authGuard] },
  { path: 'admin/bi-dashboard', component: BiDashboardPageComponent, canActivate: [authGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/products', component: ProductsPageComponent, canActivate: [authGuard] },
  { path: 'admin/stock-purchases', component: StockPurchasesPageComponent, canActivate: [authGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/customers', component: CustomersPageComponent, canActivate: [authGuard] },
  { path: 'admin/sales', component: SalesPageComponent, canActivate: [authGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/expenses', component: ExpensesPageComponent, canActivate: [authGuard], data: { roles: ['ADMIN'] } },
  { path: 'admin/settings', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: 'employee/pos', component: PosPageComponent, canActivate: [authGuard] },
  { path: 'employee/reservations', component: ReservationsPageComponent, canActivate: [authGuard] },
  { path: 'client/loyalty', component: LoyaltyPageComponent, canActivate: [authGuard] },
  { path: 'client/wheel', component: WheelPageComponent },
  { path: '**', redirectTo: 'admin/dashboard' }
];
