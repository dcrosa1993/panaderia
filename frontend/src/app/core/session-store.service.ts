import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  AuthenticatedUser,
  Bakery,
} from './api.models';

const TOKEN_KEY = 'panaderia.accessToken';
const BAKERY_KEY = 'panaderia.activeBakeryId';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly user = signal<AuthenticatedUser | null>(null);
  readonly bakeries = signal<Bakery[]>([]);
  readonly accessToken = signal(this.read(TOKEN_KEY));
  readonly activeBakeryId = signal(this.read(BAKERY_KEY));

  setToken(token: string): void {
    this.write(TOKEN_KEY, token);
    this.accessToken.set(token);
    this.user.set(null);
    this.bakeries.set([]);
    this.setActiveBakery(null);
  }

  setUser(user: AuthenticatedUser): void {
    this.user.set(user);
  }

  setBakeries(bakeries: Bakery[]): void {
    this.bakeries.set(bakeries);
    if (
      this.activeBakeryId() &&
      !bakeries.some((bakery) => bakery.id === this.activeBakeryId())
    ) {
      this.setActiveBakery(null);
    }
  }

  setActiveBakery(bakeryId: string | null): void {
    this.write(BAKERY_KEY, bakeryId);
    this.activeBakeryId.set(bakeryId);
  }

  clear(): void {
    this.remove(TOKEN_KEY);
    this.remove(BAKERY_KEY);
    this.accessToken.set(null);
    this.activeBakeryId.set(null);
    this.user.set(null);
    this.bakeries.set([]);
  }

  private read(key: string): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      if (value === null) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
      }
    } catch {
      throw new Error('No se pudo guardar la sesión en este navegador.');
    }
  }

  private remove(key: string): void {
    this.write(key, null);
  }
}
