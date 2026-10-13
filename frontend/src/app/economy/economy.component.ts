import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import {
  LaborRate,
  LaborRole,
  OverheadExpense,
  TaxAssignment,
  TaxRule,
} from '../core/api.models';
import { apiErrorMessage } from '../core/api-error-message';
import { SessionStore } from '../core/session-store.service';

@Component({
  standalone: true,
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzInputModule, NzModalModule, NzSelectModule, NzTableModule],
  selector: 'app-economy',
  template: `
    <main class="page">
      <header><p class="eyebrow">CONFIGURACIÓN DE COSTES</p><h1>Mano de obra y gastos indirectos</h1><p>Configura tarifas y bases de reparto por panadería; cada coste conserva sus datos históricos al calcularse.</p></header>
      @if (error()) { <nz-alert class="block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
      @if (notice()) { <nz-alert class="block" nzType="success" [nzMessage]="notice()" nzShowIcon /> }

      <section class="panel">
        <h2>Puestos y tarifas por hora</h2>
        @if (canEdit) {
          <button nz-button nzType="primary" type="button" (click)="roleModal.set(true)">Agregar puesto laboral</button>
        }
        @if (roles().length) {
          <div class="table-wrap"><nz-table [nzData]="roles()" [nzFrontPagination]="false" [nzShowPagination]="false">
            <thead><tr><th>Puesto</th><th>Estado</th><th>Tarifa actual informativa</th><th>Historial de tarifas</th><th></th></tr></thead>
            <tbody>@for (role of roles(); track role.id) {
              <tr><td><input nz-input [value]="role.name" [readonly]="!canEdit" (change)="renameRole(role.id, $event)"></td>
                <td>{{ role.isActive ? 'Activo' : 'Inactivo' }}</td>
                <td>{{ role.currentRate ? role.currentRate + ' CUP/h' : 'Sin tarifa vigente' }}</td>
                <td><button nz-button nzType="link" type="button" (click)="showRates(role.id)">Ver tarifas</button></td>
                <td>@if (canEdit) { <button nz-button nzType="link" type="button" (click)="toggleRole(role)">{{ role.isActive ? 'Desactivar' : 'Activar' }}</button> }</td></tr>
            }</tbody>
          </nz-table></div>
        } @else { <p>No hay puestos laborales configurados.</p> }
        @if (selectedRoleId()) {
          <h3>Historial de tarifas</h3>
          @if (canEdit) {
            <button nz-button nzType="primary" type="button" (click)="rateModal.set(true)">Agregar tarifa</button>
          }
          @if (rates().length) {
            <div class="table-wrap"><nz-table [nzData]="rates()" [nzFrontPagination]="false" [nzShowPagination]="false">
              <thead><tr><th>Tarifa</th><th>Desde</th><th>Hasta</th><th>Nota</th></tr></thead>
              <tbody>@for (rate of rates(); track rate.id) { <tr><td>{{ rate.hourlyRateCUP }} CUP/h</td><td>{{ rate.effectiveFrom }}</td><td>{{ rate.effectiveTo || 'Abierta' }}</td><td>{{ rate.notes || '—' }}</td></tr> }</tbody>
            </nz-table></div>
          } @else { <p>No hay tarifas registradas.</p> }
        }
      </section>

      <section class="panel">
        <h2>Gastos indirectos</h2>
        <p>DIRECT_COST_PROPORTION usa la base como coste directo total previsto del período en CUP. No se trata de un porcentaje.</p>
        <div class="filters">
          <label>Filtrar por categoría<nz-select [(ngModel)]="expenseCategory">
            <nz-option nzValue="" nzLabel="Todas"></nz-option>
            @for (category of categories; track category) { <nz-option [nzValue]="category" [nzLabel]="categoryLabel(category)"></nz-option> }
          </nz-select></label>
          <label>Filtrar gastos vigentes en<input nz-input type="date" [(ngModel)]="expenseAsOf"></label>
          <button nz-button type="button" (click)="filterExpenses()">Aplicar filtros</button>
        </div>
        @if (canEdit) {
          <button nz-button nzType="primary" type="button" (click)="openNewExpense()">Agregar gasto indirecto</button>
        }
        @if (expenses().length) {
          <div class="table-wrap"><nz-table [nzData]="expenses()" [nzFrontPagination]="false" [nzShowPagination]="false">
            <thead><tr><th>Gasto</th><th>Período</th><th>Importe</th><th>Reparto/base</th><th></th></tr></thead>
            <tbody>@for (expense of expenses(); track expense.id) {
              <tr><td>{{ expense.name }} · {{ categoryLabel(expense.category) }}</td><td>{{ expense.periodStart }} – {{ expense.periodEnd }}</td>
                <td>{{ expense.amountCUP }} CUP</td><td>{{ methodLabel(expense.allocationMethod) }} · {{ expense.allocationBaseQuantity }} {{ expense.allocationUnit?.code || '' }}</td>
                <td>@if (canEdit) { <button nz-button nzType="link" type="button" (click)="editExpense(expense)">Editar</button> }</td></tr>
            }</tbody>
          </nz-table></div>
        } @else { <p>No hay gastos indirectos registrados.</p> }
      </section>

      <section class="panel">
        <h2>Supuestos fiscales para escenarios</h2>
        <nz-alert nzType="warning" nzMessage="Supuesto fiscal no validado; no es una liquidación tributaria oficial." nzShowIcon />
        @if (canAdmin) {
          <button nz-button nzType="primary" type="button" (click)="taxModal.set(true)">Asignar regla fiscal</button>
        } @else if (!canEdit) {
          <p>Las reglas pendientes se usan solo cuando un administrador las asigna y habilita.</p>
        }
        @if (assignments().length) {
          <div class="table-wrap"><nz-table [nzData]="assignments()" [nzFrontPagination]="false" [nzShowPagination]="false">
            <thead><tr><th>Regla</th><th>Base</th><th>Tasa</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead>
            <tbody>@for (assignment of assignments(); track assignment.id) {
              <tr><td>{{ assignment.taxRule.name }} · v{{ assignment.taxRuleVersion.versionNumber }}</td><td>{{ assignment.taxRuleVersion.taxBase }}</td><td>{{ assignment.taxRuleVersion.rate || '—' }}</td>
                <td>{{ assignment.effectiveFrom || 'Sin inicio' }} – {{ assignment.effectiveTo || 'Abierta' }}</td><td>{{ assignment.enabled ? 'Habilitada' : 'Deshabilitada' }} · {{ assignment.taxRuleVersion.verificationStatus }}</td>
                <td>@if (canAdmin) { <button nz-button nzType="link" type="button" (click)="toggleAssignment(assignment)">{{ assignment.enabled ? 'Deshabilitar' : 'Habilitar' }}</button> }</td></tr>
            }</tbody>
          </nz-table></div>
        } @else { <p>No hay reglas fiscales asignadas a esta panadería.</p> }
      </section>
    </main>
    <nz-modal nzTitle="Agregar puesto laboral" [nzVisible]="roleModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="560">
      <ng-container *nzModalContent>
        <form #roleForm="ngForm" class="form-grid" (ngSubmit)="createRole()">
          <label>Nombre del puesto<input nz-input name="roleName" [(ngModel)]="roleName" maxlength="140" required></label>
          @if (error()) { <nz-alert class="wide" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <div class="actions"><button nz-button nzType="primary" type="submit" [disabled]="busy() || roleForm.invalid">{{ busy() ? 'Guardando…' : 'Crear puesto' }}</button><button nz-button type="button" [disabled]="busy()" (click)="closeRoleModal(roleForm)">Cancelar</button></div>
        </form>
      </ng-container>
    </nz-modal>
    <nz-modal nzTitle="Agregar tarifa laboral" [nzVisible]="rateModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="680">
      <ng-container *nzModalContent>
        <form #rateForm="ngForm" class="form-grid" (ngSubmit)="createRate()">
          <label>Tarifa por hora (CUP)<input nz-input name="rateValue" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="rateValue" required></label>
          <label>Vigente desde<input nz-input name="rateFrom" type="date" [(ngModel)]="rateFrom" required></label>
          <label>Vigente hasta (opcional)<input nz-input name="rateTo" type="date" [(ngModel)]="rateTo"></label>
          <label>Nota<input nz-input name="rateNotes" [(ngModel)]="rateNotes" maxlength="500"></label>
          @if (error()) { <nz-alert class="wide" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <div class="actions"><button nz-button nzType="primary" type="submit" [disabled]="busy() || rateForm.invalid">{{ busy() ? 'Guardando…' : 'Guardar tarifa' }}</button><button nz-button type="button" [disabled]="busy()" (click)="closeRateModal(rateForm)">Cancelar</button></div>
        </form>
      </ng-container>
    </nz-modal>
    <nz-modal [nzTitle]="editingExpenseId ? 'Editar gasto indirecto' : 'Agregar gasto indirecto'" [nzVisible]="overheadModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="760">
      <ng-container *nzModalContent>
        <form #expenseForm="ngForm" class="form-grid" (ngSubmit)="saveOverhead()">
          <label>Nombre<input nz-input name="overheadName" [(ngModel)]="overhead.name" maxlength="180" required></label>
          <label>Categoría<nz-select name="overheadCategory" [(ngModel)]="overhead.category" required>
            @for (category of categories; track category) { <nz-option [nzValue]="category" [nzLabel]="categoryLabel(category)"></nz-option> }
          </nz-select></label>
          <label>Importe CUP<input nz-input name="amountCUP" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="overhead.amountCUP" required></label>
          <label>Inicio del período<input nz-input name="periodStart" type="date" [(ngModel)]="overhead.periodStart" required></label>
          <label>Fin del período<input nz-input name="periodEnd" type="date" [(ngModel)]="overhead.periodEnd" required></label>
          <label>Método<nz-select name="allocationMethod" [(ngModel)]="overhead.allocationMethod" required>
            @for (method of methods; track method) { <nz-option [nzValue]="method" [nzLabel]="methodLabel(method)"></nz-option> }
          </nz-select></label>
          @if (overhead.allocationMethod !== 'BATCHES' && overhead.allocationMethod !== 'DIRECT_COST_PROPORTION') {
            <label>Unidad de reparto<nz-select name="allocationUnitId" [(ngModel)]="overhead.allocationUnitId" [required]="true" nzAllowClear>
              @for (unit of unitsForMethod(); track unit.id) { <nz-option [nzValue]="unit.id" [nzLabel]="unit.name + ' (' + unit.code + ')'"></nz-option> }
            </nz-select></label>
          }
          <label>{{ baseLabel() }}<input nz-input name="allocationBaseQuantity" inputmode="decimal" pattern="^[0-9]+(\\.[0-9]+)?$" [(ngModel)]="overhead.allocationBaseQuantity" required></label>
          <label class="wide">Notas<input nz-input name="overheadNotes" [(ngModel)]="overhead.notes"></label>
          @if (error()) { <nz-alert class="wide" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <div class="actions"><button nz-button nzType="primary" type="submit" [disabled]="busy() || expenseForm.invalid">{{ busy() ? 'Guardando…' : (editingExpenseId ? 'Guardar cambios' : 'Añadir gasto') }}</button><button nz-button type="button" [disabled]="busy()" (click)="closeExpense(expenseForm)">Cancelar</button></div>
        </form>
      </ng-container>
    </nz-modal>
    <nz-modal nzTitle="Asignar regla fiscal" [nzVisible]="taxModal()" [nzFooter]="null" [nzClosable]="false" [nzMaskClosable]="false" [nzKeyboard]="false" [nzWidth]="680">
      <ng-container *nzModalContent>
        <form #taxForm="ngForm" class="form-grid" (ngSubmit)="assignTaxRule()">
          <label>Regla y versión<nz-select name="taxVersionId" [(ngModel)]="taxVersionId" required>
            @for (version of taxVersions(); track version.id) { <nz-option [nzValue]="version.id" [nzLabel]="version.ruleName + ' · v' + version.versionNumber + ' · ' + (version.rate || '—') + ' · ' + version.verificationStatus"></nz-option> }
          </nz-select></label>
          <label>Vigente desde<input nz-input name="taxFrom" type="date" [(ngModel)]="taxFrom"></label>
          <label>Vigente hasta (opcional)<input nz-input name="taxTo" type="date" [(ngModel)]="taxTo"></label>
          <label>Nota de configuración<input nz-input name="taxNotes" [(ngModel)]="taxNotes"></label>
          <label class="checkbox"><input type="checkbox" name="taxEnabled" [(ngModel)]="taxEnabled"> Habilitar explícitamente para simulaciones</label>
          @if (error()) { <nz-alert class="wide" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <div class="actions"><button nz-button nzType="primary" type="submit" [disabled]="busy() || taxForm.invalid">{{ busy() ? 'Guardando…' : 'Asignar regla' }}</button><button nz-button type="button" [disabled]="busy()" (click)="closeTaxModal(taxForm)">Cancelar</button></div>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .page { width: min(100% - 2rem, 80rem); margin: 2.5rem auto 3rem; }
    header { margin-bottom: 1.3rem; }
    .eyebrow { color: #43814f; font-size: .72rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .35rem 0; color: #263c2a; font: 500 clamp(2rem, 5vw, 2.7rem)/1.1 Georgia, serif; }
    h2 { color: #263c2a; font: 500 1.4rem Georgia, serif; }
    .panel { margin: 1rem 0; padding: clamp(1rem, 3vw, 1.5rem); background: white; border: 1px solid #e4e6df; border-radius: .8rem; }
    .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .9rem; align-items: end; margin: 1rem 0; }
    label { display: grid; gap: .35rem; color: #4c5b50; font-size: .85rem; font-weight: 650; }
    .wide { grid-column: 1 / -1; }
    .checkbox { display: flex; align-items: center; gap: .5rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .filters { display: flex; flex-wrap: wrap; align-items: end; gap: .8rem; margin: 1rem 0; }
    .filters label { min-width: 14rem; }
    .table-wrap { overflow-x: auto; margin-top: 1rem; }
    .block { display: block; margin: .7rem 0; }
    @media(max-width: 720px) { .form-grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
  `],
})
export class EconomyComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  readonly roles = signal<LaborRole[]>([]);
  readonly rates = signal<LaborRate[]>([]);
  readonly expenses = signal<OverheadExpense[]>([]);
  readonly units = signal<{ id: string; code: string; name: string; dimension: string }[]>([]);
  readonly rules = signal<TaxRule[]>([]);
  readonly assignments = signal<TaxAssignment[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly roleModal = signal(false);
  readonly rateModal = signal(false);
  readonly overheadModal = signal(false);
  readonly taxModal = signal(false);
  readonly canEdit = this.session.bakeries().some((bakery) =>
    bakery.id === this.session.activeBakeryId() && (bakery.role === 'ADMIN' || bakery.role === 'EDITOR'));
  readonly canAdmin = this.session.bakeries().some((bakery) =>
    bakery.id === this.session.activeBakeryId() && bakery.role === 'ADMIN');
  readonly categories = ['ELECTRICITY', 'WATER', 'FUEL', 'RENT', 'MAINTENANCE', 'DEPRECIATION', 'TRANSPORT', 'TELECOMMUNICATIONS', 'OTHER'];
  readonly methods = ['LABOR_HOURS', 'BATCHES', 'OUTPUT_QUANTITY', 'DIRECT_COST_PROPORTION'];
  roleName = '';
  selectedRoleId = signal('');
  rateValue = '';
  rateFrom = new Date().toISOString().slice(0, 10);
  rateTo = '';
  rateNotes = '';
  editingExpenseId = '';
  overhead = this.emptyOverhead();
  taxVersionId = '';
  taxFrom = '';
  taxTo = '';
  taxNotes = '';
  taxEnabled = true;
  expenseCategory = '';
  expenseAsOf = '';

  ngOnInit(): void {
    this.load();
  }

  taxVersions() {
    return this.rules().flatMap((rule) => rule.versions.map((version) => ({
      ...version,
      ruleName: rule.name,
    })));
  }

  unitsForMethod() {
    const dimension = this.overhead.allocationMethod === 'LABOR_HOURS' ? 'TIME' : null;
    return this.units().filter((unit) => dimension === null || unit.dimension === dimension);
  }

  baseLabel() {
    switch (this.overhead.allocationMethod) {
      case 'LABOR_HOURS': return 'Horas de mano de obra previstas para el período';
      case 'BATCHES': return 'Número total de lotes previstos para el período';
      case 'OUTPUT_QUANTITY': return 'Producción total prevista para el período';
      case 'DIRECT_COST_PROPORTION': return 'Coste directo total previsto para el período (CUP)';
      default: return 'Base prevista para el período';
    }
  }

  methodLabel(method: string) {
    return {
      LABOR_HOURS: 'Horas de mano de obra',
      BATCHES: 'Número de lotes',
      OUTPUT_QUANTITY: 'Cantidad de producción',
      DIRECT_COST_PROPORTION: 'Proporción del coste directo',
    }[method] ?? method;
  }

  categoryLabel(category: string) {
    return {
      ELECTRICITY: 'Electricidad', WATER: 'Agua', FUEL: 'Combustible',
      RENT: 'Alquiler', MAINTENANCE: 'Mantenimiento', DEPRECIATION: 'Depreciación',
      TRANSPORT: 'Transporte', TELECOMMUNICATIONS: 'Telecomunicaciones', OTHER: 'Otro',
    }[category] ?? category;
  }

  createRole() {
    this.run(this.api.createLaborRole(this.roleName), 'Puesto creado.', () => {
      this.roleName = '';
      this.roleModal.set(false);
      this.refreshRoles();
    });
  }

  renameRole(id: string, event: Event) {
    const name = (event.target as HTMLInputElement).value.trim();
    if (name) this.run(this.api.updateLaborRole(id, { name }), 'Puesto actualizado.', () => this.refreshRoles());
  }

  toggleRole(role: LaborRole) {
    this.run(this.api.updateLaborRole(role.id, { isActive: !role.isActive }), 'Estado del puesto actualizado.', () => this.refreshRoles());
  }

  showRates(id: string) {
    this.selectedRoleId.set(id);
    this.api.laborRates(id).subscribe({
      next: (rates) => this.rates.set(rates),
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudo cargar el historial de tarifas.')),
    });
  }

  createRate() {
    this.run(this.api.createLaborRate(this.selectedRoleId(), {
      hourlyRateCUP: this.rateValue,
      effectiveFrom: this.rateFrom,
      ...(this.rateTo ? { effectiveTo: this.rateTo } : {}),
      ...(this.rateNotes.trim() ? { notes: this.rateNotes.trim() } : {}),
    }), 'Tarifa añadida. El período anterior se cerró solo si era abierto y no había solapamiento.', () => {
      this.rateValue = ''; this.rateTo = ''; this.rateNotes = '';
      this.rateModal.set(false);
      this.showRates(this.selectedRoleId());
      this.refreshRoles();
    });
  }

  saveOverhead() {
    const request = {
      ...this.overhead,
      ...(this.overhead.allocationMethod === 'BATCHES' || this.overhead.allocationMethod === 'DIRECT_COST_PROPORTION'
        ? { allocationUnitId: null }
        : {}),
      notes: this.overhead.notes || null,
    };
    if (this.editingExpenseId) {
      this.run(this.api.updateOverheadExpense(this.editingExpenseId, request), 'Gasto indirecto actualizado.', () => {
        this.clearExpense(); this.refreshExpenses();
      });
    } else {
      this.run(this.api.createOverheadExpense(request), 'Gasto indirecto añadido.', () => {
        this.clearExpense(); this.refreshExpenses();
      });
    }
  }

  filterExpenses() {
    this.api.overheadExpenses({
      ...(this.expenseCategory ? { category: this.expenseCategory } : {}),
      ...(this.expenseAsOf ? { asOf: this.expenseAsOf } : {}),
    }).subscribe({
      next: (items) => this.expenses.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudieron filtrar los gastos indirectos.')),
    });
  }

  editExpense(expense: OverheadExpense) {
    this.editingExpenseId = expense.id;
    this.overhead = {
      name: expense.name,
      category: expense.category,
      amountCUP: expense.amountCUP,
      periodStart: expense.periodStart,
      periodEnd: expense.periodEnd,
      allocationMethod: expense.allocationMethod,
      allocationBaseQuantity: expense.allocationBaseQuantity ?? '',
      allocationUnitId: expense.allocationUnitId ?? '',
      notes: expense.notes ?? '',
    };
    this.overheadModal.set(true);
  }

  clearExpense() {
    this.editingExpenseId = '';
    this.overhead = this.emptyOverhead();
    this.overheadModal.set(false);
  }

  assignTaxRule() {
    this.run(this.api.createTaxAssignment({
      taxRuleVersionId: this.taxVersionId,
      enabled: this.taxEnabled,
      effectiveFrom: this.taxFrom || null,
      effectiveTo: this.taxTo || null,
      configurationNotes: this.taxNotes || null,
    }), 'Asignación fiscal guardada.', () => {
      this.taxVersionId = ''; this.taxFrom = ''; this.taxTo = ''; this.taxNotes = '';
      this.taxModal.set(false);
      this.refreshAssignments();
    });
  }

  openNewExpense() {
    this.editingExpenseId = '';
    this.overhead = this.emptyOverhead();
    this.overheadModal.set(true);
  }

  closeModal(form: NgForm, modal: ReturnType<typeof signal<boolean>>) {
    if (form.dirty && !globalThis.confirm('¿Descartar los cambios del formulario?')) return;
    modal.set(false);
  }

  closeRoleModal(form: NgForm) {
    this.closeModal(form, this.roleModal);
    if (!this.roleModal()) this.roleName = '';
  }

  closeRateModal(form: NgForm) {
    this.closeModal(form, this.rateModal);
    if (!this.rateModal()) {
      this.rateValue = '';
      this.rateFrom = new Date().toISOString().slice(0, 10);
      this.rateTo = '';
      this.rateNotes = '';
    }
  }

  closeTaxModal(form: NgForm) {
    this.closeModal(form, this.taxModal);
    if (!this.taxModal()) {
      this.taxVersionId = '';
      this.taxFrom = '';
      this.taxTo = '';
      this.taxNotes = '';
      this.taxEnabled = true;
    }
  }

  closeExpense(form: NgForm) {
    if (form.dirty && !globalThis.confirm('¿Descartar los cambios del formulario?')) return;
    this.clearExpense();
  }

  toggleAssignment(assignment: TaxAssignment) {
    this.run(this.api.updateTaxAssignment(assignment.id, { enabled: !assignment.enabled }),
      assignment.enabled ? 'Regla fiscal deshabilitada.' : 'Regla fiscal habilitada.',
      () => this.refreshAssignments());
  }

  private load() {
    forkJoin({
      roles: this.api.laborRoles(),
      expenses: this.api.overheadExpenses(),
      units: this.api.measurementUnits(),
      rules: this.api.taxRules(),
      assignments: this.api.taxAssignments(),
    }).subscribe({
      next: ({ roles, expenses, units, rules, assignments }) => {
        this.roles.set(roles);
        this.expenses.set(expenses);
        this.units.set(units);
        this.rules.set(rules);
        this.assignments.set(assignments);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(apiErrorMessage(error, 'No se pudo cargar la configuración de costes.'));
        this.loading.set(false);
      },
    });
  }

  private refreshRoles() {
    this.api.laborRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudo actualizar la lista de puestos.')),
    });
  }

  private refreshExpenses() {
    this.api.overheadExpenses().subscribe({
      next: (items) => this.expenses.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudo actualizar la lista de gastos.')),
    });
  }

  private refreshAssignments() {
    this.api.taxAssignments().subscribe({
      next: (items) => this.assignments.set(items),
      error: (error: unknown) => this.error.set(apiErrorMessage(error, 'No se pudo actualizar las asignaciones fiscales.')),
    });
  }

  private run<T>(request: import('rxjs').Observable<T>, success: string, after: () => void) {
    if (!this.canEdit || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    request.subscribe({
      next: () => { this.notice.set(success); this.busy.set(false); after(); },
      error: (error: unknown) => { this.error.set(apiErrorMessage(error, 'No se pudo guardar el cambio.')); this.busy.set(false); },
    });
  }

  private emptyOverhead() {
    return {
      name: '',
      category: 'OTHER',
      amountCUP: '',
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: new Date().toISOString().slice(0, 10),
      allocationMethod: 'BATCHES',
      allocationBaseQuantity: '',
      allocationUnitId: '',
      notes: '',
    };
  }
}
