import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionStore } from './session-store.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const url = request.urlWithParams;
  const apiBaseUrl = environment.API_URL.replace(/\/$/, '');
  const apiPath = url.startsWith(`${apiBaseUrl}/`)
    ? url.slice(apiBaseUrl.length)
    : '';
  const isApiRequest = apiPath.length > 0;
  const isLogin =
    apiPath === '/auth/login' || apiPath.startsWith('/auth/login?');
  const token = session.accessToken();
  const bakeryId = session.activeBakeryId();
  const isBakeryScoped =
    isApiRequest && /^\/(?:materials|products)(?:\/|\?|$)/.test(apiPath);

  if (isBakeryScoped && !bakeryId) {
    if (!router.url.startsWith('/select-bakery')) {
      void router.navigate(['/select-bakery'], {
        queryParams: { returnUrl: router.url },
      });
    }
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 400,
          statusText: 'Bad Request',
          error: { code: 'BAKERY_CONTEXT_REQUIRED' },
        }),
    );
  }

  let headers = request.headers;
  if (isApiRequest && token && !isLogin) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  if (isBakeryScoped && bakeryId) {
    headers = headers.set('X-Bakery-Id', bakeryId);
  }
  const outgoing =
    headers === request.headers ? request : request.clone({ headers });

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        isApiRequest &&
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 401
      ) {
        session.clear();
        if (!router.url.startsWith('/login')) {
          void router.navigate(['/login'], {
            queryParams: { returnUrl: router.url },
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
