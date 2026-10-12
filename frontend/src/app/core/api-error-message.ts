import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.error?.code === 'BAKERY_CONTEXT_REQUIRED') {
    return 'Selecciona una panadería para continuar.';
  }

  switch (error.status) {
    case 400:
      return 'Revisa los datos introducidos e inténtalo de nuevo.';
    case 401:
      return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
    case 403:
      return 'No tienes permisos para realizar esta acción.';
    case 404:
      return 'El elemento solicitado ya no está disponible.';
    default:
      return fallback;
  }
}
