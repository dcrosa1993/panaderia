import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { MeasurementUnit, ProductStatus } from '../core/api.models';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-product-form',
  template: `
    <main class="page">
      <a class="back" routerLink="/products">← Volver a productos</a>
      <section class="panel">
        <p class="eyebrow">CATÁLOGO</p>
        <h1>{{ editing ? 'Editar producto' : 'Nuevo producto' }}</h1>
        @if (loading()) { <p>Cargando datos…</p> }
        @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <label for="name">Nombre
              <input id="name" formControlName="name" maxlength="180">
            </label>
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <small>El nombre es obligatorio y admite hasta 180 caracteres.</small>
            }
            <label for="description">Descripción (opcional)
              <textarea id="description" rows="4" formControlName="description" maxlength="4000"></textarea>
            </label>
            <label for="salesUnit">Unidad de venta
              <select id="salesUnit" formControlName="salesUnitId">
                <option value="">Selecciona una unidad activa</option>
                @for (unit of units(); track unit.id) {
                  <option [value]="unit.id">{{ unit.name }} ({{ unit.code }}) · {{ unit.dimension }}</option>
                }
              </select>
            </label>
            @if (editing) {
              <label for="status">Estado
                <select id="status" formControlName="status">
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </label>
            }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <div class="actions">
              <button class="primary" type="submit" [disabled]="form.invalid || saving() || !canEdit">
                {{ saving() ? 'Guardando…' : 'Guardar producto' }}
              </button>
              <a routerLink="/products">Cancelar</a>
            </div>
          </form>
        }
      </section>
    </main>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 52rem); margin: 2.5rem auto; }
    .back { color: #28643a; font-weight: 700; text-decoration: none; }
    .panel { margin-top: 1rem; padding: clamp(1.25rem, 4vw, 2rem); background: white; border: 1px solid #e4e6df; border-radius: .85rem; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { color: #263c2a; font: 500 2rem Georgia, serif; }
    form { display: grid; gap: 1rem; }
    label { display: grid; gap: .4rem; color: #4c5b50; font-weight: 650; }
    input, select, textarea { width: 100%; padding: .7rem .75rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; color: #26352a; font: inherit; }
    small, .error { color: #a33127; }
    .actions { display: flex; align-items: center; gap: 1rem; margin-top: .5rem; }
    .actions a { color: #28643a; font-weight: 700; text-decoration: none; }
    button { padding: .75rem 1.1rem; border: 0; border-radius: .5rem; color: white; background: #28643a; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: not-allowed; }
  `],
})
export class ProductFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  readonly id = this.route.snapshot.paramMap.get('productId');
  readonly editing = this.id !== null;
  readonly units = signal<MeasurementUnit[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly canEdit = this.session.bakeries().some(
    (bakery) =>
      bakery.id === this.session.activeBakeryId() &&
      (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'),
  );
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    description: ['', Validators.maxLength(4000)],
    salesUnitId: ['', Validators.required],
    status: ['ACTIVE' as ProductStatus],
  });

  ngOnInit(): void {
    if (!this.canEdit) {
      this.error.set('Tu rol permite consultar, pero no modificar productos.');
      this.loading.set(false);
      return;
    }
    this.api.measurementUnits().subscribe({
      next: (units) => {
        this.units.set(units);
        if (this.id) this.loadProduct(this.id);
        else this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las unidades de medida.');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving() || !this.canEdit) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!this.units().some((unit) => unit.id === value.salesUnitId)) {
      this.error.set('Selecciona una unidad de venta activa.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const input = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      salesUnitId: value.salesUnitId,
    };
    const operation = this.id
      ? this.api.updateProduct(this.id, { ...input, status: value.status })
      : this.api.createProduct(input);
    operation.subscribe({
      next: (product) => void this.router.navigate(['/products', product.id]),
      error: () => {
        this.error.set('No se pudo guardar el producto. Revisa los datos e inténtalo de nuevo.');
        this.saving.set(false);
      },
    });
  }

  private loadProduct(id: string): void {
    this.api.product(id).subscribe({
      next: (product) => {
        this.form.patchValue({
          name: product.name,
          description: product.description ?? '',
          salesUnitId: product.salesUnit.id,
          status: product.status,
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se encontró el producto solicitado.');
        this.loading.set(false);
      },
    });
  }
}
