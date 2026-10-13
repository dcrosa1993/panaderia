import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreatePriceScenarioDto,
  CreateTaxAssignmentDto,
  UpdateTaxAssignmentDto,
} from './scenarios.dto.js';

const calculationSelect = {
  id: true,
  bakeryId: true,
  status: true,
  valuationDate: true,
  unitCostCUP: true,
  outputUnitSnapshot: true,
  inputSnapshot: true,
} satisfies Prisma.CostCalculationSelect;

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    const rules = await this.prisma.taxRule.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        versions: {
          select: {
            id: true,
            versionNumber: true,
            calculationMethod: true,
            taxBase: true,
            rate: true,
            fixedAmountCUP: true,
            effectiveFrom: true,
            effectiveTo: true,
            verificationStatus: true,
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rules.map((rule) => ({
      ...rule,
      versions: rule.versions.map((version) => ({
        ...version,
        rate: version.rate?.toString() ?? null,
        fixedAmountCUP: version.fixedAmountCUP?.toString() ?? null,
        effectiveFrom: version.effectiveFrom ? formatDate(version.effectiveFrom) : null,
        effectiveTo: version.effectiveTo ? formatDate(version.effectiveTo) : null,
      })),
    }));
  }

  async listAssignments(bakeryId: string) {
    const foundAssignments = await this.prisma.bakeryTaxRule.findMany({
      where: { bakeryId },
      include: {
        taxRule: { select: { code: true, name: true, category: true } },
        taxRuleVersion: {
          select: { versionNumber: true, calculationMethod: true, taxBase: true, rate: true, verificationStatus: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return foundAssignments.map(serializeAssignment);
  }

  async createAssignment(bakeryId: string, input: CreateTaxAssignmentDto) {
    const version = await this.prisma.taxRuleVersion.findFirst({
      where: { id: input.taxRuleVersionId },
      select: { id: true, taxRuleId: true, effectiveFrom: true, effectiveTo: true, verificationStatus: true },
    });
    if (!version) throw new NotFoundException('Tax rule version not found.');
    if (version.verificationStatus === 'REJECTED' || version.verificationStatus === 'RETIRED') {
      throw new BadRequestException('No se puede asignar una versión fiscal rechazada o retirada.');
    }
    const dates = assignmentDates(input.effectiveFrom, input.effectiveTo);
    if (version.effectiveFrom && dates.effectiveFrom && dates.effectiveFrom < version.effectiveFrom) {
      throw new BadRequestException('La vigencia de la asignación no puede preceder la vigencia de la versión.');
    }
    try {
      const created = await this.prisma.bakeryTaxRule.create({
        data: {
          bakeryId,
          taxRuleId: version.taxRuleId,
          taxRuleVersionId: version.id,
          enabled: input.enabled,
          ...dates,
          configurationNotes: input.configurationNotes?.trim() || null,
        },
        select: { id: true },
      });
      return this.getAssignment(bakeryId, created.id);
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) throw new ConflictException('Ya existe una asignación de esta regla con la misma fecha de inicio.');
      throw error;
    }
  }

  async updateAssignment(bakeryId: string, id: string, input: UpdateTaxAssignmentDto) {
    const existing = await this.prisma.bakeryTaxRule.findFirst({
      where: { id, bakeryId },
      select: { id: true, effectiveFrom: true, effectiveTo: true, taxRuleVersion: { select: { effectiveFrom: true, effectiveTo: true } } },
    });
    if (!existing) throw new NotFoundException('Tax rule assignment not found.');
    if (!Object.keys(input).length) throw new BadRequestException('Indica al menos un campo para actualizar.');
    const startInput = input.effectiveFrom === undefined ? (existing.effectiveFrom ? formatDate(existing.effectiveFrom) : null) : input.effectiveFrom;
    const endInput = input.effectiveTo === undefined ? (existing.effectiveTo ? formatDate(existing.effectiveTo) : null) : input.effectiveTo;
    const dates = assignmentDates(startInput, endInput);
    if (existing.taxRuleVersion.effectiveFrom && dates.effectiveFrom && dates.effectiveFrom < existing.taxRuleVersion.effectiveFrom) {
      throw new BadRequestException('La vigencia de la asignación no puede preceder la vigencia de la versión.');
    }
    try {
      await this.prisma.bakeryTaxRule.updateMany({
        where: { id, bakeryId },
        data: {
          ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
          ...dates,
          ...(input.configurationNotes === undefined ? {} : { configurationNotes: input.configurationNotes?.trim() || null }),
        },
      });
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) throw new ConflictException('Conflicto con otra asignación fiscal.');
      throw error;
    }
    return this.getAssignment(bakeryId, id);
  }

  async listScenarios(bakeryId: string, calculationId: string) {
    await this.requireCalculation(bakeryId, calculationId);
    const scenarios = await this.prisma.priceScenario.findMany({
      where: { bakeryId, calculationId },
      select: { id: true, name: true, status: true, salePriceCUP: true, projectedQuantity: true, grossSalesCUP: true, netSalesCUP: true, profitAfterTaxCUP: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return scenarios.map((scenario) => ({
      ...scenario,
      salePriceCUP: scenario.salePriceCUP.toString(),
      projectedQuantity: scenario.projectedQuantity.toString(),
      grossSalesCUP: scenario.grossSalesCUP?.toString() ?? null,
      netSalesCUP: scenario.netSalesCUP?.toString() ?? null,
      profitAfterTaxCUP: scenario.profitAfterTaxCUP?.toString() ?? null,
      createdAt: scenario.createdAt.toISOString(),
    }));
  }

  async createScenario(bakeryId: string, calculationId: string, input: CreatePriceScenarioDto) {
    const calculation = await this.requireCalculation(bakeryId, calculationId);
    const salePrice = positiveDecimal(input.salePriceCUP, 'salePriceCUP');
    const quantity = positiveDecimal(input.projectedQuantity, 'projectedQuantity');
    const discounts = nonNegativeDecimal(input.discountsReturnsCUP ?? '0', 'discountsReturnsCUP');
    const otherExpenses = nonNegativeDecimal(input.otherOperatingExpensesCUP ?? '0', 'otherOperatingExpensesCUP');
    const gross = salePrice.mul(quantity);
    if (discounts.gt(gross)) throw new BadRequestException('Los descuentos y devoluciones no pueden superar las ventas brutas.');
    const preTaxSalesBase = gross.sub(discounts);
    const reasons: IncompleteReason[] = [];
    const foundAssignments = await this.prisma.bakeryTaxRule.findMany({
      where: {
        bakeryId,
        enabled: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: calculation.valuationDate } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: calculation.valuationDate } }] }],
      },
      include: {
        taxRule: true,
        taxRuleVersion: true,
      },
      orderBy: [{ taxRule: { category: 'asc' } }, { id: 'asc' }],
    });
    const periodAssignments = foundAssignments.filter((assignment) =>
      (!assignment.taxRuleVersion.effectiveFrom ||
        assignment.taxRuleVersion.effectiveFrom <= calculation.valuationDate) &&
      (!assignment.taxRuleVersion.effectiveTo ||
        assignment.taxRuleVersion.effectiveTo >= calculation.valuationDate),
    );
    const versionsByRule = new Map<string, typeof periodAssignments>();
    for (const assignment of periodAssignments) {
      const group = versionsByRule.get(assignment.taxRuleId) ?? [];
      group.push(assignment);
      versionsByRule.set(assignment.taxRuleId, group);
    }
    const ambiguousRuleIds = new Set(
      [...versionsByRule.entries()]
        .filter(([, versions]) => versions.length > 1)
        .map(([ruleId]) => ruleId),
    );
    const assignments = periodAssignments.filter(
      (assignment) => !ambiguousRuleIds.has(assignment.taxRuleId),
    );
    if (ambiguousRuleIds.size) {
      reasons.push(issue('TAX', 'AMBIGUOUS_TAX_ASSIGNMENT', 'Hay más de una versión asignada y vigente de una misma regla fiscal para la fecha de valoración.'));
    }
    const salesRules = assignments.filter((assignment) => assignment.taxRule.category === 'SALES');
    const profitRules = assignments.filter((assignment) => assignment.taxRule.category === 'PROFIT_OR_INCOME');
    const otherTaxRules = assignments.filter((assignment) =>
      assignment.taxRule.category !== 'SALES' &&
      assignment.taxRule.category !== 'PROFIT_OR_INCOME',
    );
    if (otherTaxRules.length) {
      reasons.push(issue('TAX', 'UNSUPPORTED_TAX_CATEGORY', `Categorías fiscales aún no soportadas: ${otherTaxRules.map((item) => item.taxRule.name).join(', ')}.`));
    }
    if (!salesRules.length) reasons.push(issue('TAX', 'MISSING_SALES_RULE', 'No hay una regla de impuesto sobre ventas habilitada para esta fecha.'));
    if (!profitRules.length) reasons.push(issue('TAX', 'MISSING_PROFIT_RULE', 'No hay una regla de impuesto sobre utilidad habilitada para esta fecha.'));
    const salesUnsupported: string[] = [];
    const profitUnsupported: string[] = [];
    const supportedSalesRules = salesRules.filter((assignment) => {
      const version = assignment.taxRuleVersion;
      const supported = version.calculationMethod === 'PERCENT_OF_BASE' &&
        version.taxBase === 'NET_SALES' && Boolean(version.rate) &&
        (version.rate?.gte(0) ?? false);
      if (!supported) salesUnsupported.push(assignment.taxRule.name);
      return supported;
    });
    const supportedProfitRules = profitRules.filter((assignment) => {
      const version = assignment.taxRuleVersion;
      const supported = version.calculationMethod === 'PERCENT_OF_BASE' &&
        version.taxBase === 'PROFIT_BEFORE_PROFIT_TAX' &&
        Boolean(version.rate) && (version.rate?.gte(0) ?? false);
      if (!supported) profitUnsupported.push(assignment.taxRule.name);
      return supported;
    });
    let ratesSales = new Prisma.Decimal(0);
    for (const assignment of supportedSalesRules) {
      ratesSales = ratesSales.add(assignment.taxRuleVersion.rate!);
    }
    let ratesProfit = new Prisma.Decimal(0);
    for (const assignment of supportedProfitRules) {
      ratesProfit = ratesProfit.add(assignment.taxRuleVersion.rate!);
    }
    const taxesUnsupported = [...salesUnsupported, ...profitUnsupported];
    if (salesUnsupported.length) reasons.push(issue('TAX', 'UNSUPPORTED_SALES_TAX_RULE', `No se puede calcular con precisión la regla: ${salesUnsupported.join(', ')}.`));
    if (profitUnsupported.length) reasons.push(issue('TAX', 'UNSUPPORTED_PROFIT_TAX_RULE', `No se puede calcular con precisión la regla: ${profitUnsupported.join(', ')}.`));
    if (input.salePriceTaxTreatment === 'NOT_CONFIGURED') {
      reasons.push(issue('TAX', 'TAX_TREATMENT_NOT_CONFIGURED', 'Configura si el precio incluye o excluye impuestos para calcular impuestos y utilidad final.'));
    }
    if (calculation.status !== 'COMPLETE' || !calculation.unitCostCUP || calculation.outputUnitSnapshot !== readString(calculation.inputSnapshot, 'salesUnit')) {
      reasons.push(issue('COST', 'COSTING_UNAVAILABLE', 'El coste de fabricación no está completo o no corresponde a la unidad comercial.'));
    }

    let netSales: Prisma.Decimal | null = null;
    let salesTax: Prisma.Decimal | null = null;
    const taxLines: TaxLineDraft[] = [];
    const canComputeSalesTax = input.salePriceTaxTreatment !== 'NOT_CONFIGURED' &&
      salesRules.length > 0 && salesUnsupported.length === 0;
    if (input.salePriceTaxTreatment === 'TAX_EXCLUDED_FROM_PRICE') {
      netSales = money(preTaxSalesBase);
      if (canComputeSalesTax) {
        appendTaxLines(taxLines, supportedSalesRules, netSales);
        salesTax = sumTaxLines(taxLines, 'NET_SALES');
      } else if (supportedSalesRules.length) {
        appendTaxLines(taxLines, supportedSalesRules, netSales);
      }
    } else if (input.salePriceTaxTreatment === 'TAX_INCLUDED_IN_PRICE' && canComputeSalesTax) {
      netSales = money(preTaxSalesBase.div(new Prisma.Decimal(1).add(ratesSales)));
      appendTaxLines(taxLines, supportedSalesRules, netSales);
      salesTax = sumTaxLines(taxLines, 'NET_SALES');
    } else if (input.salePriceTaxTreatment === 'TAX_INCLUDED_IN_PRICE') {
      reasons.push(issue('TAX', 'UNSUPPORTED_INCLUDED_TAX_INVERSION', 'No se puede invertir el precio con impuesto incluido hasta que todas las reglas de venta sean porcentajes sobre ventas netas.'));
    }

    const costOfSales = calculation.status === 'COMPLETE' && calculation.unitCostCUP &&
      calculation.outputUnitSnapshot === readString(calculation.inputSnapshot, 'salesUnit')
      ? money(calculation.unitCostCUP.mul(quantity))
      : null;
    const preTaxRevenueEstimate = input.salePriceTaxTreatment === 'NOT_CONFIGURED'
      ? money(preTaxSalesBase)
      : netSales;
    const profitBefore = preTaxRevenueEstimate && costOfSales !== null
      ? money(preTaxRevenueEstimate.sub(costOfSales).sub(otherExpenses))
      : null;
    let profitTax: Prisma.Decimal | null = null;
    let profitAfter: Prisma.Decimal | null = null;
    const canComputeProfitTax = input.salePriceTaxTreatment !== 'NOT_CONFIGURED' &&
      salesRules.length > 0 && salesUnsupported.length === 0 &&
      profitRules.length > 0 && profitUnsupported.length === 0;
    if (profitBefore !== null && canComputeProfitTax) {
      appendTaxLines(taxLines, supportedProfitRules, Prisma.Decimal.max(profitBefore, 0));
      profitTax = sumTaxLines(taxLines, 'PROFIT_BEFORE_PROFIT_TAX');
      profitAfter = money(profitBefore.sub(profitTax));
    }

    const pendingValidation = taxLines.some(
      (line) => line.verificationStatusSnapshot === 'PENDING_VALIDATION',
    );
    const warnings = pendingValidation
      ? ['Supuesto fiscal no validado; no es una liquidación tributaria oficial.']
      : [];
    if (input.salePriceTaxTreatment === 'TAX_EXCLUDED_FROM_PRICE' && salesRules.length > 0 && !canComputeSalesTax) {
      reasons.push(issue('TAX', 'SALES_TAX_UNAVAILABLE', 'No se puede calcular el impuesto sobre ventas con la configuración habilitada.'));
    }
    if (profitBefore !== null && input.salePriceTaxTreatment !== 'NOT_CONFIGURED' && profitRules.length > 0 && profitUnsupported.length > 0) {
      reasons.push(issue('TAX', 'PROFIT_TAX_UNAVAILABLE', 'No se puede calcular el impuesto sobre utilidad con la configuración habilitada.'));
    }

    const breakEvenPrice = preTaxRevenueEstimate === null || costOfSales === null
      ? null
      : breakEven(salePrice, quantity, discounts, costOfSales.add(otherExpenses), input.salePriceTaxTreatment, ratesSales, canComputeSalesTax);
    const targetMargin = input.targetNetMarginPercent == null
      ? null
      : nonNegativeDecimal(input.targetNetMarginPercent, 'targetNetMarginPercent');
    if (targetMargin?.gte(100)) throw new BadRequestException('El margen neto objetivo debe ser menor que 100%.');
    const recommendedPrice = targetMargin === null || costOfSales === null
      ? null
      : targetPrice(targetMargin, quantity, discounts, costOfSales.add(otherExpenses), ratesSales, ratesProfit, input.salePriceTaxTreatment, canComputeSalesTax && profitRules.length > 0 && taxesUnsupported.length === 0);
    if (targetMargin !== null && recommendedPrice === null) {
      reasons.push(issue('PRICE', 'TARGET_PRICE_UNSUPPORTED', 'No se puede resolver el precio objetivo con los datos y reglas fiscales habilitadas.'));
    }

    const status = reasons.length === 0 && netSales !== null && profitAfter !== null
      ? 'CALCULATED'
      : 'INCOMPLETE';
    const created = await this.prisma.$transaction(async (tx) => {
      const scenario = await tx.priceScenario.create({
        data: {
          bakeryId,
          calculationId,
          name: input.name.trim(),
          status,
          salePriceCUP: salePrice,
          projectedQuantity: quantity,
          salePriceTaxTreatment: input.salePriceTaxTreatment,
          discountsReturnsCUP: money(discounts),
          grossSalesCUP: money(gross),
          netSalesCUP: netSales ? money(netSales) : null,
          costOfSalesCUP: costOfSales,
          otherOperatingExpensesCUP: money(otherExpenses),
          salesTaxCUP: salesTax,
          profitBeforeProfitTaxCUP: profitBefore,
          profitTaxCUP: profitTax,
          profitAfterTaxCUP: profitAfter,
          netMarginPercent: profitAfter !== null && netSales?.gt(0)
            ? profitAfter.div(netSales).mul(100).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
            : null,
          calculationSnapshot: {
            incompleteReasons: reasons,
            warnings,
            preTaxRevenueEstimateCUP: preTaxRevenueEstimate?.toString() ?? null,
            customerTotalCUP: input.salePriceTaxTreatment === 'TAX_INCLUDED_IN_PRICE'
              ? money(preTaxSalesBase).toString()
              : (salesTax === null ? null : money(preTaxSalesBase.add(salesTax)).toString()),
            breakEvenPriceCUP: breakEvenPrice ? money(breakEvenPrice).toString() : null,
            breakEvenPriceTaxTreatment: input.salePriceTaxTreatment,
            targetNetMarginPercent: targetMargin?.toString() ?? null,
            recommendedPriceCUP: recommendedPrice ? money(recommendedPrice).toString() : null,
            recommendedPriceTaxTreatment: input.salePriceTaxTreatment,
            roundingPolicy: 'ROUND_HALF_UP a dos decimales en importes monetarios persistidos; precisión Decimal en operaciones y unitCostCUP a seis decimales.',
          },
          taxLines: { create: taxLines.map((line) => ({ ...line, bakeryId })) },
        },
        select: { id: true },
      });
      return scenario;
    });
    return this.getScenario(bakeryId, created.id);
  }

  async getScenario(bakeryId: string, scenarioId: string) {
    const scenario = await this.prisma.priceScenario.findFirst({
      where: { id: scenarioId, bakeryId },
      include: {
        taxLines: { orderBy: [{ taxNameSnapshot: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!scenario) throw new NotFoundException('Price scenario not found.');
    return serializeScenario(scenario);
  }

  private async requireCalculation(bakeryId: string, calculationId: string) {
    const calculation = await this.prisma.costCalculation.findFirst({
      where: { id: calculationId, bakeryId },
      select: calculationSelect,
    });
    if (!calculation) throw new NotFoundException('Cost calculation not found.');
    return calculation;
  }

  private async getAssignment(bakeryId: string, id: string) {
    const assignment = await this.prisma.bakeryTaxRule.findFirst({
      where: { id, bakeryId },
      include: {
        taxRule: { select: { code: true, name: true, category: true } },
        taxRuleVersion: { select: { versionNumber: true, calculationMethod: true, taxBase: true, rate: true, verificationStatus: true } },
      },
    });
    if (!assignment) throw new NotFoundException('Tax rule assignment not found.');
    return serializeAssignment(assignment);
  }
}

type IncompleteReason = { category: string; code: string; message: string };
type TaxLineDraft = {
  bakeryTaxRuleId: string;
  taxRuleVersionId: string;
  taxNameSnapshot: string;
  taxBaseSnapshot: 'NET_SALES' | 'PROFIT_BEFORE_PROFIT_TAX';
  baseAmountCUP: Prisma.Decimal;
  rateApplied: Prisma.Decimal;
  taxAmountCUP: Prisma.Decimal;
  verificationStatusSnapshot: 'PENDING_VALIDATION' | 'VERIFIED' | 'REJECTED' | 'RETIRED';
  notesSnapshot: string | null;
};

function appendTaxLines(
  lines: TaxLineDraft[],
  assignments: Array<{
    id: string;
    taxRule: { name: string };
    taxRuleVersion: { id: string; taxBase: string; rate: Prisma.Decimal | null; verificationStatus: TaxLineDraft['verificationStatusSnapshot']; notes: string | null };
    configurationNotes: string | null;
  }>,
  base: Prisma.Decimal,
) {
  for (const assignment of assignments) {
    const rate = assignment.taxRuleVersion.rate;
    const taxBase = assignment.taxRuleVersion.taxBase;
    if (!rate || (taxBase !== 'NET_SALES' && taxBase !== 'PROFIT_BEFORE_PROFIT_TAX')) continue;
    lines.push({
      bakeryTaxRuleId: assignment.id,
      taxRuleVersionId: assignment.taxRuleVersion.id,
      taxNameSnapshot: assignment.taxRule.name,
      taxBaseSnapshot: taxBase,
      baseAmountCUP: money(base),
      rateApplied: rate,
      taxAmountCUP: money(base.mul(rate)),
      verificationStatusSnapshot: assignment.taxRuleVersion.verificationStatus,
      notesSnapshot: assignment.configurationNotes ?? assignment.taxRuleVersion.notes,
    });
  }

}

function sumTaxLines(
  lines: TaxLineDraft[],
  base: TaxLineDraft['taxBaseSnapshot'],
): Prisma.Decimal {
  return lines
    .filter((line) => line.taxBaseSnapshot === base)
    .reduce((sum, line) => sum.add(line.taxAmountCUP), new Prisma.Decimal(0));
}

function assignmentDates(startInput?: string | null, endInput?: string | null) {
  const effectiveFrom = startInput ? parseDate(startInput, 'effectiveFrom') : null;
  const effectiveTo = endInput ? parseDate(endInput, 'effectiveTo') : null;
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    throw new BadRequestException('effectiveTo debe ser igual o posterior a effectiveFrom.');
  }
  return { effectiveFrom, effectiveTo };
}

function parseDate(value: string, field: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid YYYY-MM-DD calendar date.`);
  }
  return date;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function positiveDecimal(value: string, field: string) {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) throw new BadRequestException(`${field} must be greater than zero.`);
  return decimal;
}

function nonNegativeDecimal(value: string, field: string) {
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite() || decimal.lt(0)) throw new BadRequestException(`${field} cannot be negative.`);
  return decimal;
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function issue(category: string, code: string, message: string): IncompleteReason {
  return { category, code, message };
}

function readString(value: Prisma.JsonValue, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value[key];
  return typeof item === 'string' ? item : null;
}

function breakEven(
  _salePrice: Prisma.Decimal,
  quantity: Prisma.Decimal,
  discounts: Prisma.Decimal,
  cost: Prisma.Decimal,
  treatment: string,
  salesRate: Prisma.Decimal,
  supported: boolean,
) {
  if (quantity.lte(0)) return null;
  if (treatment === 'TAX_EXCLUDED_FROM_PRICE') return cost.add(discounts).div(quantity);
  if (treatment === 'TAX_INCLUDED_IN_PRICE' && supported) {
    return cost.mul(new Prisma.Decimal(1).add(salesRate)).add(discounts).div(quantity);
  }
  return null;
}

function targetPrice(
  marginPercent: Prisma.Decimal,
  quantity: Prisma.Decimal,
  discounts: Prisma.Decimal,
  cost: Prisma.Decimal,
  salesRate: Prisma.Decimal,
  profitRate: Prisma.Decimal,
  treatment: string,
  supported: boolean,
) {
  if (!supported || quantity.lte(0)) return null;
  const margin = marginPercent.div(100);
  const afterTaxFactor = new Prisma.Decimal(1).sub(profitRate);
  const denominator = afterTaxFactor.sub(margin);
  if (denominator.lte(0) || afterTaxFactor.lte(0)) return null;
  const netSalesRequired = afterTaxFactor.mul(cost).div(denominator);
  if (treatment === 'TAX_EXCLUDED_FROM_PRICE') {
    return netSalesRequired.add(discounts).div(quantity);
  }
  if (treatment === 'TAX_INCLUDED_IN_PRICE') {
    return netSalesRequired.mul(new Prisma.Decimal(1).add(salesRate)).add(discounts).div(quantity);
  }
  return null;
}

function serializeAssignment<T extends {
  id: string; enabled: boolean; effectiveFrom: Date | null; effectiveTo: Date | null;
  configurationNotes: string | null; taxRule: { code: string; name: string; category: string };
  taxRuleVersion: { versionNumber: number; calculationMethod: string; taxBase: string; rate: Prisma.Decimal | null; verificationStatus: string };
}>(assignment: T) {
  return {
    ...assignment,
    effectiveFrom: assignment.effectiveFrom ? formatDate(assignment.effectiveFrom) : null,
    effectiveTo: assignment.effectiveTo ? formatDate(assignment.effectiveTo) : null,
    taxRuleVersion: {
      ...assignment.taxRuleVersion,
      rate: assignment.taxRuleVersion.rate?.toString() ?? null,
    },
  };
}

function serializeScenario<T extends {
  id: string; calculationId: string; name: string; status: string; salePriceCUP: Prisma.Decimal;
  projectedQuantity: Prisma.Decimal; salePriceTaxTreatment: string; discountsReturnsCUP: Prisma.Decimal;
  grossSalesCUP: Prisma.Decimal | null; netSalesCUP: Prisma.Decimal | null; costOfSalesCUP: Prisma.Decimal | null;
  otherOperatingExpensesCUP: Prisma.Decimal | null; salesTaxCUP: Prisma.Decimal | null;
  profitBeforeProfitTaxCUP: Prisma.Decimal | null; profitTaxCUP: Prisma.Decimal | null;
  profitAfterTaxCUP: Prisma.Decimal | null; netMarginPercent: Prisma.Decimal | null;
  calculationSnapshot: Prisma.JsonValue | null; createdAt: Date;
  taxLines: Array<{
    id: string; taxNameSnapshot: string; taxBaseSnapshot: string;
    baseAmountCUP: Prisma.Decimal | null; rateApplied: Prisma.Decimal | null;
    taxAmountCUP: Prisma.Decimal | null; verificationStatusSnapshot: string; notesSnapshot: string | null;
  }>;
}>(scenario: T) {
  return {
    ...scenario,
    salePriceCUP: scenario.salePriceCUP.toString(),
    projectedQuantity: scenario.projectedQuantity.toString(),
    discountsReturnsCUP: scenario.discountsReturnsCUP.toString(),
    grossSalesCUP: scenario.grossSalesCUP?.toString() ?? null,
    netSalesCUP: scenario.netSalesCUP?.toString() ?? null,
    costOfSalesCUP: scenario.costOfSalesCUP?.toString() ?? null,
    otherOperatingExpensesCUP: scenario.otherOperatingExpensesCUP?.toString() ?? null,
    salesTaxCUP: scenario.salesTaxCUP?.toString() ?? null,
    profitBeforeProfitTaxCUP: scenario.profitBeforeProfitTaxCUP?.toString() ?? null,
    profitTaxCUP: scenario.profitTaxCUP?.toString() ?? null,
    profitAfterTaxCUP: scenario.profitAfterTaxCUP?.toString() ?? null,
    netMarginPercent: scenario.netMarginPercent?.toString() ?? null,
    createdAt: scenario.createdAt.toISOString(),
    taxLines: scenario.taxLines.map((line) => ({
      ...line,
      baseAmountCUP: line.baseAmountCUP?.toString() ?? null,
      rateApplied: line.rateApplied?.toString() ?? null,
      taxAmountCUP: line.taxAmountCUP?.toString() ?? null,
    })),
  };
}

function isPrismaCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
