import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);

  const roles = route.data?.['roles'] as string[] | undefined;
  if (!roles?.length || roles.includes(auth.role() || '')) return true;

  return router.createUrlTree(['/admin/dashboard']);
};
