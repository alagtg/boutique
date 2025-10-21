import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Routes } from '@angular/router';
import { AppComponent } from './app/app.component';
import { ProductListComponent } from './app/client/pages/product-list/product-list.component';
import { ProductDetailComponent } from './app/client/pages/product-detail/product-detail.component';
import { ContactComponent } from './app/client/pages/contact/contact.component';
import { LoginComponent } from './app/admin/login/login.component';
import { DashboardComponent } from './app/admin/dashboard/dashboard.component';
import { ProductsAdminComponent } from './app/admin/products/products-admin.component';
import { ExpensesComponent } from './app/admin/expenses/expenses.component';
import { OrdersAdminComponent } from './app/admin/orders/orders-admin.component';
import { authInterceptor } from './app/core/auth.interceptor';
import { canActivateAuth } from './app/core/auth.guard';
import { AdminShellComponent } from './app/admin/admin-shell.component';
import 'zone.js';

const routes: Routes = [
  // Public
  { path: '', component: ProductListComponent },
  { path: 'produit/:id', component: ProductDetailComponent },
  { path: 'contact', component: ContactComponent },
    { path: 'produits', component: ProductListComponent },


  // Auth
  { path: 'admin/login', component: LoginComponent },

  // Admin protégée (toutes les pages enfant)
  {
    path: 'admin',
    component: AdminShellComponent,
    canActivate: [canActivateAuth],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'produits', component: ProductsAdminComponent },
      { path: 'depenses', component: ExpensesComponent },
      { path: 'commandes', component: OrdersAdminComponent },
    ]
  },

  { path: '**', redirectTo: '' }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
}).catch(err => console.error(err));
