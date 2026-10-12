import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { MaterialPriceHistory, MeasurementUnit, PricePreview } from '../core/api.models';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-material-prices',
  template: `
    <main class="page">
      <a class="back" routerLink="/materials">← Volver al catálogo</a>
      @if (loading()) { <p class="state">Cargando historial de precios…</p> }
      @else if (error() && !history()) { <p class="error" role="alert">{{ error() }}</p> }
      @else if (history(); as data) {
        <div class="heading"><div><p class="eyebrow">HISTORIAL DE PRECIOS</p><h1>{{ data.material.name }}</h1><p class="muted">Unidad base: {{ data.material.baseUnit.name }} ({{ data.material.baseUnit.code }})</p></div>
          @if (canEdit) { <a class="button primary" [routerLink]="['/materials', data.material.id, 'edit']">Editar materia prima</a> }
        </div>
        @if (canEdit) {
          <section class="panel">
            <h2>Registrar nuevo precio</h2>
            <form [formGroup]="form" (ngSubmit)="save()">
              <label>Precio del paquete (CUP)<input inputmode="decimal" formControlName="packagePriceCUP" placeholder="0.00"></label>
              <label>Cantidad del paquete<input inputmode="decimal" formControlName="packageQuantity" placeholder="1"></label>
              <label>Unidad del paquete<select formControlName="packageUnitId"><option value="">Selecciona una unidad</option>@for (unit of compatibleUnits(); track unit.id) { <option [value]="unit.id">{{ unit.name }} ({{ unit.code }})</option> }</select></label>
              <label>Vigente desde<input type="date" formControlName="effectiveFrom"></label>
              <label>Vigente hasta (opcional)<input type="date" formControlName="effectiveTo"></label>
              <label class="wide">Origen o nota (opcional)<input formControlName="sourceNote" maxlength="500"></label>
              @if (preview()) {
                <div class="preview wide" aria-live="polite">
                  <strong>Conversión calculada por el servidor</strong>
                  <span>{{ preview()?.normalizedQuantityInBaseUnit }} {{ data.material.baseUnit.code }} por paquete</span>
                  <span>{{ preview()?.pricePerBaseUnitCUP }} CUP / {{ data.material.baseUnit.code }}</span>
                </div>
              }
              @if (error()) { <p class="error wide" role="alert">{{ error() }}</p> }
              @if (saved()) { <p class="success wide" role="status">El nuevo precio quedó registrado en el historial.</p> }
              <div class="actions wide">
                <button class="secondary" type="button" [disabled]="form.invalid || previewing()" (click)="calculate()">{{ previewing() ? 'Calculando…' : 'Calcular conversión' }}</button>
                <button class="primary" type="submit" [disabled]="form.invalid || saving() || !preview()">{{ saving() ? 'Guardando…' : 'Guardar precio' }}</button>
              </div>
            </form>
          </section>
        }
        <section class="panel">
          <h2>Precios registrados</h2>
          @if (data.items.length === 0) { <p class="muted">Todavía no hay precios registrados.</p> }
          @else {
            <div class="table-wrap"><table><thead><tr><th>Vigencia</th><th>Precio del paquete</th><th>Cantidad</th><th>Precio por unidad base</th><th>Origen</th></tr></thead>
              <tbody>@for (price of data.items; track price.id) { <tr><td>{{ price.effectiveFrom }} – {{ price.effectiveTo ?? 'Sin fecha final' }}</td><td>{{ price.packagePriceCUP }} CUP</td><td>{{ price.packageQuantity }} {{ price.packageUnit.code }}</td><td>{{ price.pricePerBaseUnitCUP }} CUP / {{ data.material.baseUnit.code }}</td><td>{{ price.sourceNote || '—' }}</td></tr> }</tbody>
            </table></div>
          }
        </section>
      }
    </main>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 80rem); margin: 2rem auto 3rem; }
    .back { color: #28643a; font-weight: 700; text-decoration: none; }
    .heading { display: flex; justify-content: space-between; align-items: end; gap: 1rem; margin: 1.3rem 0; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .35rem 0; color: #263c2a; font: 500 clamp(2rem, 5vw, 2.7rem)/1.1 Georgia, serif; }
    h2 { color: #263c2a; font: 500 1.4rem Georgia, serif; }
    .muted { color: #69746b; }
    .panel { margin: 1rem 0; padding: clamp(1rem, 3vw, 1.5rem); background: white; border: 1px solid #e4e6df; border-radius: .8rem; }
    form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .85rem; font-weight: 650; }
    input, select { width: 100%; padding: .68rem .72rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; color: #26352a; font: inherit; }
    .wide { grid-column: 1 / -1; }
    .preview { display: grid; gap: .2rem; padding: .85rem; border-radius: .55rem; background: #eef6ec; color: #285638; }
    .actions { display: flex; flex-wrap: wrap; gap: .65rem; }
    .button, button { display: inline-flex; justify-content: center; padding: .7rem 1rem; border: 1px solid transparent; border-radius: .5rem; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
    .primary { color: white; background: #28643a; }
    .secondary { color: #315b3a; background: white; border-color: #d4ddd3; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: .8rem .65rem; border-bottom: 1px solid #edf0eb; white-space: nowrap; }
    th { color: #657067; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
    .error { color: #a33127; }
    .success { color: #25613a; }
    .state { padding: 2rem; text-align: center; }
    @media(max-width: 620px) { form { grid-template-columns: 1fr; } .heading { align-items: start; flex-direction: column; } .wide { grid-column: auto; } }
  `],
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
          error: () => {
            this.error.set('No se pudieron cargar las unidades de medida.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de precios.');
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
      error: () => {
        this.preview.set(null);
        this.error.set('No se pudo calcular la conversión. Revisa las unidades y fechas.');
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
      error: () => {
        this.error.set('No se pudo guardar el precio. Revisa su vigencia e inténtalo de nuevo.');
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
      error: () => this.error.set('El precio se guardó, pero no se pudo actualizar la lista.'),
    });
  }
}
