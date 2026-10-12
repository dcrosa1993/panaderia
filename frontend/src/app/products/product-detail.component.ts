import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import {
  Product,
  RecipeVersionSummary,
  MeasurementUnit,
} from '../core/api.models';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-product-detail',
  template: `
    <main class="page">
      <a class="back" routerLink="/products">← Volver a productos</a>
      @if (loading()) { <p class="state">Cargando producto y recetas…</p> }
      @else if (error() && !product()) { <p class="state error" role="alert">{{ error() }}</p> }
      @else if (product(); as data) {
        <header class="heading">
          <div><p class="eyebrow">PRODUCTO · {{ data.status }}</p><h1>{{ data.name }}</h1>
            <p class="muted">{{ data.description || 'Sin descripción' }} · Unidad de venta: {{ data.salesUnit.name }} ({{ data.salesUnit.code }})</p>
          </div>
          @if (canEdit) { <a class="button secondary" [routerLink]="['/products', data.id, 'edit']">Editar producto</a> }
        </header>
        @if (canEdit) {
          <section class="panel">
            <h2>Nueva versión de receta</h2>
            @if (data.recipeSummary.publishedVersion) {
              <p>Se creará un borrador clonando la versión publicada más reciente, con su rendimiento, notas e ingredientes.</p>
              <button class="primary" type="button" [disabled]="creating()" (click)="createDraft()">
                {{ creating() ? 'Creando…' : 'Crear borrador desde la versión publicada' }}
              </button>
            } @else {
              <p>Indica el rendimiento y la unidad de salida para iniciar el primer borrador.</p>
              <form [formGroup]="initialForm" (ngSubmit)="createDraft()">
                <label>Rendimiento del lote
                  <input inputmode="decimal" formControlName="outputQuantity" placeholder="10">
                </label>
                <label>Unidad de salida compatible con {{ data.salesUnit.dimension }}
                  <select formControlName="outputUnitId">
                    <option value="">Selecciona una unidad</option>
                    @for (unit of outputUnits(); track unit.id) {
                      <option [value]="unit.id">{{ unit.name }} ({{ unit.code }})</option>
                    }
                  </select>
                </label>
                <label class="wide">Notas iniciales (opcional)
                  <textarea rows="2" formControlName="preparationNotes"></textarea>
                </label>
                <button class="primary" type="submit" [disabled]="initialForm.invalid || creating()">
                  {{ creating() ? 'Creando…' : 'Crear primer borrador' }}
                </button>
              </form>
            }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          </section>
        }
        <section class="panel">
          <h2>Versiones de receta</h2>
          @if (versions().length === 0) { <p class="muted">Este producto todavía no tiene recetas. Puedes crear el primer borrador.</p> }
          @else {
            <div class="table-wrap"><table><thead><tr><th>Versión</th><th>Estado</th><th>Rendimiento</th><th>Vigencia</th><th>Ingredientes</th><th></th></tr></thead>
              <tbody>@for (version of versions(); track version.id) {
                <tr>
                  <td>v{{ version.versionNumber }}</td><td>{{ statusLabel(version.status) }}</td>
                  <td>{{ version.outputQuantity }} {{ version.outputUnit.code }}</td>
                  <td>{{ version.effectiveFrom || 'Sin publicar' }} – {{ version.effectiveTo || 'Abierta' }}</td>
                  <td>{{ version.materialCount }}</td>
                  <td><a [routerLink]="['/products', data.id, 'recipes', version.id]">{{ version.status === 'DRAFT' ? 'Editar borrador' : 'Consultar' }}</a></td>
                </tr>
              }</tbody>
            </table></div>
          }
        </section>
      }
    </main>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 80rem); margin: 2.5rem auto 3rem; }
    .back { color: #28643a; font-weight: 700; text-decoration: none; }
    .heading { display: flex; justify-content: space-between; align-items: end; gap: 1rem; margin: 1.3rem 0; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .35rem 0; color: #263c2a; font: 500 clamp(2rem, 5vw, 2.7rem)/1.1 Georgia, serif; }
    h2 { color: #263c2a; font: 500 1.4rem Georgia, serif; }
    .muted { color: #69746b; }
    .panel { margin: 1rem 0; padding: clamp(1rem, 3vw, 1.5rem); background: white; border: 1px solid #e4e6df; border-radius: .8rem; }
    form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; margin: 1rem 0; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .85rem; font-weight: 650; }
    input, select, textarea { width: 100%; padding: .68rem .72rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; color: #26352a; font: inherit; }
    .wide { grid-column: 1 / -1; }
    .button, button { display: inline-flex; justify-content: center; padding: .7rem 1rem; border: 1px solid transparent; border-radius: .5rem; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
    .primary { color: white; background: #28643a; }
    .secondary { color: #315b3a; background: white; border-color: #d4ddd3; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: .8rem .65rem; border-bottom: 1px solid #edf0eb; white-space: nowrap; }
    th { color: #657067; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
    td a { color: #28643a; font-weight: 700; text-decoration: none; }
    .error { color: #a33127; }
    .state { padding: 2rem; text-align: center; }
    @media(max-width: 620px) { form { grid-template-columns: 1fr; } .heading { align-items: start; flex-direction: column; } .wide { grid-column: auto; } }
  `],
})
export class ProductDetailComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  readonly productId = this.route.snapshot.paramMap.get('productId') ?? '';
  readonly product = signal<Product | null>(null);
  readonly versions = signal<RecipeVersionSummary[]>([]);
  readonly units = signal<MeasurementUnit[]>([]);
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly error = signal('');
  readonly canEdit = this.session.bakeries().some(
    (bakery) =>
      bakery.id === this.session.activeBakeryId() &&
      (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'),
  );
  readonly outputUnits = () =>
    this.units().filter(
      (unit) => unit.dimension === this.product()?.salesUnit.dimension,
    );
  readonly initialForm = this.formBuilder.nonNullable.group({
    outputQuantity: ['', [Validators.required, Validators.pattern(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)]],
    outputUnitId: ['', Validators.required],
    preparationNotes: ['', Validators.maxLength(4000)],
  });

  ngOnInit(): void {
    this.load();
  }

  statusLabel(status: RecipeVersionSummary['status']): string {
    return { DRAFT: 'Borrador', PUBLISHED: 'Publicada', ARCHIVED: 'Archivada' }[status];
  }

  createDraft(): void {
    if (!this.canEdit || this.creating()) return;
    const publishedExists = this.product()?.recipeSummary.publishedVersion !== null;
    if (!publishedExists && this.initialForm.invalid) {
      this.initialForm.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.error.set('');
    const input = publishedExists
      ? {}
      : {
          outputQuantity: this.initialForm.controls.outputQuantity.value,
          outputUnitId: this.initialForm.controls.outputUnitId.value,
          preparationNotes: this.initialForm.controls.preparationNotes.value.trim() || null,
        };
    this.api.createRecipeVersion(this.productId, input).subscribe({
      next: (result) => {
        void this.router.navigate([
          '/products',
          this.productId,
          'recipes',
          result.id,
        ], { queryParams: { cloned: result.clonedFromPublished } });
      },
      error: () => {
        this.error.set('No se pudo crear el borrador. Actualiza el producto e inténtalo de nuevo.');
        this.creating.set(false);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.product(this.productId).subscribe({
      next: (product) => {
        this.product.set(product);
        this.api.recipeVersions(this.productId).subscribe({
          next: (versions) => {
            this.versions.set(versions);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('No se pudieron cargar las versiones de receta.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('No se encontró el producto solicitado.');
        this.loading.set(false);
      },
    });
    this.api.measurementUnits().subscribe({
      next: (units) => this.units.set(units),
      error: () => this.error.set('No se pudieron cargar las unidades de medida.'),
    });
  }
}
