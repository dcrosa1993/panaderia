import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionStore } from '../core/session-store.service';
import { ProductDetailComponent } from './product-detail.component';
import { ProductListComponent } from './product-list.component';

describe('products viewer permissions', () => {
  const session = {
    bakeries: signal([{ id: 'bakery-1', name: 'Panadería', role: 'VIEWER' }]),
    activeBakeryId: signal('bakery-1'),
  };
  const product = {
    id: 'product-1',
    name: 'Pan',
    description: null,
    status: 'ACTIVE' as const,
    salesUnit: {
      id: 'unit-1',
      code: 'UD',
      name: 'unidad',
      dimension: 'COUNT' as const,
    },
    recipeSummary: {
      draftVersionNumber: null,
      publishedVersion: null,
      recipeStatus: 'NO_RECIPE' as const,
      versionCount: 0,
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductListComponent, ProductDetailComponent],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: session },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'product-1' },
            },
          },
        },
        {
          provide: ApiService,
          useValue: {
            products: () =>
              of({
                items: [],
                page: 1,
                pageSize: 20,
                total: 0,
                totalPages: 0,
              }),
            product: () => of(product),
            recipeVersions: () => of([]),
            measurementUnits: () => of([]),
          },
        },
      ],
    });
  });

  it('does not offer product creation to a viewer', async () => {
    const fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('a[routerLink="/products/new"]'),
    ).toBeNull();
  });

  it('allows a viewer to read product history without draft creation controls', async () => {
    const fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Versiones de receta');
    expect(fixture.nativeElement.textContent).not.toContain('Crear primer borrador');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Crear borrador desde la versión publicada',
    );
  });
});
