import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../core/api.service';
import { Material, MaterialKind } from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';
import { MaterialFormComponent } from './material-form.component';

const materialKindOptions: { value: MaterialKind; label: string }[] = [
  { value: 'INGREDIENT', label: 'Ingrediente' },
  { value: 'PACKAGING', label: 'Envase' },
  { value: 'CONSUMABLE', label: 'Consumible' },
  { value: 'FUEL', label: 'Combustible' },
  { value: 'OTHER', label: 'Otro' },
];

@Component({
  standalone: true,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzPaginationModule,
    NzSelectModule,
    NzTableModule,
    RouterLink,
    MaterialFormComponent,
  ],
  selector: 'app-material-list',
  template: `
    <main class="page mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="heading flex flex-wrap items-end gap-4">
        <div><p class="eyebrow">CATÁLOGO</p><h1>Materias primas</h1><p class="muted">Controla tus insumos y consulta su historial de precios.</p></div>
        @if (canEdit()) { <button nz-button nzType="primary" type="button" (click)="createModal.set(true)">＋ Agregar materia prima</button> }
      </div>
      <section class="filters flex flex-wrap items-end gap-4" aria-label="Filtros del catálogo">
        <label>Buscar <input nz-input [(ngModel)]="search" (keyup.enter)="applyFilters()" placeholder="Nombre de materia prima"></label>
        <label>Tipo
          <nz-select class="min-w-40" [(ngModel)]="kind" (ngModelChange)="applyFilters()">
            <nz-option nzValue="" nzLabel="Todos"></nz-option>
            @for (option of kinds; track option.value) { <nz-option [nzValue]="option.value" [nzLabel]="option.label"></nz-option> }
          </nz-select>
        </label>
        <label>Estado
          <nz-select class="min-w-40" [(ngModel)]="activeFilter" (ngModelChange)="applyFilters()">
            <nz-option nzValue="" nzLabel="Todos"></nz-option>
            <nz-option nzValue="true" nzLabel="Activas"></nz-option>
            <nz-option nzValue="false" nzLabel="Inactivas"></nz-option>
          </nz-select>
        </label>
        <button nz-button nzType="default" type="button" (click)="applyFilters()">Buscar</button>
      </section>
      @if (loading()) { <p class="state">Cargando materias primas…</p> }
      @else if (error()) { <nz-alert class="mb-4 block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
      @else if (items().length === 0) {
        <section class="empty"><h2>No hay materias primas</h2><p>Prueba con otros filtros o crea la primera materia prima.</p></section>
      } @else {
        <section class="table-wrap">
          <nz-table [nzData]="items()" [nzFrontPagination]="false" [nzShowPagination]="false">
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
          </nz-table>
        </section>
        <div class="pagination flex flex-wrap items-center justify-between gap-4">
          <span>{{ result()?.total }} registros · Página {{ result()?.page }} de {{ result()?.totalPages || 1 }}</span>
          <nz-pagination [nzPageIndex]="page" [nzTotal]="result()?.total ?? 0" [nzPageSize]="20" (nzPageIndexChange)="goToPage($event)"></nz-pagination>
        </div>
      }
    </main>
    <nz-modal nzTitle="Agregar ingrediente o material" [nzVisible]="createModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="680">
      <ng-container *nzModalContent>
        @if (createModal()) {
          <app-material-form [modal]="true" (saved)="materialCreated()" (cancelled)="createModal.set(false)" />
        }
      </ng-container>
    </nz-modal>
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
  readonly createModal = signal(false);
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

  materialCreated(): void {
    this.createModal.set(false);
    this.load();
  }

  ngOnInit(): void {
    this.load();
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  goToPage(page: number): void {
    this.page = page;
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
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se pudo cargar el catálogo. Inténtalo de nuevo.',
        ));
        this.loading.set(false);
      },
    });
  }
}
