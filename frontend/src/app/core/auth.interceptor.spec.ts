import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { ApiService } from './api.service';
import { authInterceptor } from './auth.interceptor';
import { SessionStore } from './session-store.service';

@Component({ standalone: true, template: '' })
class LoginStub {}

describe('authInterceptor', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', component: LoginStub }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setToken('token-test');
    session.setActiveBakery('bakery-test');
  });

  afterEach(() => http.verify());

  it('adds bearer and bakery headers only on bakery-scoped endpoints', () => {
    api.materials({ page: 1, pageSize: 20 }).subscribe();
    const materials = http.expectOne((request) =>
      request.url.endsWith('/api/v1/materials'),
    );
    expect(materials.request.headers.get('Authorization')).toBe(
      'Bearer token-test',
    );
    expect(materials.request.headers.get('X-Bakery-Id')).toBe('bakery-test');
    materials.flush({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });

    api.currentUser().subscribe();
    const user = http.expectOne('/api/v1/auth/me');
    expect(user.request.headers.get('Authorization')).toBe('Bearer token-test');
    expect(user.request.headers.has('X-Bakery-Id')).toBe(false);
    user.flush({
      id: 'user-1',
      email: 'user@example.test',
      displayName: 'Usuario',
      isPlatformAdmin: false,
    });

    api.login('user@example.test', 'not-a-real-password').subscribe();
    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    expect(login.request.headers.has('X-Bakery-Id')).toBe(false);
    login.flush({ accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 900 });
  });

  it('clears session after an unauthorized response', () => {
    api.currentUser().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/me').flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(session.accessToken()).toBeNull();
    expect(session.activeBakeryId()).toBeNull();
  });
});
