import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../core/api.service';
import {
  Product,
  ProductStatus,
} from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzPaginationModule,
    NzSelectModule,
    NzTableModule,
    RouterLink,
  ],
  selector: 'app-product-list',
  template: `
    <main class="page mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="heading flex flex-wrap items-end gap-4">
        <div><p class="eyebrow">PRODUCCIÓN</p><h1>Productos</h1><p class="muted">Organiza tus productos y sus recetas versionadas.</p></div>
        @if (canEdit()) { <a nz-button nzType="primary" routerLink="/products/new">＋ Nuevo producto</a> }
      </div>
      <section class="filters flex flex-wrap items-end gap-4" aria-label="Filtros de productos">
        <label>Buscar <input nz-input [(ngModel)]="search" (keyup.enter)="applyFilters()" placeholder="Nombre del producto"></label>
        <label>Estado
          <nz-select class="min-w-40" [(ngModel)]="status" (ngModelChange)="applyFilters()">
            <nz-option nzValue="" nzLabel="Todos"></nz-option>
            <nz-option nzValue="ACTIVE" nzLabel="Activos"></nz-option>
            <nz-option nzValue="INACTIVE" nzLabel="Inactivos"></nz-option>
            <nz-option nzValue="ARCHIVED" nzLabel="Archivados"></nz-option>
          </nz-select>
        </label>
        <button nz-button nzType="default" type="button" (click)="applyFilters()">Buscar</button>
      </section>
      @if (loading()) { <p class="state">Cargando productos…</p> }
      @else if (error()) { <nz-alert class="mb-4 block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
      @else if (items().length === 0) {
        <section class="empty"><h2>No hay productos</h2><p>Prueba con otros filtros o crea el primer producto.</p></section>
      } @else {
        <section class="table-wrap">
          <nz-table [nzData]="items()" [nzFrontPagination]="false" [nzShowPagination]="false">
            <thead><tr><th>Producto</th><th>Unidad de venta</th><th>Estado</th><th>Receta</th><th>Vigencia</th><th></th></tr></thead>
            <tbody>
              @for (product of items(); track product.id) {
                <tr>
                  <td><strong>{{ product.name }}</strong><small>{{ product.description || 'Sin descripción' }}</small></td>
                  <td>{{ product.salesUnit.name }} ({{ product.salesUnit.code }})</td>
                  <td>{{ productStatus(product.status) }}</td>
                  <td>{{ recipeStatus(product) }}</td>
                  <td>
                    @if (product.recipeSummary.publishedVersion; as published) {
                      v{{ published.versionNumber }} · {{ published.effectiveFrom || 'Sin fecha' }}
                    } @else { — }
                  </td>
                  <td class="actions"><a [routerLink]="['/products', product.id]">Ver recetas</a>@if (canEdit()) { <a [routerLink]="['/products', product.id, 'edit']">Editar</a> }</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </section>
        <div class="pagination flex flex-wrap items-center justify-between gap-4">
          <span>{{ total() }} productos · Página {{ page }} de {{ totalPages() || 1 }}</span>
          <nz-pagination [nzPageIndex]="page" [nzTotal]="total()" [nzPageSize]="20" (nzPageIndexChange)="goToPage($event)"></nz-pagination>
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
    .muted, small { color: #69746b; }
    small { display: block; margin-top: .25rem; font-weight: 400; }
    .filters { display: flex; align-items: end; flex-wrap: wrap; gap: .8rem; padding: 1rem; margin-bottom: 1rem; background: #fff; border: 1px solid #e4e6df; border-radius: .8rem; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .82rem; font-weight: 650; }
    input, select { min-width: 12rem; padding: .65rem .75rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; font: inherit; color: #26352a; }
    .button { display: inline-flex; align-items: center; justify-content: center; padding: .7rem 1rem; border-radius: .55rem; border: 1px solid transparent; text-decoration: none; font: inherit; font-weight: 700; cursor: pointer; }
    .primary { color: #fff; background: #28643a; }
    .secondary { color: #315b3a; background: white; border-color: #d4ddd3; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .table-wrap { overflow-x: auto; background: #fff; border: 1px solid #e4e6df; border-radius: .8rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: .85rem 1rem; border-bottom: 1px solid #edf0eb; white-space: nowrap; }
    th { color: #657067; font-size: .76rem; text-transform: uppercase; letter-spacing: .05em; }
    tr:last-child td { border-bottom: 0; }
    .actions { display: flex; gap: .8rem; }
    .actions a { color: #28643a; font-weight: 700; text-decoration: none; }
    .empty, .state { padding: 2rem; text-align: center; background: #fff; border: 1px solid #e4e6df; border-radius: .8rem; }
    .error { color: #a33127; }
    .pagination { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 0; color: #66716a; }
    .pagination div { display: flex; gap: .5rem; }
    @media(max-width: 600px) { .heading { align-items: start; flex-direction: column; } .pagination { align-items: start; flex-direction: column; } }
  `],
})
export class ProductListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  readonly items = signal<Product[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';
  status: ProductStatus | '' = '';
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

  goToPage(page: number): void {
    this.page = page;
    this.load();
  }

  productStatus(status: ProductStatus): string {
    return { ACTIVE: 'Activo', INACTIVE: 'Inactivo', ARCHIVED: 'Archivado' }[status];
  }

  recipeStatus(product: Product): string {
    const summary = product.recipeSummary;
    if (summary.draftVersionNumber !== null) {
      return `Borrador v${summary.draftVersionNumber}`;
    }
    if (summary.publishedVersion) {
      return `Publicada v${summary.publishedVersion.versionNumber}`;
    }
    return 'Sin receta';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.products({
      page: this.page,
      pageSize: 20,
      search: this.search.trim(),
      status: this.status,
    }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.totalPages.set(result.totalPages);
        this.page = result.page;
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se pudieron cargar los productos. Inténtalo de nuevo.',
        ));
        this.loading.set(false);
      },
    });
  }
}
