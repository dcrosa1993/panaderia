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

const API_BASE = 'https://panaderia-api.may.cu/api/v1';

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
      `${API_BASE}/products`,
      `${API_BASE}/products/product-1`,
      `${API_BASE}/products/product-1/recipe-versions`,
      `${API_BASE}/products/product-1/recipe-versions`,
      `${API_BASE}/products/product-1/recipe-versions/version-1`,
      `${API_BASE}/products/product-1/recipe-versions/version-1`,
      `${API_BASE}/products/product-1/recipe-versions/version-1/materials`,
      `${API_BASE}/products/product-1/recipe-versions/version-1/publish`,
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
      `${API_BASE}/materials/material-1`,
      `${API_BASE}/materials`,
      `${API_BASE}/materials/material-1`,
      `${API_BASE}/materials/material-1/prices`,
      `${API_BASE}/materials/material-1/prices/preview`,
      `${API_BASE}/materials/material-1/prices`,
    ];

    actions.forEach((action, index) => {
      action();
      const request = http.expectOne(paths[index]);
      expect(request.request.headers.get('X-Bakery-Id')).toBe('bakery-one');
      request.flush({});
    });
  });

  it('adds bakery context to economy, costing, scenario and tax-assignment requests', () => {
    const actions: Array<() => void> = [
      () => api.laborRoles().subscribe(),
      () => api.laborRates('role-1').subscribe(),
      () => api.overheadExpenses().subscribe(),
      () => api.taxAssignments().subscribe(),
      () => api.costCalculations('product-1').subscribe(),
      () => api.costCalculation('calculation-1').subscribe(),
      () => api.priceScenarios('calculation-1').subscribe(),
      () => api.priceScenario('scenario-1').subscribe(),
    ];
    const paths = [
      `${API_BASE}/labor-roles`,
      `${API_BASE}/labor-roles/role-1/rates`,
      `${API_BASE}/overhead-expenses`,
      `${API_BASE}/tax-settings/assignments`,
      `${API_BASE}/products/product-1/cost-calculations`,
      `${API_BASE}/cost-calculations/calculation-1`,
      `${API_BASE}/cost-calculations/calculation-1/scenarios`,
      `${API_BASE}/price-scenarios/scenario-1`,
    ];

    actions.forEach((action, index) => {
      action();
      const request = http.expectOne(paths[index]);
      expect(request.request.headers.get('Authorization')?.startsWith('Bearer ')).toBe(true);
      expect(request.request.headers.get('X-Bakery-Id')).toBe('bakery-one');
      request.flush([]);
    });
  });

  it('sends the newly selected bakery after a bakery change', () => {
    session.setActiveBakery('bakery-two');
    api.createProduct({ name: 'Pan', salesUnitId: 'unit' }).subscribe();
    const request = http.expectOne(`${API_BASE}/products`);
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

    http.expectNone(`${API_BASE}/products`);
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
      () => api.taxRules().subscribe(),
    ];
    const paths = [
      `${API_BASE}/auth/login`,
      '/api/v1/health/liveness',
      `${API_BASE}/auth/me`,
      `${API_BASE}/bakeries`,
      `${API_BASE}/measurement-units`,
      `${API_BASE}/tax-settings/rules`,
    ];

    globalRequests.forEach((action, index) => {
      action();
      const request = http.expectOne(paths[index]);
      expect(request.request.headers.has('X-Bakery-Id')).toBe(false);
      if (index > 1) {
        expect(request.request.headers.get('Authorization')?.startsWith('Bearer ')).toBe(true);
      }
      request.flush(index === 0 ? { accessToken: 'new', tokenType: 'Bearer', expiresIn: 900 } : []);
    });
  });

  it('adds bakery context to all material routes and clears session after 401', () => {
    api.materials({ page: 1, pageSize: 20 }).subscribe();
    const materials = http.expectOne((request) =>
      request.url === `${API_BASE}/materials`,
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
    http.expectOne(`${API_BASE}/auth/me`).flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(session.accessToken()).toBeNull();
    expect(session.activeBakeryId()).toBeNull();
  });
});
