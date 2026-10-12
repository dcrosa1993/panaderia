import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SessionStore } from './session-store.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly session = inject(SessionStore);

  login(email: string, password: string): Observable<boolean> {
    return this.api.login(email, password).pipe(
      tap((response) => this.session.setToken(response.accessToken)),
      switchMap(() => this.api.currentUser()),
      tap((user) => this.session.setUser(user)),
      map(() => true),
      catchError((error: unknown) => {
        if (this.session.accessToken()) {
          this.session.clear();
        }
        throw error;
      }),
    );
  }

  restoreSession(): Observable<boolean> {
    if (!this.session.accessToken()) {
      return of(false);
    }
    return this.api.currentUser().pipe(
      tap((user) => this.session.setUser(user)),
      map(() => true),
      catchError(() => {
        this.session.clear();
        return of(false);
      }),
    );
  }

  loadBakeries() {
    return this.api.bakeries().pipe(
      tap((bakeries) => this.session.setBakeries(bakeries)),
    );
  }

  logout(): void {
    this.session.clear();
  }
}
