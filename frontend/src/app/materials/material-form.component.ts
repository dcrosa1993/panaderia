import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../core/api.service';
import { Material, MaterialKind, MeasurementUnit } from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';

const MATERIAL_KINDS: { value: MaterialKind; label: string }[] = [
  { value: 'INGREDIENT', label: 'Ingrediente' },
  { value: 'PACKAGING', label: 'Envase' },
  { value: 'CONSUMABLE', label: 'Consumible' },
  { value: 'FUEL', label: 'Combustible' },
  { value: 'OTHER', label: 'Otro' },
];

@Component({
  standalone: true,
  imports: [NzAlertModule, NzButtonModule, NzInputModule, NzModalModule, NzSelectModule, ReactiveFormsModule, RouterLink],
  selector: 'app-material-form',
  template: `
    <main [class]="modal ? 'w-full' : 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6'">
      @if (!modal) { <a class="font-semibold text-emerald-800 no-underline" routerLink="/materials">← Volver al catálogo</a> }
      <section [class]="modal ? '' : 'mt-4 rounded-xl border border-stone-200 bg-white p-5 sm:p-8'">
        <p class="text-xs font-extrabold tracking-[.14em] text-emerald-800">CATÁLOGO</p><h1 class="mb-6 font-serif text-3xl font-medium text-emerald-950">{{ editing ? 'Editar materia prima' : 'Nueva materia prima' }}</h1>
        @if (loading()) { <p class="text-stone-600">Cargando datos…</p> }
        @else {
          <form class="grid gap-4" [formGroup]="form" (ngSubmit)="submit()">
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="name">Nombre<input nz-input id="name" formControlName="name" maxlength="180"></label>
            @if (form.controls.name.touched && form.controls.name.invalid) { <small class="-mt-3 text-sm text-red-700">El nombre es obligatorio (máximo 180 caracteres).</small> }
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="kind">Tipo
              <nz-select id="kind" formControlName="kind">@for (kind of kinds; track kind.value) { <nz-option [nzValue]="kind.value" [nzLabel]="kind.label"></nz-option> }</nz-select>
            </label>
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="baseUnit">Unidad base
              <nz-select id="baseUnit" formControlName="baseUnitId" nzPlaceHolder="Selecciona una unidad">@for (unit of units(); track unit.id) { <nz-option [nzValue]="unit.id" [nzLabel]="unit.name + ' (' + unit.code + ') · ' + unit.dimension"></nz-option> }</nz-select>
            </label>
            <label class="grid gap-2 text-sm font-medium text-stone-700" for="density">Densidad (g/ml), opcional<input nz-input id="density" inputmode="decimal" formControlName="densityGramPerMl" placeholder="No se usa para conversiones en esta fase"></label>
            @if (editing) { <label class="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" formControlName="isActive"> Materia prima activa</label> }
            @if (error()) { <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon /> }
            <div class="flex flex-wrap items-center gap-3 pt-2"><button nz-button nzType="primary" type="submit" [disabled]="form.invalid || saving() || !canEdit">{{ saving() ? 'Guardando…' : 'Guardar' }}</button><button nz-button nzType="default" type="button" [disabled]="saving()" (click)="cancel()">Cancelar</button></div>
          </form>
        }
      </section>
    </main>
  `,
})
export class MaterialFormComponent implements OnInit {
  @Input() modal = false;
  @Output() saved = new EventEmitter<Material>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  readonly units = signal<MeasurementUnit[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly kinds = MATERIAL_KINDS;
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly editing = this.id !== null;
  readonly canEdit = this.session.bakeries().some(
    (bakery) =>
      bakery.id === this.session.activeBakeryId() &&
      (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'),
  );
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    kind: ['INGREDIENT' as MaterialKind, Validators.required],
    baseUnitId: ['', Validators.required],
    densityGramPerMl: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    if (!this.canEdit) {
      this.error.set('Tu rol permite consultar, pero no modificar materias primas.');
      this.loading.set(false);
      return;
    }
    this.api.measurementUnits().subscribe({
      next: (units) => {
        this.units.set(units);
        if (this.id) this.loadMaterial();
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
    if (!this.units().some((unit) => unit.id === value.baseUnitId)) {
      this.error.set('Selecciona una unidad de medida activa.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const density = value.densityGramPerMl.trim() || undefined;
    const request = this.id
      ? this.api.updateMaterial(this.id, {
          ...value,
          densityGramPerMl: density ?? null,
        })
      : this.api.createMaterial({
          name: value.name.trim(),
          kind: value.kind,
          baseUnitId: value.baseUnitId,
          ...(density ? { densityGramPerMl: density } : {}),
        });
    request.subscribe({
      next: (material) => {
        if (this.modal) {
          this.saved.emit(material);
          return;
        }
        void this.router.navigate(['/materials', material.id, 'prices']);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se pudo guardar. Revisa los datos e inténtalo de nuevo.',
        ));
        this.saving.set(false);
      },
    });
  }

  cancel(): void {
    if (this.form.dirty && !globalThis.confirm('¿Descartar los cambios del formulario?')) {
      return;
    }
    if (this.modal) {
      this.cancelled.emit();
      return;
    }
    void this.router.navigate(['/materials']);
  }

  private loadMaterial(): void {
    this.api.material(this.id!).subscribe({
      next: (material) => {
        this.form.patchValue({
          name: material.name,
          kind: material.kind,
          baseUnitId: material.baseUnit.id,
          densityGramPerMl: material.densityGramPerMl ?? '',
          isActive: material.isActive,
        });
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(
          error,
          'No se encontró la materia prima solicitada.',
        ));
        this.loading.set(false);
      },
    });
  }
}
