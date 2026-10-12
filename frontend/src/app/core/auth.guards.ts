import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export const authenticatedGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await firstValueFrom(auth.restoreSession())) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const bakerySelectionGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  let bakeries;
  try {
    bakeries = await firstValueFrom(auth.loadBakeries());
  } catch {
    return router.createUrlTree(['/select-bakery'], {
      queryParams: { returnUrl: state.url },
    });
  }
  const selectedId = auth.session.activeBakeryId();

  if (selectedId && bakeries.some((bakery) => bakery.id === selectedId)) {
    return true;
  }
  if (bakeries.length === 1) {
    auth.session.setActiveBakery(bakeries[0].id);
    return true;
  }
  return router.createUrlTree(['/select-bakery'], {
    queryParams: { returnUrl: state.url },
  });
};
