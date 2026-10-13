import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionStore } from '../core/session-store.service';
import { MaterialFormComponent } from './material-form.component';
import { MaterialListComponent } from './material-list.component';

describe('materials editor permissions', () => {
  const session = {
    bakeries: signal<Array<{ id: string; name: string; role: string }>>([
      { id: 'bakery-1', name: 'Panadería', role: 'VIEWER' },
    ]),
    activeBakeryId: signal('bakery-1'),
  };
  const emptyMaterials = {
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  };
  const api = {
    materials: vi.fn(() => of(emptyMaterials)),
    measurementUnits: vi.fn(() => of([
      { id: 'unit-1', code: 'KG', name: 'kilogramo', dimension: 'MASS', conversionFactor: '1' },
    ])),
    createMaterial: vi.fn(() => of({ id: 'material-new' })),
  };

  beforeEach(() => {
    session.bakeries.set([{ id: 'bakery-1', name: 'Panadería', role: 'VIEWER' }]);
    api.materials.mockClear();
    api.createMaterial.mockClear();
    TestBed.configureTestingModule({
      imports: [MaterialFormComponent, MaterialListComponent],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: session },
        { provide: ApiService, useValue: api },
      ],
    });
  });

  it('does not offer material creation to a viewer', async () => {
    const fixture = TestBed.createComponent(MaterialListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .some((button) => button.textContent?.includes('Agregar materia prima')),
    ).toBe(false);
  });

  it('creates a material in a modal and refreshes the list after success', async () => {
    session.bakeries.set([{ id: 'bakery-1', name: 'Panadería', role: 'EDITOR' }]);
    const fixture = TestBed.createComponent(MaterialListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.createModal.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const form = fixture.debugElement.query(By.directive(MaterialFormComponent))
      .componentInstance as MaterialFormComponent;
    expect(form.modal).toBe(true);
    form.form.patchValue({ name: 'Harina nueva', baseUnitId: 'unit-1' });
    form.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.createMaterial).toHaveBeenCalledWith({
      name: 'Harina nueva',
      kind: 'INGREDIENT',
      baseUnitId: 'unit-1',
    });
    expect(api.materials).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.createModal()).toBe(false);
  });

  it('disables a valid material form for a viewer', async () => {
    const fixture = TestBed.createComponent(MaterialFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({
      name: 'Harina',
      kind: 'INGREDIENT',
      baseUnitId: 'unit-1',
      densityGramPerMl: '',
      isActive: true,
    });
    fixture.detectChanges();
    const saveButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(saveButton.disabled).toBe(true);
  });
});
