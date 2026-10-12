import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Bakery } from '../core/api.models';

@Component({
  standalone: true,
  selector: 'app-bakery-select',
  template: `
    <main class="page">
      <section class="panel">
        <p class="eyebrow">ESPACIO DE TRABAJO</p>
        <h1>Elige una panadería</h1>
        @if (loading()) { <p>Cargando tus panaderías…</p> }
        @else if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @else if (bakeries().length === 0) {
          <p>Aún no tienes acceso a una panadería. Pide a un administrador que te invite.</p>
        } @else {
          <div class="choices">
            @for (bakery of bakeries(); track bakery.id) {
              <button type="button" (click)="select(bakery)">
                <strong>{{ bakery.name }}</strong><span>{{ roleName(bakery.role) }}</span>
              </button>
            }
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    .page { min-height: 70vh; display: grid; place-items: center; padding: 1.5rem; }
    .panel { width: min(100%, 42rem); padding: 2rem; background: white; border: 1px solid #e4e6df; border-radius: 1rem; }
    .eyebrow { color: #346b43; font-size: .75rem; font-weight: 800; letter-spacing: .14em; }
    h1 { font-family: Georgia, serif; }
    .choices { display: grid; gap: .75rem; margin-top: 1.5rem; }
    button { display: flex; justify-content: space-between; gap: 1rem; text-align: left; padding: 1rem; border: 1px solid #dbe3d8; border-radius: .65rem; background: #fff; cursor: pointer; font: inherit; }
    button:hover { border-color: #28643a; background: #f5f8f3; }
    button span { color: #66716a; }
    .error { color: #a33127; }
  `],
})
export class BakerySelectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly bakeries = this.auth.session.bakeries;
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.auth.loadBakeries().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.error.set('No se pudieron cargar tus panaderías. Inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }

  select(bakery: Bakery): void {
    if (!this.bakeries().some((item) => item.id === bakery.id)) return;
    this.auth.session.setActiveBakery(bakery.id);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl?.startsWith('/materials') ? returnUrl : '/materials');
  }

  roleName(role: string): string {
    return role === 'ADMIN' ? 'Administración' : role === 'EDITOR' ? 'Edición' : 'Consulta';
  }
}
