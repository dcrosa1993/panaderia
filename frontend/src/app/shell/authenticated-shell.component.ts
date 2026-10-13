import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzLayoutModule,
    NzMenuModule,
    NzSelectModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  selector: 'app-authenticated-shell',
  template: `
    <nz-layout class="min-h-screen bg-stone-50">
      <nz-header class="!h-auto !bg-white !px-4 shadow-sm sm:!px-8">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 py-3">
          <a class="flex items-center gap-2 text-lg font-semibold text-emerald-950 no-underline" routerLink="/products">
            <span class="grid size-9 place-items-center rounded-xl bg-emerald-800 font-serif text-white">P</span>
            Panadería
          </a>
          <nav class="min-w-0 flex-1" aria-label="Navegación principal">
            <ul nz-menu nzMode="horizontal" class="!border-0">
              <li nz-menu-item routerLink="/materials" routerLinkActive="ant-menu-item-selected">
                Materias primas
              </li>
              <li nz-menu-item routerLink="/products" routerLinkActive="ant-menu-item-selected">
                Productos y recetas
              </li>
              <li nz-menu-item routerLink="/economy" routerLinkActive="ant-menu-item-selected">
                Costes y tarifas
              </li>
            </ul>
          </nav>
          <div class="ml-auto flex items-center gap-2">
            @if (session.bakeries().length > 0) {
              <label class="sr-only" for="active-bakery">Panadería activa</label>
              <nz-select
                id="active-bakery"
                class="min-w-44"
                aria-label="Panadería activa"
                [ngModel]="session.activeBakeryId()"
                (ngModelChange)="selectBakery($event)"
              >
                @for (bakery of session.bakeries(); track bakery.id) {
                  <nz-option [nzValue]="bakery.id" [nzLabel]="bakery.name"></nz-option>
                }
              </nz-select>
            } @else {
              <a nz-button nzType="default" routerLink="/select-bakery">Seleccionar panadería</a>
            }
            <span class="hidden text-sm text-stone-600 md:inline">{{ session.user()?.displayName }}</span>
            <button nz-button nzType="text" type="button" (click)="logout()">Salir</button>
          </div>
        </div>
      </nz-header>
      <nz-content class="w-full">
        <router-outlet />
      </nz-content>
    </nz-layout>
  `,
})
export class AuthenticatedShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly session = this.auth.session;

  selectBakery(bakeryId: string): void {
    if (!this.session.bakeries().some((bakery) => bakery.id === bakeryId)) return;
    this.session.setActiveBakery(bakeryId);
    void this.router.navigate(['/materials']);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
