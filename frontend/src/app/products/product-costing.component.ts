import { Component, OnInit, WritableSignal, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import {
  CostCalculation,
  PriceScenario,
  Product,
  RecipeVersionSummary,
} from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    RouterLink,
  ],
  selector: 'app-product-costing',
  template: `
    <main class="page">
      <a class="back" [routerLink]="['/products', productId]">← Volver al producto</a>
      @if (loading()) {
        <p class="panel">Cargando historial de costes…</p>
      } @else if (error() && !product()) {
        <nz-alert nzType="error" [nzMessage]="error()" nzShowIcon />
      } @else if (product(); as data) {
        <header class="heading">
          <div><p class="eyebrow">COSTES Y RENTABILIDAD</p><h1>{{ data.name }}</h1><p>Unidad comercial: {{ data.salesUnit.name }} ({{ data.salesUnit.code }})</p></div>
        </header>
        @if (canEdit) {
          <section class="panel">
            <h2>Nuevo cálculo histórico</h2>
            <p>Se usa una versión publicada y los precios, tarifas y gastos vigentes en la fecha elegida.</p>
            <button nz-button nzType="primary" type="button" (click)="calculationModal.set(true)">Nuevo cálculo histórico</button>
          </section>
        } @else {
          <nz-alert nzType="info" nzMessage="Tu rol permite consultar los costes, pero no ejecutar cálculos." nzShowIcon />
        }

        @if (error()) { <nz-alert class="block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
        <section class="panel">
          <h2>Historial de costes</h2>
          @if (!calculations().length) { <p>No hay cálculos guardados para este producto.</p> }
          @else {
            <div class="table-wrap"><nz-table [nzData]="calculations()" [nzFrontPagination]="false" [nzShowPagination]="false">
              <thead><tr><th>Fecha</th><th>Versión</th><th>Estado</th><th>Coste del lote</th><th>Coste por unidad</th><th></th></tr></thead>
              <tbody>@for (calculation of calculations(); track calculation.id) {
                <tr><td>{{ calculation.valuationDate }}</td><td>{{ versionLabel(calculation.recipeVersionId) }}</td>
                  <td>{{ statusLabel(calculation.status) }}</td>
                  <td>{{ currency(calculation.totalProductionCostCUP) }}</td>
                  <td>{{ currency(calculation.unitCostCUP) }}</td>
                  <td><button nz-button nzType="link" type="button" (click)="selectCalculation(calculation.id)">Ver detalle</button></td></tr>
              }</tbody>
            </nz-table></div>
          }
        </section>

        @if (selectedCalculation(); as calculation) {
          <section class="panel">
            <h2>Detalle · {{ calculation.valuationDate }} · {{ statusLabel(calculation.status) }}</h2>
            <div class="metrics">
              <p>Materiales <strong>{{ currency(calculation.materialCostCUP) }}</strong></p>
              <p>Mano de obra <strong>{{ currency(calculation.laborCostCUP) }}</strong></p>
              <p>Gastos indirectos <strong>{{ currency(calculation.overheadCostCUP) }}</strong></p>
              <p>Total del lote <strong>{{ currency(calculation.totalProductionCostCUP) }}</strong></p>
              <p>Salida vendible <strong>{{ calculation.outputQuantity ?? '—' }} {{ calculation.outputUnitSnapshot ?? '' }}</strong></p>
              <p>Coste por unidad <strong>{{ currency(calculation.unitCostCUP) }}</strong></p>
            </div>
            @if (calculation.incompleteReasons.length) {
              <nz-alert nzType="warning" nzMessage="El cálculo está incompleto" nzShowIcon>
                <ul>@for (reason of calculation.incompleteReasons; track reason.code) { <li>{{ reason.message }}</li> }</ul>
              </nz-alert>
            }
            @if (calculation.lines?.length) {
              <div class="table-wrap"><nz-table [nzData]="calculation.lines!" [nzFrontPagination]="false" [nzShowPagination]="false">
                <thead><tr><th>Tipo</th><th>Concepto (snapshot)</th><th>Cantidad</th><th>Unidad</th><th>Importe CUP</th></tr></thead>
                <tbody>@for (line of calculation.lines; track line.id) {
                  <tr><td>{{ line.lineType }}</td><td>{{ line.descriptionSnapshot }}<details><summary>Snapshot de origen</summary><pre>{{ line.detailsSnapshot | json }}</pre></details></td><td>{{ line.quantity ?? '—' }}</td><td>{{ line.unitNameSnapshot ?? '—' }}</td><td>{{ currency(line.totalCUP) }}</td></tr>
                }</tbody>
              </nz-table></div>
            }
          </section>

          <section class="panel">
            <h2>Escenarios de precio</h2>
            @if (canEdit) {
              <button nz-button nzType="primary" type="button" (click)="scenarioModal.set(true)">Crear escenario de precio</button>
            }
            @if (scenarios().length) {
              <div class="table-wrap"><nz-table [nzData]="scenarios()" [nzFrontPagination]="false" [nzShowPagination]="false">
                <thead><tr><th>Escenario</th><th>Estado</th><th>Precio</th><th>Venta neta</th><th>Beneficio final</th><th></th></tr></thead>
                <tbody>@for (scenario of scenarios(); track scenario.id) {
                  <tr><td>{{ scenario.name }}</td><td>{{ scenario.status }}</td><td>{{ currency(scenario.salePriceCUP) }}</td><td>{{ currency(scenario.netSalesCUP) }}</td><td>{{ currency(scenario.profitAfterTaxCUP) }}</td>
                    <td><button nz-button nzType="link" type="button" (click)="selectScenario(scenario.id)">Detalle</button></td></tr>
                }</tbody>
              </nz-table></div>
            } @else { <p>Aún no hay escenarios para este cálculo.</p> }
          </section>
        }

        @if (selectedScenario(); as scenario) {
          <section class="panel">
            <h2>{{ scenario.name }} · {{ scenario.status }}</h2>
            @if (scenario.taxLines.some(isPendingTax)) {
              <nz-alert nzType="warning" nzMessage="Supuesto fiscal no validado; no es una liquidación tributaria oficial." nzShowIcon />
            }
            @if (scenario.calculationSnapshot?.incompleteReasons?.length) {
              <ul>@for (reason of scenario.calculationSnapshot?.incompleteReasons; track reason.code) { <li>{{ reason.message }}</li> }</ul>
            }
            @for (warning of scenario.calculationSnapshot?.warnings ?? []; track warning) {
              <nz-alert class="block" nzType="warning" [nzMessage]="warning" nzShowIcon />
            }
            <div class="metrics">
              <p>Ventas brutas <strong>{{ currency(scenario.grossSalesCUP) }}</strong></p>
              <p>Ventas netas sin impuesto de venta <strong>{{ currency(scenario.netSalesCUP) }}</strong></p>
              @if (scenario.salePriceTaxTreatment === 'NOT_CONFIGURED') {
                <p>Ingreso antes de impuestos estimado <strong>{{ currency(scenario.calculationSnapshot?.preTaxRevenueEstimateCUP ?? null) }}</strong></p>
              }
              <p>Impuesto sobre ventas <strong>{{ currency(scenario.salesTaxCUP) }}</strong></p>
              <p>Coste de ventas <strong>{{ currency(scenario.costOfSalesCUP) }}</strong></p>
              <p>Otros gastos adicionales <strong>{{ currency(scenario.otherOperatingExpensesCUP) }}</strong></p>
              <p>Beneficio antes de impuesto sobre utilidad <strong>{{ currency(scenario.profitBeforeProfitTaxCUP) }}</strong></p>
              <p>Impuesto estimado sobre utilidad <strong>{{ currency(scenario.profitTaxCUP) }}</strong></p>
              <p>Beneficio final <strong>{{ currency(scenario.profitAfterTaxCUP) }}</strong></p>
              <p>Margen neto (%) <strong>{{ scenario.netMarginPercent ?? 'No calculable' }}</strong></p>
              <p>Total estimado al cliente <strong>{{ currency(scenario.calculationSnapshot?.customerTotalCUP ?? null) }}</strong></p>
              <p>Precio de equilibrio por unidad <strong>{{ currency(scenario.calculationSnapshot?.breakEvenPriceCUP ?? null) }}</strong></p>
              <p>Precio recomendado <strong>{{ currency(scenario.calculationSnapshot?.recommendedPriceCUP ?? null) }}</strong></p>
            </div>
            @if (scenario.taxLines.length) {
              <h3>Tributos incluidos en este escenario</h3>
              <div class="table-wrap"><nz-table [nzData]="scenario.taxLines" [nzFrontPagination]="false" [nzShowPagination]="false">
                <thead><tr><th>Regla snapshot</th><th>Base</th><th>Tasa</th><th>Importe</th><th>Validación</th></tr></thead>
                <tbody>@for (line of scenario.taxLines; track line.id) { <tr><td>{{ line.taxNameSnapshot }}</td><td>{{ line.taxBaseSnapshot }}</td><td>{{ line.rateApplied ?? '—' }}</td><td>{{ currency(line.taxAmountCUP) }}</td><td>{{ line.verificationStatusSnapshot }}</td></tr> }</tbody>
              </nz-table></div>
            }
          </section>
        }
      }
    </main>
    <nz-modal nzTitle="Calcular coste histórico" [nzVisible]="calculationModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="680">
      <ng-container *nzModalContent>
        <form #calculationForm="ngForm" class="form-grid" (ngSubmit)="calculate()">
          <label>Fecha de valoración<input nz-input name="valuationDate" type="date" [(ngModel)]="valuationDate" required></label>
          <label>Versión publicada (opcional)
            <nz-select name="recipeVersionId" [(ngModel)]="recipeVersionId" nzAllowClear nzPlaceHolder="Elegir la vigente para la fecha">
              @for (version of publishedVersions(); track version.id) {
                <nz-option [nzValue]="version.id" [nzLabel]="'v' + version.versionNumber + ' · ' + (version.effectiveFrom || 'sin fecha')"></nz-option>
              }
            </nz-select>
          </label>
          @if (error()) { <nz-alert class="block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <div class="actions"><button nz-button nzType="primary" type="submit" [disabled]="saving() || calculationForm.invalid">{{ saving() ? 'Calculando…' : 'Calcular y guardar' }}</button><button nz-button type="button" [disabled]="saving()" (click)="closeCalculationModal(calculationForm)">Cancelar</button></div>
        </form>
      </ng-container>
    </nz-modal>
    <nz-modal nzTitle="Crear escenario de precio" [nzVisible]="scenarioModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="760">
      <ng-container *nzModalContent>
        <form #scenarioForm="ngForm" class="form-grid" (ngSubmit)="createScenario()">
          <label>Nombre<input nz-input name="scenarioName" [(ngModel)]="scenarioName" maxlength="180" required></label>
          <label>Precio por unidad (CUP)<input nz-input name="salePrice" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="salePrice" required></label>
          <label>Volumen proyectado<input nz-input name="projectedQuantity" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="projectedQuantity" required></label>
          <label>Tratamiento del precio
            <nz-select name="taxTreatment" [(ngModel)]="taxTreatment" required>
              <nz-option nzValue="TAX_EXCLUDED_FROM_PRICE" nzLabel="Impuesto excluido"></nz-option>
              <nz-option nzValue="TAX_INCLUDED_IN_PRICE" nzLabel="Impuesto incluido"></nz-option>
              <nz-option nzValue="NOT_CONFIGURED" nzLabel="No configurado"></nz-option>
            </nz-select>
          </label>
          <label>Descuentos y devoluciones (CUP)<input nz-input name="discounts" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="discounts"></label>
          <label>Otros gastos adicionales (CUP)<input nz-input name="otherExpenses" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="otherExpenses"></label>
          <label>Margen neto objetivo (%)<input nz-input name="targetMargin" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="targetMargin"></label>
          @if (error()) { <nz-alert class="block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <div class="actions"><button nz-button nzType="primary" type="submit" [disabled]="savingScenario() || scenarioForm.invalid">{{ savingScenario() ? 'Calculando…' : 'Guardar escenario' }}</button><button nz-button type="button" [disabled]="savingScenario()" (click)="closeScenarioModal(scenarioForm)">Cancelar</button></div>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 80rem); margin: 2.5rem auto 3rem; }
    .back { color: #28643a; font-weight: 700; text-decoration: none; }
    .heading { margin: 1.3rem 0; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .35rem 0; color: #263c2a; font: 500 clamp(2rem, 5vw, 2.7rem)/1.1 Georgia, serif; }
    h2 { color: #263c2a; font: 500 1.4rem Georgia, serif; }
    .panel { margin: 1rem 0; padding: clamp(1rem, 3vw, 1.5rem); background: white; border: 1px solid #e4e6df; border-radius: .8rem; }
    .form-grid, .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .9rem; align-items: end; }
    .scenario-form { margin-top: 1rem; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .85rem; font-weight: 650; }
    .metrics p { padding: .8rem; border-radius: .5rem; background: #f5f7f3; color: #657067; }
    .metrics strong { display: block; margin-top: .4rem; color: #263c2a; }
    .table-wrap { overflow-x: auto; margin-top: 1rem; }
    table { width: 100%; text-align: left; }
    .block { display: block; margin: .7rem 0; }
    @media(max-width: 720px) { .form-grid, .metrics { grid-template-columns: 1fr; } }
  `],
})
export class ProductCostingComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionStore);
  readonly productId = this.route.snapshot.paramMap.get('productId') ?? '';
  readonly product = signal<Product | null>(null);
  readonly versions = signal<RecipeVersionSummary[]>([]);
  readonly calculations = signal<CostCalculation[]>([]);
  readonly selectedCalculation = signal<CostCalculation | null>(null);
  readonly scenarios = signal<PriceScenario[]>([]);
  readonly selectedScenario = signal<PriceScenario | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingScenario = signal(false);
  readonly error = signal('');
  readonly calculationModal = signal(false);
  readonly scenarioModal = signal(false);
  readonly canEdit = this.session.bakeries().some(
    (bakery) => bakery.id === this.session.activeBakeryId() &&
      (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'),
  );
  valuationDate = new Date().toISOString().slice(0, 10);
  recipeVersionId = '';
  scenarioName = '';
  salePrice = '';
  projectedQuantity = '1';
  taxTreatment = 'NOT_CONFIGURED';
  discounts = '0';
  otherExpenses = '0';
  targetMargin = '';

  ngOnInit(): void {
    forkJoin({
      product: this.api.product(this.productId),
      versions: this.api.recipeVersions(this.productId),
      calculations: this.api.costCalculations(this.productId),
    }).subscribe({
      next: ({ product, versions, calculations }) => {
        this.product.set(product);
        this.versions.set(versions);
        this.calculations.set(calculations);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error, 'No se pudieron cargar los costes del producto.'));
        this.loading.set(false);
      },
    });
  }

  publishedVersions(): RecipeVersionSummary[] {
    return this.versions().filter((version) => version.status === 'PUBLISHED');
  }

  versionLabel(id: string): string {
    const version = this.versions().find((item) => item.id === id);
    return version ? `v${version.versionNumber}` : '—';
  }

  statusLabel(status: CostCalculation['status']): string {
    return status === 'COMPLETE' ? 'Completo' : status === 'FAILED' ? 'Fallido' : 'Incompleto';
  }

  currency(value: string | null): string {
    return value === null ? 'No calculable' : `${value} CUP`;
  }

  isPendingTax(line: PriceScenario['taxLines'][number]): boolean {
    return line.verificationStatusSnapshot === 'PENDING_VALIDATION';
  }

  calculate(): void {
    if (!this.canEdit || this.saving() || !this.valuationDate) return;
    this.saving.set(true);
    this.error.set('');
    this.api.calculateCost(this.productId, this.valuationDate, this.recipeVersionId || undefined).subscribe({
      next: (calculation) => {
        this.selectedCalculation.set(calculation);
        this.selectedScenario.set(null);
        this.calculations.update((items) => [calculation, ...items]);
        this.scenarios.set([]);
        this.calculationModal.set(false);
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error, 'No se pudo guardar el cálculo de coste.'));
        this.saving.set(false);
      },
    });
  }

  selectCalculation(id: string): void {
    this.error.set('');
    forkJoin({
      calculation: this.api.costCalculation(id),
      scenarios: this.api.priceScenarios(id),
    }).subscribe({
      next: ({ calculation, scenarios }) => {
        this.selectedCalculation.set(calculation);
        this.selectedScenario.set(null);
        this.scenarios.set(scenarios);
      },
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudo cargar el detalle del cálculo.')),
    });
  }

  createScenario(): void {
    const calculation = this.selectedCalculation();
    if (!calculation || !this.canEdit || this.savingScenario() || !this.scenarioName.trim() || !this.salePrice || !this.projectedQuantity) return;
    this.savingScenario.set(true);
    this.error.set('');
    this.api.createPriceScenario(calculation.id, {
      name: this.scenarioName,
      salePriceCUP: this.salePrice,
      projectedQuantity: this.projectedQuantity,
      salePriceTaxTreatment: this.taxTreatment,
      discountsReturnsCUP: this.discounts || '0',
      otherOperatingExpensesCUP: this.otherExpenses || '0',
      ...(this.targetMargin ? { targetNetMarginPercent: this.targetMargin } : {}),
    }).subscribe({
      next: (scenario) => {
        this.scenarios.update((items) => [scenario, ...items]);
        this.selectedScenario.set(scenario);
        this.scenarioModal.set(false);
        this.resetScenarioForm();
        this.savingScenario.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error, 'No se pudo guardar el escenario.'));
        this.savingScenario.set(false);
      },
    });
  }

  private closeModal(form: NgForm, modal: WritableSignal<boolean>): boolean {
    if (form.dirty && !globalThis.confirm('¿Descartar los cambios del formulario?')) return false;
    modal.set(false);
    return true;
  }

  closeCalculationModal(form: NgForm): void {
    if (!this.closeModal(form, this.calculationModal)) return;
    this.valuationDate = new Date().toISOString().slice(0, 10);
    this.recipeVersionId = '';
  }

  closeScenarioModal(form: NgForm): void {
    if (this.closeModal(form, this.scenarioModal)) this.resetScenarioForm();
  }

  private resetScenarioForm(): void {
    this.scenarioName = '';
    this.salePrice = '';
    this.projectedQuantity = '1';
    this.taxTreatment = 'NOT_CONFIGURED';
    this.discounts = '0';
    this.otherExpenses = '0';
    this.targetMargin = '';
  }

  selectScenario(id: string): void {
    this.api.priceScenario(id).subscribe({
      next: (scenario) => this.selectedScenario.set(scenario),
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudo cargar el escenario.')),
    });
  }
}
