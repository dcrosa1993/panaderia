import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../core/api.service';
import { MeasurementUnit, ProductStatus } from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [NzAlertModule, NzButtonModule, NzInputModule, NzSelectModule, ReactiveFormsModule, RouterLink],
  selector: 'app-product-form',
  template: `
    <main class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <a class="font-semibold text-emerald-800 no-underline" routerLink="/products">← Volver a productos</a>
      <section class="mt-4 rounded-xl border border-stone-200 bg-white p-5 sm:p-8">
        <p class="text-xs font-extrabold tracking-[.14em] text-emerald-800">CATÁLOGO</p>
        <h1 class="mb-6 font-serif text-3xl font-medium text-emerald-950">{{ editing ? 'Editar producto' : 'Nuevo producto' }}</h1>
        @if (loading()) { <p class="text-stone-600">Cargando datos…</p> }
        @else {
          <form class="grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="name">Nombre
              <input nz-input id="name" formControlName="name" maxlength="180">
            </label>
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <small class="-mt-3 text-sm text-red-700">El nombre es obligatorio y admite hasta 180 caracteres.</small>
            }
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="description">Descripción (opcional)
              <textarea nz-input id="description" rows="4" formControlName="description" maxlength="4000"></textarea>
            </label>
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="salesUnit">Unidad de venta
              <nz-select id="salesUnit" formControlName="salesUnitId" nzPlaceHolder="Selecciona una unidad activa">
                @for (unit of units(); track unit.id) {
                  <nz-option [nzValue]="unit.id" [nzLabel]="unit.name + ' (' + unit.code + ') · ' + unit.dimension"></nz-option>
                }
              </nz-select>
            </label>
            @if (editing) {
              <label class="grid gap-2 text-sm font-medium text-stone-700" for="status">Estado
                <nz-select id="status" formControlName="status">
                  <nz-option nzValue="ACTIVE" nzLabel="Activo"></nz-option>
                  <nz-option nzValue="INACTIVE" nzLabel="Inactivo"></nz-option>
                  <nz-option nzValue="ARCHIVED" nzLabel="Archivado"></nz-option>
                </nz-select>
              </label>
            }
            @if (error()) { <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon /> }
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <button nz-button nzType="primary" type="submit" [disabled]="form.invalid || saving() || !canEdit">
                {{ saving() ? 'Guardando…' : 'Guardar producto' }}
              </button>
              <a class="font-semibold text-emerald-800 no-underline" routerLink="/products">Cancelar</a>
            </div>
          </form>
        }
      </section>
    </main>
  `,
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
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se pudo guardar el producto. Revisa los datos e inténtalo de nuevo.',
        ));
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
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se encontró el producto solicitado.',
        ));
        this.loading.set(false);
      },
    });
  }
}
