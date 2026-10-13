import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScenariosService } from './scenarios.service.js';

const bakeryId = '10000000-0000-4000-8000-000000000001';
const calculationId = '20000000-0000-4000-8000-000000000001';

function assignment(
  id: string,
  category: 'SALES' | 'PROFIT_OR_INCOME',
  base: 'NET_SALES' | 'PROFIT_BEFORE_PROFIT_TAX',
  rate: string,
) {
  return {
    id,
    taxRuleId: `rule-${id}`,
    bakeryId,
    enabled: true,
    effectiveFrom: null,
    effectiveTo: null,
    configurationNotes: null,
    taxRule: { id: `rule-${id}`, code: id, name: id, category },
    taxRuleVersion: {
      id: `version-${id}`,
      taxRuleId: `rule-${id}`,
      versionNumber: 1,
      calculationMethod: 'PERCENT_OF_BASE',
      taxBase: base,
      rate: new Prisma.Decimal(rate),
      fixedAmountCUP: null,
      effectiveFrom: null,
      effectiveTo: null,
      verificationStatus: 'PENDING_VALIDATION',
      legalReference: null,
      notes: 'Supuesto de planificación.',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}

function setup(assignments: ReturnType<typeof assignment>[]) {
  let storedScenario: Record<string, unknown> | null = null;
  const prisma = {
    costCalculation: {
      findFirst: vi.fn().mockResolvedValue({
        id: calculationId,
        bakeryId,
        status: 'COMPLETE',
        valuationDate: new Date('2026-01-01T00:00:00.000Z'),
        unitCostCUP: new Prisma.Decimal('5'),
        outputUnitSnapshot: 'UD',
        inputSnapshot: { salesUnit: 'UD' },
      }),
    },
    bakeryTaxRule: {
      findMany: vi.fn().mockResolvedValue(assignments),
    },
    priceScenario: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const nested = data.taxLines as { create: Array<Record<string, unknown>> };
        storedScenario = {
          id: 'scenario-id',
          ...data,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          taxLines: nested.create.map((line, index) => ({ id: `line-${index}`, ...line })),
        };
        return { id: 'scenario-id' };
      }),
      findFirst: vi.fn(async () => storedScenario),
    },
    $transaction: vi.fn(async (operation: (transaction: unknown) => unknown) => operation(prisma)),
  };
  return {
    service: new ScenariosService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('ScenariosService', () => {
  it('calculates sales and profit tax in Decimal and keeps pending assumptions visible', async () => {
    const { service, prisma } = setup([
      assignment('sales-estimate', 'SALES', 'NET_SALES', '0.10'),
      assignment('profit-estimate', 'PROFIT_OR_INCOME', 'PROFIT_BEFORE_PROFIT_TAX', '0.05'),
    ]);

    const scenario = await service.createScenario(bakeryId, calculationId, {
      name: 'Mostrador',
      salePriceCUP: '20',
      projectedQuantity: '10',
      salePriceTaxTreatment: 'TAX_EXCLUDED_FROM_PRICE',
      targetNetMarginPercent: '50',
    });

    expect(prisma.costCalculation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: calculationId, bakeryId } }),
    );
    expect(scenario).toMatchObject({
      status: 'CALCULATED',
      grossSalesCUP: '200',
      netSalesCUP: '200',
      salesTaxCUP: '20',
      costOfSalesCUP: '50',
      profitBeforeProfitTaxCUP: '150',
      profitTaxCUP: '7.5',
      profitAfterTaxCUP: '142.5',
      netMarginPercent: '71.25',
      taxLines: [
        { taxBaseSnapshot: 'NET_SALES', taxAmountCUP: '20' },
        { taxBaseSnapshot: 'PROFIT_BEFORE_PROFIT_TAX', taxAmountCUP: '7.5' },
      ],
      calculationSnapshot: {
        warnings: ['Supuesto fiscal no validado; no es una liquidación tributaria oficial.'],
        customerTotalCUP: '220',
        breakEvenPriceCUP: '5',
        recommendedPriceCUP: '10.56',
      },
    });
  });

  it('keeps pre-tax metrics but does not invent tax or after-tax profit when treatment is unset', async () => {
    const { service } = setup([]);

    const scenario = await service.createScenario(bakeryId, calculationId, {
      name: 'Pendiente de configurar',
      salePriceCUP: '20',
      projectedQuantity: '10',
      salePriceTaxTreatment: 'NOT_CONFIGURED',
    });

    expect(scenario).toMatchObject({
      status: 'INCOMPLETE',
      netSalesCUP: null,
      salesTaxCUP: null,
      profitBeforeProfitTaxCUP: '150',
      profitTaxCUP: null,
      profitAfterTaxCUP: null,
      taxLines: [],
      calculationSnapshot: { preTaxRevenueEstimateCUP: '200' },
    });
    expect(scenario.calculationSnapshot?.incompleteReasons?.map((reason) => reason.code))
      .toEqual(expect.arrayContaining([
        'MISSING_SALES_RULE',
        'MISSING_PROFIT_RULE',
        'TAX_TREATMENT_NOT_CONFIGURED',
      ]));
  });

  it('backs out sales tax from an included price and taxes only positive profit', async () => {
    const { service } = setup([
      assignment('sales-estimate', 'SALES', 'NET_SALES', '0.10'),
      assignment('profit-estimate', 'PROFIT_OR_INCOME', 'PROFIT_BEFORE_PROFIT_TAX', '0.05'),
    ]);

    const included = await service.createScenario(bakeryId, calculationId, {
      name: 'Precio con impuesto incluido',
      salePriceCUP: '22',
      projectedQuantity: '10',
      salePriceTaxTreatment: 'TAX_INCLUDED_IN_PRICE',
    });
    expect(included).toMatchObject({
      netSalesCUP: '200',
      salesTaxCUP: '20',
      profitBeforeProfitTaxCUP: '150',
      profitTaxCUP: '7.5',
      profitAfterTaxCUP: '142.5',
      calculationSnapshot: { customerTotalCUP: '220' },
    });

    const loss = await service.createScenario(bakeryId, calculationId, {
      name: 'Precio con pérdida',
      salePriceCUP: '1',
      projectedQuantity: '1',
      salePriceTaxTreatment: 'TAX_EXCLUDED_FROM_PRICE',
    });
    expect(loss).toMatchObject({
      status: 'CALCULATED',
      profitBeforeProfitTaxCUP: '-4',
      profitTaxCUP: '0',
      profitAfterTaxCUP: '-4',
      netMarginPercent: '-400',
    });
    expect(loss.taxLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taxBaseSnapshot: 'PROFIT_BEFORE_PROFIT_TAX',
          baseAmountCUP: '0',
          taxAmountCUP: '0',
        }),
      ]),
    );
  });

  it('does not approximate unsupported tax rules as percentages', async () => {
    const unsupportedSalesRule = {
      ...assignment('unsupported-sales', 'SALES', 'NET_SALES', '0.10'),
      taxRuleVersion: {
        ...assignment('unsupported-sales', 'SALES', 'NET_SALES', '0.10').taxRuleVersion,
        calculationMethod: 'FIXED_AMOUNT',
      },
    };
    const { service } = setup([
      unsupportedSalesRule,
      assignment('profit-estimate', 'PROFIT_OR_INCOME', 'PROFIT_BEFORE_PROFIT_TAX', '0.05'),
    ]);

    const scenario = await service.createScenario(bakeryId, calculationId, {
      name: 'Regla incompatible',
      salePriceCUP: '20',
      projectedQuantity: '10',
      salePriceTaxTreatment: 'TAX_INCLUDED_IN_PRICE',
    });

    expect(scenario).toMatchObject({
      status: 'INCOMPLETE',
      netSalesCUP: null,
      salesTaxCUP: null,
      profitAfterTaxCUP: null,
    });
    expect(scenario.calculationSnapshot?.incompleteReasons?.map((reason) => reason.code))
      .toContain('UNSUPPORTED_SALES_TAX_RULE');
  });
});
