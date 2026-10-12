import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from './products.service.js';

const bakeryId = 'bakery-a';
const productId = 'product-a';
const versionId = 'version-a';
const materialId = 'material-a';
const unitId = 'unit-mass';
const massUnit = {
  id: unitId,
  code: 'G',
  name: 'gramo',
  dimension: 'MASS',
};
const product = {
  id: productId,
  name: 'Pan',
  description: null,
  status: 'ACTIVE',
  salesUnit: { id: 'unit-piece', code: 'UD', name: 'unidad', dimension: 'COUNT' },
};
const activeMaterial = {
  id: materialId,
  baseUnit: { dimension: 'MASS' },
};
const detailVersion = {
  id: versionId,
  productId,
  versionNumber: 1,
  status: 'DRAFT',
  outputQuantity: new Prisma.Decimal('10'),
  effectiveFrom: null,
  effectiveTo: null,
  preparationNotes: 'Mezclar',
  outputUnit: massUnit,
  materials: [
    {
      id: 'line-a',
      materialId,
      quantity: new Prisma.Decimal('250'),
      position: 0,
      notes: null,
      unit: massUnit,
      material: {
        id: materialId,
        name: 'Harina',
        kind: 'INGREDIENT',
        isActive: true,
        baseUnit: massUnit,
      },
    },
  ],
};

