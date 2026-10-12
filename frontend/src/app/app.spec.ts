import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthenticatedShellComponent } from './shell/authenticated-shell.component';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';

describe('application routing shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            session: {
              bakeries: signal([]),
              activeBakeryId: signal(null),
              user: signal(null),
            },
            restoreSession: () => of(true),
            loadBakeries: () => of([]),
            logout: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders exactly one main navigation in the authenticated shell', () => {
    const fixture = TestBed.createComponent(AuthenticatedShellComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        'nav[aria-label="Navegación principal"]',
      ),
    ).toHaveLength(1);
  });

  it('does not render the authenticated shell on the public login route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/login');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        'nav[aria-label="Navegación principal"]',
      ),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Inicia sesión');
  });
});
