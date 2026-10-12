import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MaterialsService } from './materials.service.js';

describe('MaterialsService', () => {
  const bakeryId = 'bakery-a';
  const materialId = 'material-a';
  const unitId = 'unit-a';
  const gram = {
    id: unitId,
    code: 'G',
    name: 'gramo',
    dimension: 'MASS' as const,
    conversionFactor: new Prisma.Decimal('1'),
  };
  const material = {
    id: materialId,
    name: 'Harina',
    kind: 'INGREDIENT' as const,
    baseUnitId: unitId,
    densityGramPerMl: null,
    isActive: true,
    baseUnit: gram,
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const transaction = {
      materialPrice: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockImplementation(({ data }) => ({
          id: 'price-new',
          ...data,
          packageUnit: gram,
        })),
      },
    };
    const prisma = {
      material: {
        findUnique: vi.fn().mockResolvedValue(material),
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([material]),
      },
      materialPrice: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      measurementUnit: {
        findFirst: vi.fn().mockResolvedValue(gram),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (operation: unknown) => {
        if (typeof operation === 'function') {
          return operation(transaction);
        }
        return [0, [material]];
      }),
      ...overrides,
    };
    return {
      service: new MaterialsService(prisma as unknown as PrismaService),
      prisma,
      transaction,
    };
  }

  it('scopes material lookup by the active bakery and hides foreign material IDs', async () => {
    const { service, prisma } = setup({
      material: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(service.getMaterial(bakeryId, materialId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.material.findUnique).toHaveBeenCalledWith({
      where: { id_bakeryId: { id: materialId, bakeryId } },
      select: expect.any(Object),
    });
  });

  it('applies tenant filters and pagination and serializes the current Decimal price', async () => {
    const findMany = vi.fn().mockResolvedValue([material]);
    const count = vi.fn().mockResolvedValue(1);
    const currentPrice = {
      id: 'price-current',
      packagePriceCUP: new Prisma.Decimal('12'),
      packageQuantity: new Prisma.Decimal('2'),
      packageUnit: gram,
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: null,
      sourceNote: null,
    };
    const priceFindFirst = vi.fn().mockResolvedValue(currentPrice);
    const transaction = vi.fn().mockResolvedValue([1, [material]]);
    const { service } = setup({
      material: { findUnique: vi.fn(), count, findMany },
      materialPrice: {
        count: vi.fn(),
        findFirst: priceFindFirst,
        findMany: vi.fn(),
      },
      $transaction: transaction,
    });

    const result = await service.listMaterials(bakeryId, {
      page: 2,
      pageSize: 10,
      search: 'Harina',
      kind: 'INGREDIENT',
      isActive: false,
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        bakeryId,
        name: { contains: 'Harina', mode: 'insensitive' },
        kind: 'INGREDIENT',
        isActive: false,
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(result).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
      items: [{ currentPrice: { pricePerBaseUnitCUP: '6' } }],
    });
    expect(priceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bakeryId, materialId }),
      }),
    );
  });

  it('returns price history newest-first with the normalized base-unit price', async () => {
    const historyPrice = {
      id: 'price-history',
      packagePriceCUP: new Prisma.Decimal('9'),
      packageQuantity: new Prisma.Decimal('3'),
      packageUnit: gram,
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2025-01-31T00:00:00.000Z'),
      sourceNote: 'Factura',
    };
    const findMany = vi.fn().mockResolvedValue([historyPrice]);
    const { service, prisma } = setup({
      material: { findUnique: vi.fn().mockResolvedValue(material) },
      materialPrice: { count: vi.fn(), findFirst: vi.fn(), findMany },
    });

    const result = await service.listPrices(bakeryId, materialId);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bakeryId, materialId },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.items).toMatchObject([
      {
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-01-31',
        normalizedQuantityInBaseUnit: '3',
        pricePerBaseUnitCUP: '3',
      },
    ]);
    expect(prisma.material.findUnique).toHaveBeenCalled();
  });

  it('normalizes package quantities with Decimal and closes an open price before inserting', async () => {
    const kilo = {
      ...gram,
      id: 'unit-kilo',
      code: 'KG',
      name: 'kilogramo',
      conversionFactor: new Prisma.Decimal('1000'),
    };
    const { service, prisma, transaction } = setup({
      measurementUnit: {
        findFirst: vi.fn().mockResolvedValue(kilo),
        findMany: vi.fn(),
      },
    });
    transaction.materialPrice.create.mockImplementation(({ data }) => ({
      id: 'price-new',
      ...data,
      packageUnit: kilo,
    }));
    transaction.materialPrice.findFirst.mockResolvedValue({
      id: 'price-old',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: null,
    });

    const result = await service.createPrice(bakeryId, materialId, {
      packagePriceCUP: '12.00',
      packageQuantity: '2',
      packageUnitId: kilo.id,
      effectiveFrom: '2025-02-01',
    });

    expect(transaction.materialPrice.update).toHaveBeenCalledWith({
      where: { id_bakeryId: { id: 'price-old', bakeryId } },
      data: { effectiveTo: new Date('2025-01-31T00:00:00.000Z') },
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      normalizedQuantityInBaseUnit: '2000',
      pricePerBaseUnitCUP: '0.006',
      effectiveFrom: '2025-02-01',
    });
  });

  it('rejects incompatible dimensions without writing a price', async () => {
    const liter = {
      ...gram,
      id: 'unit-liter',
      dimension: 'VOLUME' as const,
    };
    const { service, prisma } = setup({
      measurementUnit: {
        findFirst: vi.fn().mockResolvedValue(liter),
        findMany: vi.fn(),
      },
    });

    await expect(
      service.createPrice(bakeryId, materialId, {
        packagePriceCUP: '10',
        packageQuantity: '1',
        packageUnitId: liter.id,
        effectiveFrom: '2025-02-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects zero prices before opening a transaction', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createPrice(bakeryId, materialId, {
        packagePriceCUP: '0',
        packageQuantity: '1',
        packageUnitId: unitId,
        effectiveFrom: '2025-02-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid calendar dates before opening a transaction', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createPrice(bakeryId, materialId, {
        packagePriceCUP: '10',
        packageQuantity: '1',
        packageUnitId: unitId,
        effectiveFrom: '2025-02-30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
