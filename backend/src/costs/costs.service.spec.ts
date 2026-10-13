import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CostsService } from './costs.service.js';

const bakeryId = '10000000-0000-4000-8000-000000000001';
const productId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const g = {
  id: 'unit-g',
  code: 'g',
  name: 'gramo',
  dimension: 'MASS',
  conversionFactor: new Prisma.Decimal('1'),
  isActive: true,
};
const kg = {
  ...g,
  id: 'unit-kg',
  code: 'kg',
  name: 'kilogramo',
  conversionFactor: new Prisma.Decimal('1000'),
};
const piece = {
  ...g,
  id: 'unit-piece',
  code: 'pc',
  name: 'pieza',
  dimension: 'COUNT',
};

function setup(input: {
  withPrice: boolean;
  labor: boolean;
  overhead: boolean;
  packagePrice?: string;
  packageQuantity?: string;
  recipeQuantity?: string;
}) {
  let created: Record<string, unknown> | null = null;
  let createData: Record<string, unknown> | null = null;
  const price = {
    id: 'price-id',
    bakeryId,
    materialId: 'material-id',
    packagePriceCUP: new Prisma.Decimal(input.packagePrice ?? '10'),
    packageQuantity: new Prisma.Decimal(input.packageQuantity ?? '1'),
    packageUnitId: kg.id,
    packageUnit: kg,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    sourceNote: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const recipe = {
    id: versionId,
    bakeryId,
    productId,
    versionNumber: 1,
    status: 'PUBLISHED',
    outputQuantity: new Prisma.Decimal('10'),
    outputUnit: piece,
    outputUnitId: piece.id,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    preparationNotes: null,
    materials: [{
      id: 'recipe-material-id',
      quantity: new Prisma.Decimal(input.recipeQuantity ?? '1000'),
      unit: g,
      material: {
        id: 'material-id',
        name: 'Harina',
        isActive: true,
        densityGramPerMl: null,
        baseUnit: g,
        prices: input.withPrice ? [{ ...price }] : [],
      },
    }],
    laborOperations: input.labor ? [{
      id: 'operation-id',
      operationName: 'Horneado',
      durationMinutes: new Prisma.Decimal('60'),
      workersCount: new Prisma.Decimal('1'),
      laborRole: {
        id: 'role-id',
        name: 'Panadero',
        isActive: true,
        rates: [{
          id: 'rate-id',
          hourlyRateCUP: new Prisma.Decimal('12'),
        }],
      },
    }] : [],
  };
  const overheadExpense = {
    id: 'overhead-id',
    bakeryId,
    name: 'Electricidad',
    category: 'ELECTRICITY',
    amountCUP: new Prisma.Decimal('30'),
    periodStart: new Date('2026-01-01T00:00:00.000Z'),
    periodEnd: new Date('2026-12-31T00:00:00.000Z'),
    allocationMethod: 'BATCHES',
    allocationBaseQuantity: new Prisma.Decimal('30'),
    allocationUnitId: null,
    allocationUnit: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prisma = {
    product: {
      findFirst: vi.fn().mockResolvedValue({
        id: productId,
        name: 'Pan',
        salesUnit: piece,
        recipeVersions: [{ id: versionId }],
      }),
    },
    recipeVersion: {
      findFirst: vi.fn().mockResolvedValue(recipe),
    },
    overheadExpense: {
      findMany: vi.fn().mockResolvedValue(input.overhead ? [overheadExpense] : []),
      count: vi.fn().mockResolvedValue(input.overhead ? 1 : 0),
    },
    costCalculation: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        createData = data;
        const nestedLines = data.lines as { create: Array<Record<string, unknown>> };
        created = {
          id: 'calculation-id',
          ...data,
          createdAt: new Date('2026-01-05T00:00:00.000Z'),
          lines: nestedLines.create.map((line, index) => ({ id: `line-${index}`, ...line })),
        };
        return created;
      }),
    },
    $transaction: vi.fn(async (operation: (transaction: unknown) => unknown) => operation(prisma)),
  };
  return {
    service: new CostsService(prisma as unknown as PrismaService),
    prisma,
    getCreated: () => created,
    getCreateData: () => createData,
  };
}

describe('CostsService', () => {
  it('saves a complete historical cost with material, labor, overhead and vendable output', async () => {
    const { service, prisma, getCreated, getCreateData } = setup({
      withPrice: true,
      labor: true,
      overhead: true,
    });

    const result = await service.calculate(bakeryId, 'user-id', productId, {
      valuationDate: '2026-01-05',
    });

    expect(result).toMatchObject({
      status: 'COMPLETE',
      materialCostCUP: '10',
      laborCostCUP: '12',
      overheadCostCUP: '1',
      totalProductionCostCUP: '23',
      outputQuantity: '10',
      outputUnitSnapshot: 'pc',
      unitCostCUP: '2.3',
      lines: [
        { lineType: 'MATERIAL', totalCUP: '10' },
        { lineType: 'LABOR', totalCUP: '12' },
        { lineType: 'OVERHEAD', totalCUP: '1' },
      ],
    });
    expect(prisma.costCalculation.create).toHaveBeenCalledOnce();
    expect(getCreated()).toMatchObject({
      bakeryId,
      status: 'COMPLETE',
      inputSnapshot: {
        recipeVersion: { id: versionId, versionNumber: 1 },
        salesUnit: 'pc',
      },
    });
    const nestedLines = getCreateData()?.lines as {
      create: Array<Record<string, unknown>>;
    };
    expect(nestedLines.create).toHaveLength(3);
    expect(nestedLines.create.every((line) => !('bakeryId' in line))).toBe(true);
  });

  it('marks absent prices, labor operations and period overhead incomplete instead of zero', async () => {
    const { service } = setup({
      withPrice: false,
      labor: false,
      overhead: false,
    });

    const result = await service.calculate(bakeryId, 'user-id', productId, {
      valuationDate: '2026-01-05',
    });

    expect(result).toMatchObject({
      status: 'INCOMPLETE',
      materialCostCUP: null,
      laborCostCUP: null,
      overheadCostCUP: null,
      totalProductionCostCUP: null,
      unitCostCUP: null,
    });
    expect(result.incompleteReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'MISSING_PRICE',
        'NO_LABOR_OPERATIONS',
        'NO_OVERHEAD_CONFIGURED',
      ]),
    );
  });

  it('values 250 grams at 62.50 CUP when a 2 kilogram package costs 500 CUP', async () => {
    const { service } = setup({
      withPrice: true,
      labor: false,
      overhead: false,
      packagePrice: '500',
      packageQuantity: '2',
      recipeQuantity: '250',
    });

    const result = await service.calculate(bakeryId, 'user-id', productId, {
      valuationDate: '2026-01-05',
    });

    expect(result.materialCostCUP).toBe('62.5');
    expect(result.lines[0]).toMatchObject({
      lineType: 'MATERIAL',
      quantity: '250',
      unitCostCUP: '0.25',
      totalCUP: '62.5',
    });
  });
});
