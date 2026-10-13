import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AuthService } from '../core/auth.service';
import { Bakery } from '../core/api.models';

@Component({
  standalone: true,
  imports: [NzAlertModule, NzButtonModule],
  selector: 'app-bakery-select',
  template: `
    <main class="grid min-h-[70vh] place-items-center px-4 py-10">
      <section class="w-full max-w-2xl rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p class="text-xs font-extrabold tracking-[.14em] text-emerald-800">ESPACIO DE TRABAJO</p>
        <h1 class="font-serif text-3xl text-emerald-950">Elige una panadería</h1>
        @if (loading()) { <p class="text-stone-600">Cargando tus panaderías…</p> }
        @else if (error()) { <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon /> }
        @else if (bakeries().length === 0) {
          <p class="text-stone-600">Aún no tienes acceso a una panadería. Pide a un administrador que te invite.</p>
        } @else {
          <div class="mt-6 grid gap-3">
            @for (bakery of bakeries(); track bakery.id) {
              <button nz-button nzType="default" class="!flex !h-auto !w-full !items-center !justify-between !gap-4 !whitespace-normal !px-4 !py-4 text-left" type="button" (click)="select(bakery)">
                <strong class="text-emerald-950">{{ bakery.name }}</strong>
                <span class="text-stone-500">{{ roleName(bakery.role) }}</span>
              </button>
            }
          </div>
        }
      </section>
    </main>
  `,
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
    const isBakeryRoute = /^\/(?:materials|products|economy)(?:\/|$)/.test(
      returnUrl ?? '',
    );
    void this.router.navigateByUrl(
      isBakeryRoute && returnUrl ? returnUrl : '/materials',
    );
  }

  roleName(role: string): string {
    return role === 'ADMIN' ? 'Administración' : role === 'EDITOR' ? 'Edición' : 'Consulta';
  }
}
