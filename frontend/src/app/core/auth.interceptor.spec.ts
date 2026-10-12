import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { ApiService } from './api.service';
import { authInterceptor } from './auth.interceptor';
import { SessionStore } from './session-store.service';

@Component({ standalone: true, template: '' })
class StubComponent {}

describe('authInterceptor', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'select-bakery', component: StubComponent },
          { path: 'login', component: StubComponent },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setToken('test-access-token');
    session.setActiveBakery('bakery-one');
  });

  afterEach(() => http.verify());

  it('adds the active bakery to product creation and recipe operations', () => {
    const actions: Array<() => void> = [
      () => api.createProduct({ name: 'Pan', salesUnitId: 'unit' }).subscribe(),
      () => api.product('product-1').subscribe(),
      () => api.recipeVersions('product-1').subscribe(),
      () => api.createRecipeVersion('product-1').subscribe(),
      () => api.recipeVersion('product-1', 'version-1').subscribe(),
      () => api.updateRecipeVersion('product-1', 'version-1', {}).subscribe(),
      () => api.replaceRecipeMaterials('product-1', 'version-1', []).subscribe(),
      () => api.publishRecipeVersion('product-1', 'version-1', '2026-01-01').subscribe(),
    ];
    const paths = [
      '/api/v1/products',
      '/api/v1/products/product-1',
      '/api/v1/products/product-1/recipe-versions',
      '/api/v1/products/product-1/recipe-versions',
      '/api/v1/products/product-1/recipe-versions/version-1',
      '/api/v1/products/product-1/recipe-versions/version-1',
      '/api/v1/products/product-1/recipe-versions/version-1/materials',
      '/api/v1/products/product-1/recipe-versions/version-1/publish',
    ];

    actions.forEach((action, index) => {
      action();
      const request = http.expectOne(paths[index]);
      expect(request.request.headers.get('X-Bakery-Id')).toBe('bakery-one');
      if (index === 0) expect(request.request.method).toBe('POST');
      request.flush({});
    });
  });

  it('adds the active bakery to material detail and price operations', () => {
    const actions: Array<() => void> = [
      () => api.material('material-1').subscribe(),
      () => api.createMaterial({
        name: 'Harina',
        kind: 'INGREDIENT',
        baseUnitId: 'unit',
      }).subscribe(),
      () => api.updateMaterial('material-1', {
        name: 'Harina',
        kind: 'INGREDIENT',
        baseUnitId: 'unit',
        isActive: true,
      }).subscribe(),
      () => api.priceHistory('material-1').subscribe(),
      () => api.previewPrice('material-1', {
        packagePriceCUP: '1',
        packageQuantity: '1',
        packageUnitId: 'unit',
        effectiveFrom: '2026-01-01',
      }).subscribe(),
      () => api.createPrice('material-1', {
        packagePriceCUP: '1',
        packageQuantity: '1',
        packageUnitId: 'unit',
        effectiveFrom: '2026-01-01',
      }).subscribe(),
    ];
    const paths = [
      '/api/v1/materials/material-1',
      '/api/v1/materials',
      '/api/v1/materials/material-1',
      '/api/v1/materials/material-1/prices',
      '/api/v1/materials/material-1/prices/preview',
      '/api/v1/materials/material-1/prices',
    ];

    actions.forEach((action, index) => {
      action();
      const request = http.expectOne(paths[index]);
      expect(request.request.headers.get('X-Bakery-Id')).toBe('bakery-one');
      request.flush({});
    });
  });

  it('sends the newly selected bakery after a bakery change', () => {
    session.setActiveBakery('bakery-two');
    api.createProduct({ name: 'Pan', salesUnitId: 'unit' }).subscribe();
    const request = http.expectOne('/api/v1/products');
    expect(request.request.headers.get('X-Bakery-Id')).toBe('bakery-two');
    request.flush({});
  });

  it('does not send a protected request without a selected bakery', () => {
    session.setActiveBakery(null);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const errors: unknown[] = [];
    api.createProduct({ name: 'Pan', salesUnitId: 'unit' }).subscribe({
      error: (error: unknown) => errors.push(error),
    });

    http.expectNone('/api/v1/products');
    expect(errors).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith(['/select-bakery'], {
      queryParams: { returnUrl: '/' },
    });
  });

  it('keeps login and global endpoints free of the bakery header', () => {
    const client = TestBed.inject(HttpClient);
    const globalRequests = [
      () => api.login('user@example.test', 'example-password').subscribe(),
      () => client.get('/api/v1/health/liveness').subscribe(),
      () => api.currentUser().subscribe(),
      () => api.bakeries().subscribe(),
      () => api.measurementUnits().subscribe(),
    ];
    const paths = [
      '/api/v1/auth/login',
      '/api/v1/health/liveness',
      '/api/v1/auth/me',
      '/api/v1/bakeries',
      '/api/v1/measurement-units',
    ];

    globalRequests.forEach((action, index) => {
      action();
      const request = http.expectOne(paths[index]);
      expect(request.request.headers.has('X-Bakery-Id')).toBe(false);
      request.flush(index === 0 ? { accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 } : []);
    });
  });

  it('adds bakery context to all material routes and clears session after 401', () => {
    api.materials({ page: 1, pageSize: 20 }).subscribe();
    const materials = http.expectOne((request) =>
      request.url.endsWith('/api/v1/materials'),
    );
    expect(materials.request.headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
    expect(materials.request.headers.get('X-Bakery-Id')).toBe('bakery-one');
    materials.flush({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });

    api.currentUser().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/me').flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(session.accessToken()).toBeNull();
    expect(session.activeBakeryId()).toBeNull();
  });
});
