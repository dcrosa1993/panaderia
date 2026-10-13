import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionStore } from '../core/session-store.service';
import { ProductDetailComponent } from './product-detail.component';
import { ProductFormComponent } from './product-form.component';
import { ProductListComponent } from './product-list.component';

describe('products viewer permissions', () => {
  const session = {
    bakeries: signal<Array<{ id: string; name: string; role: string }>>([
      { id: 'bakery-1', name: 'Panadería', role: 'VIEWER' },
    ]),
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
  const emptyProducts = {
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  };
  const api = {
    products: vi.fn(() => of(emptyProducts)),
    product: vi.fn(() => of(product)),
    recipeVersions: vi.fn(() => of([])),
    measurementUnits: vi.fn(() => of([
      { id: 'unit-1', code: 'UD', name: 'unidad', dimension: 'COUNT', conversionFactor: '1' },
    ])),
    createProduct: vi.fn(() => of(product)),
  };

  beforeEach(() => {
    session.bakeries.set([{ id: 'bakery-1', name: 'Panadería', role: 'VIEWER' }]);
    api.products.mockClear();
    api.createProduct.mockClear();
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
        { provide: ApiService, useValue: api },
      ],
    });
  });

  it('does not offer product creation to a viewer', async () => {
    const fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.some((button) => button.textContent?.includes('Agregar producto'))).toBe(false);
  });

  it('creates a product in a modal and refreshes the list after success', async () => {
    session.bakeries.set([{ id: 'bakery-1', name: 'Panadería', role: 'EDITOR' }]);
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: { get: () => null } } },
    });
    const fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.createModal.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const form = fixture.debugElement.query(By.directive(ProductFormComponent))
      .componentInstance as ProductFormComponent;
    expect(form.modal).toBe(true);
    form.form.patchValue({ name: 'Pan nuevo', salesUnitId: 'unit-1' });
    form.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.createProduct).toHaveBeenCalledWith({
      name: 'Pan nuevo',
      description: null,
      salesUnitId: 'unit-1',
    });
    expect(api.products).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.createModal()).toBe(false);
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