function setup(overrides: Record<string, unknown> = {}) {
  const prisma = {
    product: {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue(product),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(product),
      update: vi.fn().mockResolvedValue(product),
    },
    recipeVersion: {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue(detailVersion),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: versionId, versionNumber: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    recipeMaterial: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    material: {
      findMany: vi.fn().mockResolvedValue([activeMaterial]),
    },
    measurementUnit: {
      findFirst: vi.fn().mockResolvedValue(massUnit),
      findMany: vi.fn().mockResolvedValue([massUnit]),
    },
    $transaction: vi.fn(async (operation: unknown) => {
      if (typeof operation === 'function') return operation(prisma);
      return Promise.all(operation as Array<Promise<unknown>>);
    }),
    ...overrides,
  };

  return {
    service: new ProductsService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('ProductsService', () => {
  it('filters and paginates products by bakery and returns recipe state', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { ...product, recipeVersions: [{ versionNumber: 3 }] },
    ]);
    const versionFindMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(1);
    const { service, prisma } = setup({
      product: {
        count,
        findFirst: vi.fn(),
        findMany,
        create: vi.fn(),
        update: vi.fn(),
      },
      recipeVersion: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: versionFindMany,
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    const result = await service.listProducts(bakeryId, {
      search: 'pan',
      status: 'ACTIVE',
      page: 2,
      pageSize: 5,
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        bakeryId,
        name: { contains: 'pan', mode: 'insensitive' },
        status: 'ACTIVE',
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(result).toMatchObject({
      page: 2,
      pageSize: 5,
      items: [{ recipeSummary: { draftVersionNumber: 3, recipeStatus: 'DRAFT_AVAILABLE' } }],
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('returns 404 when a product is not part of the active bakery', async () => {
    const { service, prisma } = setup({
      product: {
        count: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    });

    await expect(service.getProduct(bakeryId, productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: productId, bakeryId },
      select: expect.any(Object),
    });
  });

  it('does not change a sales unit that conflicts with published recipe dimensions', async () => {
    const productUpdate = vi.fn();
    const { service } = setup({
      product: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: productUpdate,
      },
      recipeVersion: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { outputUnit: { dimension: 'MASS' } },
        ]),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      measurementUnit: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'unit-piece',
          dimension: 'COUNT',
        }),
        findMany: vi.fn(),
      },
    });

    await expect(
      service.updateProduct(bakeryId, productId, {
        salesUnitId: 'unit-piece',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(productUpdate).not.toHaveBeenCalled();
  });

  it('creates the first draft with a server-assigned version number', async () => {
    const versionFindFirst = vi.fn().mockResolvedValue(null);
    const versionCreate = vi.fn().mockResolvedValue({ id: versionId, versionNumber: 1 });
    const { service, prisma } = setup({
      recipeVersion: {
        count: vi.fn(),
        findFirst: versionFindFirst,
        findMany: vi.fn(),
        create: versionCreate,
        updateMany: vi.fn(),
      },
    });

    const result = await service.createRecipeVersion(bakeryId, productId, {
      outputQuantity: '12.500000',
      outputUnitId: unitId,
      preparationNotes: 'Primera versión',
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(versionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bakeryId,
        productId,
        versionNumber: 1,
        outputQuantity: new Prisma.Decimal('12.500000'),
        outputUnitId: unitId,
      }),
      select: { id: true, versionNumber: true },
    });
    expect(result).toEqual({
      id: versionId,
      versionNumber: 1,
      clonedFromPublished: false,
    });
  });

  it('clones the latest published version and its recipe lines into a new draft', async () => {
    const published = {
      outputQuantity: new Prisma.Decimal('20'),
      outputUnitId: unitId,
      preparationNotes: 'Publicada',
      materials: [
        {
          materialId,
          quantity: new Prisma.Decimal('500'),
          unitId,
          position: 2,
          notes: 'Tamizada',
        },
      ],
    };
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ versionNumber: 2 })
      .mockResolvedValueOnce(published);
    const create = vi.fn().mockResolvedValue({ id: 'version-three', versionNumber: 3 });
    const { service } = setup({
      recipeVersion: {
        count: vi.fn(),
        findFirst,
        findMany: vi.fn(),
        create,
        updateMany: vi.fn(),
      },
    });

    const result = await service.createRecipeVersion(bakeryId, productId, {});

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        versionNumber: 3,
        outputQuantity: published.outputQuantity,
        outputUnitId: unitId,
        preparationNotes: 'Publicada',
        materials: {
          create: [
            {
              bakeryId,
              materialId,
              quantity: published.materials[0].quantity,
              unitId,
              position: 2,
              notes: 'Tamizada',
            },
          ],
        },
      }),
      select: { id: true, versionNumber: true },
    });
    expect(result).toMatchObject({ versionNumber: 3, clonedFromPublished: true });
  });

  it('rejects duplicate materials before replacing any draft lines', async () => {
    const { service, prisma } = setup({
      recipeVersion: {
        count: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(detailVersion),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    await expect(
      service.replaceRecipeMaterials(bakeryId, productId, versionId, [
        { materialId, quantity: '1', unitId },
        { materialId, quantity: '2', unitId },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.recipeMaterial.deleteMany).not.toHaveBeenCalled();
    expect(prisma.recipeMaterial.createMany).not.toHaveBeenCalled();
  });

  it('atomically replaces valid lines after checking active tenant materials and unit dimensions', async () => {
    const { service, prisma } = setup({
      recipeVersion: {
        count: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(detailVersion),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    await service.replaceRecipeMaterials(bakeryId, productId, versionId, [
      { materialId, quantity: '250.25', unitId, notes: 'Tamizada' },
    ]);

    expect(prisma.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bakeryId, id: { in: [materialId] }, isActive: true },
      }),
    );
    expect(prisma.recipeMaterial.deleteMany).toHaveBeenCalledWith({
      where: { bakeryId, recipeVersionId: versionId },
    });
    expect(prisma.recipeMaterial.createMany).toHaveBeenCalledWith({
      data: [
        {
          bakeryId,
          recipeVersionId: versionId,
          materialId,
          quantity: new Prisma.Decimal('250.25'),
          unitId,
          position: 0,
          notes: 'Tamizada',
        },
      ],
    });
  });

  it('rejects incompatible ingredient dimensions before deleting saved lines', async () => {
    const { service, prisma } = setup({
      measurementUnit: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{ id: unitId, dimension: 'VOLUME' }]),
      },
      recipeVersion: {
        count: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: versionId, status: 'DRAFT' }),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    await expect(
      service.replaceRecipeMaterials(bakeryId, productId, versionId, [
        { materialId, quantity: '10', unitId },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.recipeMaterial.deleteMany).not.toHaveBeenCalled();
  });

  it('publishes a complete draft and closes the previous open version the prior day', async () => {
    const publishedRows = [
      {
        id: versionId,
        status: 'DRAFT',
        outputQuantity: new Prisma.Decimal('10'),
        outputUnit: { dimension: 'COUNT', isActive: true },
        materials: [
          { materialId, quantity: new Prisma.Decimal('250'), unitId },
        ],
      },
      {
        id: 'published-old',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: null,
      },
      detailVersion,
    ];
    const findFirst = vi.fn()
      .mockResolvedValueOnce(publishedRows[0])
      .mockResolvedValueOnce(publishedRows[1])
      .mockResolvedValueOnce(publishedRows[2]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const productFindFirst = vi
      .fn()
      .mockResolvedValue({ id: productId, salesUnit: { dimension: 'COUNT', isActive: true } });
    const { service, prisma } = setup({
      product: {
        count: vi.fn(),
        findFirst: productFindFirst,
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      recipeVersion: {
        count: vi.fn(),
        findFirst,
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany,
      },
    });

    await service.publishRecipeVersion(bakeryId, productId, versionId, {
      effectiveFrom: '2025-02-01',
    });

    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'published-old' }),
        data: { effectiveTo: new Date('2025-01-31T00:00:00.000Z') },
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: versionId, status: 'DRAFT' }),
        data: {
          status: 'PUBLISHED',
          effectiveFrom: new Date('2025-02-01T00:00:00.000Z'),
          effectiveTo: null,
        },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('rejects retroactive publication without changing version status', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: versionId,
        status: 'DRAFT',
        outputQuantity: new Prisma.Decimal('10'),
        outputUnit: { dimension: 'COUNT', isActive: true },
        materials: [{ materialId, quantity: new Prisma.Decimal('5'), unitId }],
      })
      .mockResolvedValueOnce({
        id: 'published-old',
        effectiveFrom: new Date('2025-02-01T00:00:00.000Z'),
        effectiveTo: null,
      });
    const updateMany = vi.fn();
    const { service } = setup({
      recipeVersion: {
        count: vi.fn(),
        findFirst,
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany,
      },
    });

    await expect(
      service.publishRecipeVersion(bakeryId, productId, versionId, {
        effectiveFrom: '2025-01-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not allow direct edits of a published recipe version', async () => {
    const { service } = setup({
      recipeVersion: {
        count: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          ...detailVersion,
          status: 'PUBLISHED',
        }),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    await expect(
      service.updateRecipeVersion(bakeryId, productId, versionId, {
        preparationNotes: 'Cambio retroactivo',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
