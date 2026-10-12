import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionStore } from '../core/session-store.service';
import { MaterialFormComponent } from './material-form.component';
import { MaterialListComponent } from './material-list.component';

describe('materials editor permissions', () => {
  const session = {
    bakeries: signal([{ id: 'bakery-1', name: 'Panadería', role: 'VIEWER' }]),
    activeBakeryId: signal('bakery-1'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MaterialFormComponent, MaterialListComponent],
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: session },
        {
          provide: ApiService,
          useValue: {
            materials: () =>
              of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
            measurementUnits: () => of([]),
          },
        },
      ],
    });
  });

  it('does not offer material creation to a viewer', async () => {
    const fixture = TestBed.createComponent(MaterialListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('a[routerLink="/materials/new"]'),
    ).toBeNull();
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
