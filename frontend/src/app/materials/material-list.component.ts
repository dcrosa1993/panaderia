import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Material, MaterialKind } from '../core/api.models';
import { SessionStore } from '../core/session-store.service';

const materialKindOptions: { value: MaterialKind; label: string }[] = [
  { value: 'INGREDIENT', label: 'Ingrediente' },
  { value: 'PACKAGING', label: 'Envase' },
  { value: 'CONSUMABLE', label: 'Consumible' },
  { value: 'FUEL', label: 'Combustible' },
  { value: 'OTHER', label: 'Otro' },
];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-material-list',
  template: `
    <main class="page">
      <div class="heading">
        <div><p class="eyebrow">CATÁLOGO</p><h1>Materias primas</h1><p class="muted">Controla tus insumos y consulta su historial de precios.</p></div>
        @if (canEdit()) { <a class="button primary" routerLink="/materials/new">＋ Nueva materia prima</a> }
      </div>
      <section class="filters" aria-label="Filtros del catálogo">
        <label>Buscar <input [(ngModel)]="search" (keyup.enter)="applyFilters()" placeholder="Nombre de materia prima"></label>
        <label>Tipo
          <select [(ngModel)]="kind" (change)="applyFilters()">
            <option value="">Todos</option>
            @for (option of kinds; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
          </select>
        </label>
        <label>Estado
          <select [(ngModel)]="activeFilter" (change)="applyFilters()">
            <option value="">Todos</option><option value="true">Activas</option><option value="false">Inactivas</option>
          </select>
        </label>
        <button class="button secondary" type="button" (click)="applyFilters()">Buscar</button>
      </section>
      @if (loading()) { <p class="state">Cargando materias primas…</p> }
      @else if (error()) { <p class="state error" role="alert">{{ error() }}</p> }
      @else if (items().length === 0) {
        <section class="empty"><h2>No hay materias primas</h2><p>Prueba con otros filtros o crea la primera materia prima.</p></section>
      } @else {
        <section class="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Unidad base</th><th>Precio vigente</th><th>Estado</th><th><span class="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr>
                  <td><strong>{{ item.name }}</strong></td><td>{{ kindLabel(item.kind) }}</td>
                  <td>{{ item.baseUnit.name }} ({{ item.baseUnit.code }})</td>
                  <td>@if (item.currentPrice) { {{ item.currentPrice.pricePerBaseUnitCUP }} CUP / {{ item.baseUnit.code }} } @else { <span class="muted">Sin precio vigente</span> }</td>
                  <td><span class="badge" [class.inactive]="!item.isActive">{{ item.isActive ? 'Activa' : 'Inactiva' }}</span></td>
                  <td class="actions"><a [routerLink]="['/materials', item.id, 'prices']">Precios</a>@if (canEdit()) { <a [routerLink]="['/materials', item.id, 'edit']">Editar</a> }</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        <div class="pagination">
          <span>{{ result()?.total }} registros · Página {{ result()?.page }} de {{ result()?.totalPages || 1 }}</span>
          <div><button class="button secondary" type="button" [disabled]="page <= 1" (click)="changePage(-1)">Anterior</button><button class="button secondary" type="button" [disabled]="page >= (result()?.totalPages ?? 1)" (click)="changePage(1)">Siguiente</button></div>
        </div>
      }
    </main>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 80rem); margin: 2.5rem auto; }
    .heading { display: flex; justify-content: space-between; align-items: end; gap: 1rem; margin-bottom: 1.5rem; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .35rem 0; color: #263c2a; font: 500 clamp(2rem, 5vw, 2.7rem)/1.1 Georgia, serif; }
    h2 { font-family: Georgia, serif; }
    .muted { color: #69746b; }
    .filters { display: flex; align-items: end; flex-wrap: wrap; gap: .8rem; padding: 1rem; margin-bottom: 1rem; background: #fff; border: 1px solid #e4e6df; border-radius: .8rem; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .82rem; font-weight: 650; }
    input, select { min-width: 9rem; padding: .65rem .75rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; font: inherit; color: #26352a; }
    input { min-width: min(18rem, 70vw); }
    .button { display: inline-flex; align-items: center; justify-content: center; padding: .7rem 1rem; border-radius: .55rem; border: 1px solid transparent; text-decoration: none; font: inherit; font-weight: 700; cursor: pointer; }
    .primary { color: #fff; background: #28643a; }
    .secondary { color: #315b3a; background: white; border-color: #d4ddd3; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .table-wrap { overflow-x: auto; background: #fff; border: 1px solid #e4e6df; border-radius: .8rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: .9rem 1rem; border-bottom: 1px solid #edf0eb; white-space: nowrap; }
    th { color: #657067; font-size: .76rem; text-transform: uppercase; letter-spacing: .06em; }
    tr:last-child td { border-bottom: 0; }
    .actions { display: flex; gap: .8rem; }
    .actions a { color: #28643a; font-weight: 700; text-decoration: none; }
    .badge { padding: .25rem .55rem; color: #25613a; background: #e8f3e8; border-radius: 2rem; font-size: .78rem; }
    .badge.inactive { color: #657067; background: #eef0ed; }
    .empty, .state { padding: 2rem; text-align: center; background: #fff; border: 1px solid #e4e6df; border-radius: .8rem; }
    .error { color: #a33127; }
    .pagination { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 0; color: #66716a; }
    .pagination div { display: flex; gap: .5rem; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
    @media(max-width: 600px) { .heading { align-items: start; flex-direction: column; } .pagination { align-items: start; flex-direction: column; } }
  `],
})
export class MaterialListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  readonly items = signal<Material[]>([]);
  readonly result = signal<{ total: number; page: number; totalPages: number } | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly kinds = materialKindOptions;
  search = '';
  kind: MaterialKind | '' = '';
  activeFilter: '' | 'true' | 'false' = '';
  page = 1;
  readonly canEdit = () => {
    const role = this.session.bakeries().find(
      (bakery) => bakery.id === this.session.activeBakeryId(),
    )?.role;
    return role === 'ADMIN' || role === 'EDITOR';
  };

  ngOnInit(): void {
    this.load();
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  changePage(delta: number): void {
    this.page += delta;
    this.load();
  }

  kindLabel(kind: MaterialKind): string {
    return materialKindOptions.find((item) => item.value === kind)?.label ?? kind;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.materials({
      page: this.page,
      pageSize: 20,
      search: this.search.trim(),
      kind: this.kind,
      isActive: this.activeFilter === '' ? null : this.activeFilter === 'true',
    }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.result.set(result);
        this.page = result.page;
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo. Inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }
}
