import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { MaterialKind, MeasurementUnit } from '../core/api.models';
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
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-material-form',
  template: `
    <main class="page">
      <a class="back" routerLink="/materials">← Volver al catálogo</a>
      <section class="panel">
        <p class="eyebrow">CATÁLOGO</p><h1>{{ editing ? 'Editar materia prima' : 'Nueva materia prima' }}</h1>
        @if (loading()) { <p>Cargando datos…</p> }
        @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <label for="name">Nombre<input id="name" formControlName="name" maxlength="180"></label>
            @if (form.controls.name.touched && form.controls.name.invalid) { <small>El nombre es obligatorio (máximo 180 caracteres).</small> }
            <label for="kind">Tipo
              <select id="kind" formControlName="kind">@for (kind of kinds; track kind.value) { <option [value]="kind.value">{{ kind.label }}</option> }</select>
            </label>
            <label for="baseUnit">Unidad base
              <select id="baseUnit" formControlName="baseUnitId"><option value="">Selecciona una unidad</option>@for (unit of units(); track unit.id) { <option [value]="unit.id">{{ unit.name }} ({{ unit.code }}) · {{ unit.dimension }}</option> }</select>
            </label>
            <label for="density">Densidad (g/ml), opcional<input id="density" inputmode="decimal" formControlName="densityGramPerMl" placeholder="No se usa para conversiones en esta fase"></label>
            @if (editing) { <label class="check"><input type="checkbox" formControlName="isActive"> Materia prima activa</label> }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <div class="actions"><button class="primary" type="submit" [disabled]="form.invalid || saving() || !canEdit">{{ saving() ? 'Guardando…' : 'Guardar' }}</button><a routerLink="/materials">Cancelar</a></div>
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
    input, select { width: 100%; padding: .7rem .75rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; color: #26352a; font: inherit; }
    .check { display: flex; align-items: center; gap: .6rem; }
    .check input { width: auto; }
    small, .error { color: #a33127; }
    .actions { display: flex; align-items: center; gap: 1rem; margin-top: .5rem; }
    .actions a { color: #28643a; font-weight: 700; text-decoration: none; }
    button { padding: .75rem 1.1rem; border: 0; border-radius: .5rem; color: white; background: #28643a; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: not-allowed; }
  `],
})
export class MaterialFormComponent implements OnInit {
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
      next: (material) => void this.router.navigate(['/materials', material.id, 'prices']),
      error: () => {
        this.error.set('No se pudo guardar. Revisa los datos e inténtalo de nuevo.');
        this.saving.set(false);
      },
    });
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
      error: () => {
        this.error.set('No se encontró la materia prima solicitada.');
        this.loading.set(false);
      },
    });
  }
}
