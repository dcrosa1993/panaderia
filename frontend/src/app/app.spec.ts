import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './core/auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            session: {
              bakeries: signal([]),
              activeBakeryId: signal(null),
              user: signal(null),
            },
            loadBakeries: () => of([]),
            logout: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('creates the authenticated application shell', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Panadería');
    expect(fixture.nativeElement.textContent).toContain('Materias primas');
  });
});
