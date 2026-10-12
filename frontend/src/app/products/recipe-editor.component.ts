import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../core/api.service';
import {
  Material,
  MeasurementUnit,
  Product,
  RecipeVersionDetail,
} from '../core/api.models';
import { SessionStore } from '../core/session-store.service';

type RecipeLineControls = {
  materialId: FormControl<string>;
  quantity: FormControl<string>;
  unitId: FormControl<string>;
  notes: FormControl<string>;
};

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-recipe-editor',
  template: `
    <main class="page">
      <a class="back" [routerLink]="['/products', productId]">← Volver al producto</a>
      @if (loading()) { <p class="state">Cargando receta…</p> }
      @else if (error() && !version()) { <p class="state error" role="alert">{{ error() }}</p> }
      @else if (version(); as data) {
        <header class="heading">
          <div><p class="eyebrow">RECETA · {{ statusLabel(data.status) }} · VERSIÓN {{ data.versionNumber }}</p>
            <h1>{{ product()?.name }}</h1><p class="muted">Las cantidades y unidades se guardan como fueron elegidas. No se calcula el coste del producto.</p>
          </div>
        </header>
        @if (cloned) { <p class="notice" role="status">Se creó este borrador copiando el rendimiento, las notas y los ingredientes de la versión publicada.</p> }
        @if (data.status === 'PUBLISHED') {
          <p class="notice">Esta versión publicada es de solo lectura. Para hacer cambios, crea una nueva versión desde el producto.</p>
        } @else if (!canEdit) {
          <p class="notice">Tu rol permite consultar esta receta, pero no modificarla.</p>
        }
        <form [formGroup]="form" (ngSubmit)="saveDraft()">
          <section class="panel">
            <h2>Rendimiento del lote</h2>
            <div class="grid">
              <label>Rendimiento
                <input inputmode="decimal" formControlName="outputQuantity">
              </label>
              <label>Unidad de salida
                <select formControlName="outputUnitId">
                  @for (unit of outputUnits(); track unit.id) {
                    <option [value]="unit.id">{{ unit.name }} ({{ unit.code }})</option>
                  }
                </select>
              </label>
            </div>
            <label class="notes">Notas de preparación
              <textarea rows="3" formControlName="preparationNotes" maxlength="4000"></textarea>
            </label>
          </section>
          <section class="panel">
            <div class="section-heading"><h2>Ingredientes</h2>
              @if (editable()) { <button class="secondary" type="button" (click)="addLine()">＋ Añadir ingrediente</button> }
            </div>
            @if (lines.length === 0) {
              <p class="muted">Este borrador no tiene ingredientes. Añade al menos uno antes de publicarlo.</p>
            } @else {
              <div class="table-wrap"><table><thead><tr><th>Materia prima</th><th>Cantidad</th><th>Unidad</th><th>Nota</th><th></th></tr></thead>
                <tbody formArrayName="materials">
                  @for (line of lines.controls; track $index; let i = $index) {
                    <tr [formGroupName]="i">
                      <td>
                        <select formControlName="materialId" (change)="onMaterialChange(i)" [disabled]="!editable()">
                          <option value="">Selecciona una materia prima</option>
                          @for (material of materialsFor(line.controls.materialId.value); track material.id) {
                            <option [value]="material.id">{{ material.name }}{{ material.isActive ? '' : ' · Inactiva' }}</option>
                          }
                        </select>
                        @if (selectedMaterial(line.controls.materialId.value); as selected) {
                          @if (!selected.isActive) { <small class="error">Esta materia prima está inactiva; sustitúyela antes de guardar.</small> }
                          @else if (!selected.currentPrice) { <small class="warning">Sin precio vigente; esto no impide editar la receta.</small> }
                          @else { <small class="muted">Precio orientativo: {{ selected.currentPrice.pricePerBaseUnitCUP }} CUP / {{ selected.baseUnit.code }}</small> }
                        }
                      </td>
                      <td><input inputmode="decimal" formControlName="quantity" [readonly]="!editable()" placeholder="0.000000"></td>
                      <td>
                        <select formControlName="unitId" [disabled]="!editable()">
                          <option value="">Unidad</option>
                          @for (unit of unitsFor(line.controls.materialId.value); track unit.id) {
                            <option [value]="unit.id">{{ unit.name }} ({{ unit.code }})</option>
                          }
                        </select>
                      </td>
                      <td><input formControlName="notes" maxlength="500" [readonly]="!editable()"></td>
                      <td>@if (editable()) { <button class="remove" type="button" (click)="removeLine(i)" aria-label="Quitar ingrediente">Quitar</button> }</td>
                    </tr>
                  }
                </tbody>
              </table></div>
            }
          </section>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          @if (saved()) { <p class="success" role="status">El borrador quedó guardado.</p> }
          @if (editable()) {
            <div class="actions">
              <button class="primary" type="submit" [disabled]="saving() || form.invalid">{{ saving() ? 'Guardando…' : 'Guardar borrador' }}</button>
            </div>
          }
        </form>
        @if (editable()) {
          <section class="panel publish">
            <h2>Publicar versión</h2>
            <p>Al publicarla, quedará de solo lectura. Los cambios posteriores se hacen creando otra versión.</p>
            <label>Fecha de vigencia
              <input type="date" [value]="effectiveFrom()" (input)="setEffectiveFrom($event)">
            </label>
            <button class="primary" type="button" [disabled]="saving() || !effectiveFrom()" (click)="publish()">
              {{ saving() ? 'Publicando…' : 'Publicar versión' }}
            </button>
          </section>
        }
      }
    </main>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 80rem); margin: 2.5rem auto 3rem; }
    .back { color: #28643a; font-weight: 700; text-decoration: none; }
    .heading { margin: 1.3rem 0; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .35rem 0; color: #263c2a; font: 500 clamp(2rem, 5vw, 2.7rem)/1.1 Georgia, serif; }
    h2 { color: #263c2a; font: 500 1.4rem Georgia, serif; }
    .muted { color: #69746b; }
    .panel { margin: 1rem 0; padding: clamp(1rem, 3vw, 1.5rem); background: white; border: 1px solid #e4e6df; border-radius: .8rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; max-width: 42rem; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .85rem; font-weight: 650; }
    input, select, textarea { width: 100%; min-width: 8rem; padding: .65rem .7rem; border: 1px solid #d4ddd3; border-radius: .5rem; background: white; color: #26352a; font: inherit; }
    .notes { margin-top: .9rem; max-width: 55rem; }
    .section-heading { display: flex; justify-content: space-between; align-items: center; gap: .8rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: .65rem .5rem; border-bottom: 1px solid #edf0eb; vertical-align: top; }
    th { color: #657067; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
    td:first-child { min-width: 15rem; }
    small { display: block; margin-top: .25rem; font-size: .76rem; white-space: normal; }
    .warning { color: #8b641c; }
    .error { color: #a33127; }
    .success { color: #25613a; }
    .notice { padding: .8rem 1rem; border-radius: .55rem; color: #285638; background: #eef6ec; }
    .button, button { display: inline-flex; justify-content: center; padding: .65rem .85rem; border: 1px solid transparent; border-radius: .5rem; font: inherit; font-weight: 700; cursor: pointer; }
    .primary { color: white; background: #28643a; }
    .secondary { color: #315b3a; background: white; border-color: #d4ddd3; }
    .remove { color: #9b3428; background: transparent; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .actions { display: flex; justify-content: end; }
    .publish { display: grid; justify-items: start; gap: .8rem; }
    .publish p { margin: 0; color: #69746b; }
    .publish label { max-width: 18rem; }
    .state { padding: 2rem; text-align: center; }
    @media(max-width: 620px) { .grid { grid-template-columns: 1fr; } .section-heading { align-items: start; flex-direction: column; } }
  `],
})
export class RecipeEditorComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  readonly productId = this.route.snapshot.paramMap.get('productId') ?? '';
  readonly versionId = this.route.snapshot.paramMap.get('versionId') ?? '';
  readonly cloned = this.route.snapshot.queryParamMap.get('cloned') === 'true';
  readonly product = signal<Product | null>(null);
  readonly version = signal<RecipeVersionDetail | null>(null);
  readonly units = signal<MeasurementUnit[]>([]);
  readonly materials = signal<Material[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly effectiveFrom = signal('');
  readonly canEdit = this.session.bakeries().some(
    (bakery) =>
      bakery.id === this.session.activeBakeryId() &&
      (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'),
  );
  readonly form = this.formBuilder.nonNullable.group({
    outputQuantity: ['', [Validators.required, Validators.pattern(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)]],
    outputUnitId: ['', Validators.required],
    preparationNotes: ['', Validators.maxLength(4000)],
    materials: this.formBuilder.array<FormGroup<RecipeLineControls>>([]),
  });
  readonly lines: FormArray<FormGroup<RecipeLineControls>> =
    this.form.controls.materials;

  ngOnInit(): void {
    this.load();
  }

  editable(): boolean {
    return this.canEdit && this.version()?.status === 'DRAFT';
  }

  statusLabel(status: RecipeVersionDetail['status']): string {
    return { DRAFT: 'Borrador', PUBLISHED: 'Publicada', ARCHIVED: 'Archivada' }[status];
  }

  outputUnits(): MeasurementUnit[] {
    const dimension = this.product()?.salesUnit.dimension;
    return this.units().filter((unit) => unit.dimension === dimension);
  }

  selectedMaterial(materialId: string): Material | undefined {
    return this.materials().find((material) => material.id === materialId);
  }

  materialsFor(selectedId: string): Material[] {
    const selected = this.selectedMaterial(selectedId);
    if (selected && !selected.isActive) return [selected, ...this.materials()];
    return this.materials();
  }

  unitsFor(materialId: string): MeasurementUnit[] {
    const dimension = this.selectedMaterial(materialId)?.baseUnit.dimension;
    return this.units().filter((unit) => unit.dimension === dimension);
  }

  addLine(): void {
    if (!this.editable()) return;
    this.lines.push(this.createLine());
  }

  removeLine(index: number): void {
    if (!this.editable()) return;
    this.lines.removeAt(index);
  }

  onMaterialChange(index: number): void {
    const line = this.lines.at(index);
    const selected = this.selectedMaterial(line.controls.materialId.value);
    if (!selected) {
      line.controls.unitId.setValue('');
      return;
    }
    const currentUnit = line.controls.unitId.value;
    if (!this.unitsFor(selected.id).some((unit) => unit.id === currentUnit)) {
      line.controls.unitId.setValue(selected.baseUnit.id);
    }
  }

  setEffectiveFrom(event: Event): void {
    this.effectiveFrom.set((event.target as HTMLInputElement).value);
  }

  saveDraft(): void {
    if (!this.editable() || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);
    const value = this.form.getRawValue();
    this.api.updateRecipeVersion(this.productId, this.versionId, {
      outputQuantity: value.outputQuantity,
      outputUnitId: value.outputUnitId,
      preparationNotes: value.preparationNotes.trim() || null,
    }).pipe(
      switchMap(() =>
        this.api.replaceRecipeMaterials(
          this.productId,
          this.versionId,
          value.materials.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
            unitId: line.unitId,
            ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
          })),
        ),
      ),
    ).subscribe({
      next: (version) => {
        this.version.set(version);
        this.saved.set(true);
        this.saving.set(false);
      },
      error: () => {
        this.error.set('No se pudo guardar la receta. Revisa cantidades, unidades y materias primas activas.');
        this.saving.set(false);
      },
    });
  }

  publish(): void {
    if (!this.editable() || !this.effectiveFrom() || this.saving()) return;
    if (!window.confirm('Al publicar, esta versión quedará de solo lectura. ¿Deseas continuar?')) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.updateRecipeVersion(this.productId, this.versionId, {
      outputQuantity: this.form.controls.outputQuantity.value,
      outputUnitId: this.form.controls.outputUnitId.value,
      preparationNotes: this.form.controls.preparationNotes.value.trim() || null,
    }).pipe(
      switchMap(() => {
        const lines = this.form.getRawValue().materials;
        return this.api.replaceRecipeMaterials(
          this.productId,
          this.versionId,
          lines.map((line) => ({
            materialId: line.materialId,
            quantity: line.quantity,
            unitId: line.unitId,
            ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
          })),
        );
      }),
      switchMap(() =>
        this.api.publishRecipeVersion(
          this.productId,
          this.versionId,
          this.effectiveFrom(),
        ),
      ),
    ).subscribe({
      next: (version) => {
        this.version.set(version);
        this.saving.set(false);
      },
      error: () => {
        this.error.set('No se pudo publicar. Comprueba que haya ingredientes válidos y que la fecha no sea retroactiva ni se solape.');
        this.saving.set(false);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      product: this.api.product(this.productId),
      version: this.api.recipeVersion(this.productId, this.versionId),
      units: this.api.measurementUnits(),
      firstPage: this.api.materials({
        page: 1,
        pageSize: 100,
        isActive: true,
      }),
    }).subscribe({
      next: ({ product, version, units, firstPage }) => {
        const additionalPages = Array.from(
          { length: Math.max(0, firstPage.totalPages - 1) },
          (_unused, index) =>
            this.api.materials({
              page: index + 2,
              pageSize: 100,
              isActive: true,
            }),
        );
        const loadAdditional = additionalPages.length
          ? forkJoin(additionalPages)
          : forkJoin([]);
        loadAdditional.subscribe({
          next: (pages) => {
            this.product.set(product);
            this.version.set(version);
            this.units.set(units);
            const existingMaterials = version.materials.map((line): Material => ({
              ...line.material,
              densityGramPerMl: null,
              currentPrice: null,
            }));
            const selectedMaterials = new Map([
              ...existingMaterials,
              ...firstPage.items,
              ...pages.flatMap((page) => page.items),
            ].map((material) => [material.id, material]));
            this.materials.set([
              ...selectedMaterials.values(),
            ]);
            this.form.patchValue({
              outputQuantity: version.outputQuantity,
              outputUnitId: version.outputUnit.id,
              preparationNotes: version.preparationNotes ?? '',
            });
            for (const line of version.materials) {
              this.lines.push(
                this.createLine({
                  materialId: line.materialId,
                  quantity: line.quantity,
                  unitId: line.unit.id,
                  notes: line.notes ?? '',
                }),
              );
            }
            if (!this.editable()) this.form.disable({ emitEvent: false });
            this.loading.set(false);
          },
          error: () => {
            this.error.set('No se pudieron cargar todas las materias primas.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('No se pudo cargar el producto o la versión de receta.');
        this.loading.set(false);
      },
    });
  }

  private createLine(value?: {
    materialId: string;
    quantity: string;
    unitId: string;
    notes: string;
  }): FormGroup<RecipeLineControls> {
    return this.formBuilder.nonNullable.group({
      materialId: [value?.materialId ?? '', Validators.required],
      quantity: [
        value?.quantity ?? '',
        [Validators.required, Validators.pattern(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/)],
      ],
      unitId: [value?.unitId ?? '', Validators.required],
      notes: [value?.notes ?? '', Validators.maxLength(500)],
    });
  }
}
