import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionStore } from '../core/session-store.service';
import { RecipeEditorComponent } from './recipe-editor.component';

describe('RecipeEditorComponent', () => {
  const product = {
    id: 'product-1',
    name: 'Pan',
    description: null,
    status: 'ACTIVE' as const,
    salesUnit: {
      id: 'unit-count',
      code: 'UD',
      name: 'unidad',
      dimension: 'COUNT' as const,
    },
    recipeSummary: {
      draftVersionNumber: 1,
      publishedVersion: null,
      recipeStatus: 'DRAFT_AVAILABLE' as const,
      versionCount: 1,
    },
  };
  const version = {
    id: 'version-1',
    productId: 'product-1',
    versionNumber: 1,
    status: 'DRAFT' as const,
    outputQuantity: '10',
    outputUnit: {
      id: 'unit-count',
      code: 'UD',
      name: 'unidad',
      dimension: 'COUNT' as const,
    },
    effectiveFrom: null,
    effectiveTo: null,
    preparationNotes: null,
    materials: [],
    laborOperations: [],
  };
  const api = {
    product: vi.fn(() => of(product)),
    recipeVersion: vi.fn(() => of(version)),
    measurementUnits: vi.fn(() => of([{
      id: 'unit-count',
      code: 'UD',
      name: 'unidad',
      dimension: 'COUNT' as const,
      conversionFactor: '1',
    }])),
    materials: vi.fn(() => of({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      totalPages: 1,
    })),
    laborRoles: vi.fn(() => of([])),
  };
  const session = {
    bakeries: signal([{ id: 'bakery-1', name: 'Panadería', role: 'EDITOR' }]),
    activeBakeryId: signal('bakery-1'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecipeEditorComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) =>
                  key === 'productId' ? 'product-1' : 'version-1',
              },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: ApiService, useValue: api },
        { provide: SessionStore, useValue: session },
      ],
    });
  });

  it('finishes loading when all data fits on the first material page', async () => {
    const fixture = TestBed.createComponent(RecipeEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.materials).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.product()?.id).toBe('product-1');
    expect(fixture.componentInstance.version()?.id).toBe('version-1');
  });
});
