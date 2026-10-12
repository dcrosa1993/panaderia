import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../core/api.service';
import { MaterialPriceHistory, MeasurementUnit, PricePreview } from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [NzAlertModule, NzButtonModule, NzInputModule, NzSelectModule, NzTableModule, ReactiveFormsModule, RouterLink],
  selector: 'app-material-prices',
  template: `
    <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <a class="font-semibold text-emerald-800 no-underline" routerLink="/materials">← Volver al catálogo</a>
      @if (loading()) { <p class="state">Cargando historial de precios…</p> }
      @else if (error() && !history()) { <nz-alert class="my-4 block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
      @else if (history(); as data) {
        <div class="my-5 flex flex-wrap items-end justify-between gap-4"><div><p class="text-xs font-extrabold tracking-[.14em] text-emerald-800">HISTORIAL DE PRECIOS</p><h1 class="font-serif text-3xl text-emerald-950">{{ data.material.name }}</h1><p class="text-stone-600">Unidad base: {{ data.material.baseUnit.name }} ({{ data.material.baseUnit.code }})</p></div>
          @if (canEdit) { <a nz-button nzType="default" [routerLink]="['/materials', data.material.id, 'edit']">Editar materia prima</a> }
        </div>
        @if (canEdit) {
          <section class="my-4 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
            <h2 class="font-serif text-xl text-emerald-950">Registrar nuevo precio</h2>
            <form class="grid grid-cols-1 gap-4 md:grid-cols-2" [formGroup]="form" (ngSubmit)="save()">
              <label class="grid gap-2 text-sm font-medium text-stone-700">Precio del paquete (CUP)<input nz-input inputmode="decimal" formControlName="packagePriceCUP" placeholder="0.00"></label>
              <label class="grid gap-2 text-sm font-medium text-stone-700">Cantidad del paquete<input nz-input inputmode="decimal" formControlName="packageQuantity" placeholder="1"></label>
              <label class="grid gap-2 text-sm font-medium text-stone-700">Unidad del paquete
                <nz-select formControlName="packageUnitId" nzPlaceHolder="Selecciona una unidad">@for (unit of compatibleUnits(); track unit.id) { <nz-option [nzValue]="unit.id" [nzLabel]="unit.name + ' (' + unit.code + ')'"></nz-option> }</nz-select>
              </label>
              <label class="grid gap-2 text-sm font-medium text-stone-700">Vigente desde<input nz-input type="date" formControlName="effectiveFrom"></label>
              <label class="grid gap-2 text-sm font-medium text-stone-700">Vigente hasta (opcional)<input nz-input type="date" formControlName="effectiveTo"></label>
              <label class="grid gap-2 text-sm font-medium text-stone-700 md:col-span-2">Origen o nota (opcional)<input nz-input formControlName="sourceNote" maxlength="500"></label>
              @if (preview()) {
                <div class="grid gap-1 rounded-lg bg-emerald-50 p-4 text-emerald-900 md:col-span-2" aria-live="polite">
                  <strong>Conversión calculada por el servidor</strong>
                  <span>{{ preview()?.normalizedQuantityInBaseUnit }} {{ data.material.baseUnit.code }} por paquete</span>
                  <span>{{ preview()?.pricePerBaseUnitCUP }} CUP / {{ data.material.baseUnit.code }}</span>
                </div>
              }
              @if (error()) { <nz-alert class="md:col-span-2" nzType="error" [nzMessage]="error()" nzShowIcon /> }
              @if (saved()) { <nz-alert class="md:col-span-2" nzType="success" nzMessage="El nuevo precio quedó registrado en el historial." nzShowIcon /> }
              <div class="flex flex-wrap gap-3 md:col-span-2">
                <button nz-button nzType="default" type="button" [disabled]="form.invalid || previewing()" (click)="calculate()">{{ previewing() ? 'Calculando…' : 'Calcular conversión' }}</button>
                <button nz-button nzType="primary" type="submit" [disabled]="form.invalid || saving() || !preview()">{{ saving() ? 'Guardando…' : 'Guardar precio' }}</button>
              </div>
            </form>
          </section>
        }
        <section class="my-4 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 class="mb-4 font-serif text-xl text-emerald-950">Precios registrados</h2>
          @if (data.items.length === 0) { <p class="muted">Todavía no hay precios registrados.</p> }
          @else {
            <div class="overflow-x-auto"><nz-table [nzData]="data.items" [nzFrontPagination]="false" [nzShowPagination]="false"><thead><tr><th>Vigencia</th><th>Precio del paquete</th><th>Cantidad</th><th>Precio por unidad base</th><th>Origen</th></tr></thead>
              <tbody>@for (price of data.items; track price.id) { <tr><td>{{ price.effectiveFrom }} – {{ price.effectiveTo ?? 'Sin fecha final' }}</td><td>{{ price.packagePriceCUP }} CUP</td><td>{{ price.packageQuantity }} {{ price.packageUnit.code }}</td><td>{{ price.pricePerBaseUnitCUP }} CUP / {{ data.material.baseUnit.code }}</td><td>{{ price.sourceNote || '—' }}</td></tr> }</tbody>
            </nz-table></div>
          }
        </section>
      }
    </main>
  `,
})
export class MaterialPricesComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  readonly materialId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly history = signal<MaterialPriceHistory | null>(null);
  readonly units = signal<MeasurementUnit[]>([]);
  readonly preview = signal<PricePreview | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly previewing = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly canEdit = this.session.bakeries().some(
    (bakery) =>
      bakery.id === this.session.activeBakeryId() &&
      (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'),
  );
  readonly compatibleUnits = () => {
    const dimension = this.history()?.material.baseUnit.dimension;
    return this.units().filter((unit) => unit.dimension === dimension);
  };
  readonly form = this.formBuilder.nonNullable.group({
    packagePriceCUP: ['', [Validators.required, Validators.pattern(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/)]],
    packageQuantity: ['', [Validators.required, Validators.pattern(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)]],
    packageUnitId: ['', Validators.required],
    effectiveFrom: ['', Validators.required],
    effectiveTo: [''],
    sourceNote: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => this.preview.set(null));
    this.api.priceHistory(this.materialId).subscribe({
      next: (history) => {
        this.history.set(history);
        this.api.measurementUnits(history.material.baseUnit.dimension).subscribe({
          next: (units) => {
            this.units.set(units);
            this.loading.set(false);
          },
          error: (error: unknown) => {
            this.error.set(apiErrorMessage(
              error,
              'No se pudieron cargar las unidades de medida.',
            ));
            this.loading.set(false);
          },
        });
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se pudo cargar el historial de precios.',
        ));
        this.loading.set(false);
      },
    });
  }

  calculate(): void {
    if (this.form.invalid || !this.canEdit) {
      this.form.markAllAsTouched();
      return;
    }
    this.previewing.set(true);
    this.error.set('');
    this.saved.set(false);
    this.api.previewPrice(this.materialId, this.priceInput()).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.previewing.set(false);
      },
      error: (error: unknown) => {
        this.preview.set(null);
        this.error.set(apiErrorMessage(
          error,
          'No se pudo calcular la conversión. Revisa las unidades y fechas.',
        ));
        this.previewing.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid || !this.preview() || this.saving() || !this.canEdit) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.createPrice(this.materialId, this.priceInput()).subscribe({
      next: () => {
        this.saved.set(true);
        this.saving.set(false);
        this.preview.set(null);
        this.form.reset({
          packagePriceCUP: '',
          packageQuantity: '',
          packageUnitId: '',
          effectiveFrom: '',
          effectiveTo: '',
          sourceNote: '',
        });
        this.loadHistory();
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se pudo guardar el precio. Revisa su vigencia e inténtalo de nuevo.',
        ));
        this.saving.set(false);
      },
    });
  }

  private priceInput() {
    const value = this.form.getRawValue();
    return {
      packagePriceCUP: value.packagePriceCUP,
      packageQuantity: value.packageQuantity,
      packageUnitId: value.packageUnitId,
      effectiveFrom: value.effectiveFrom,
      ...(value.effectiveTo ? { effectiveTo: value.effectiveTo } : {}),
      ...(value.sourceNote.trim() ? { sourceNote: value.sourceNote.trim() } : {}),
    };
  }

  private loadHistory(): void {
    this.api.priceHistory(this.materialId).subscribe({
      next: (history) => this.history.set(history),
      error: (error: unknown) => this.error.set(apiErrorMessage(
        error,
        'El precio se guardó, pero no se pudo actualizar la lista.',
      )),
    });
  }
}
