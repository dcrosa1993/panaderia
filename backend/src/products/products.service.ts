import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  RecipeVersionStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateProductDto,
  CreateRecipeVersionDto,
  ListProductsQueryDto,
  PublishRecipeVersionDto,
  RecipeMaterialInputDto,
  UpdateProductDto,
  UpdateRecipeVersionDto,
} from './products.dto.js';

const productSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  salesUnit: {
    select: { id: true, code: true, name: true, dimension: true },
  },
  recipeVersions: {
    where: { status: RecipeVersionStatus.DRAFT },
    orderBy: { versionNumber: 'desc' },
    take: 1,
    select: { versionNumber: true },
  },
} satisfies Prisma.ProductSelect;

const PRODUCT_DETAIL_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  salesUnit: {
    select: { id: true, code: true, name: true, dimension: true },
  },
  recipeVersions: {
    where: { status: RecipeVersionStatus.PUBLISHED },
    orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
    take: 1,
    select: {
      versionNumber: true,
      outputQuantity: true,
      outputUnit: { select: { id: true, code: true, name: true } },
      effectiveFrom: true,
      effectiveTo: true,
    },
  },
} satisfies Prisma.ProductSelect;

const versionDetailSelect = {
  id: true,
  productId: true,
  versionNumber: true,
  status: true,
  outputQuantity: true,
  effectiveFrom: true,
  effectiveTo: true,
  preparationNotes: true,
  outputUnit: {
    select: { id: true, code: true, name: true, dimension: true },
  },
  materials: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      materialId: true,
      quantity: true,
      position: true,
      notes: true,
      unit: { select: { id: true, code: true, name: true, dimension: true } },
      material: {
        select: {
          id: true,
          name: true,
          kind: true,
          isActive: true,
          baseUnit: {
            select: { id: true, code: true, name: true, dimension: true },
          },
        },
      },
    },
  },
  laborOperations: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      laborRoleId: true,
      operationName: true,
      durationMinutes: true,
      workersCount: true,
      position: true,
      notes: true,
      laborRole: {
        select: { id: true, name: true, isActive: true },
      },
    },
  },
} satisfies Prisma.RecipeVersionSelect;

type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;
type VersionDetailRecord = Prisma.RecipeVersionGetPayload<{
  select: typeof versionDetailSelect;
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(bakeryId: string, query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {
      bakeryId,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: productSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const publishedByProduct = await this.latestPublishedSummaries(
      bakeryId,
      products.map((product) => product.id),
    );

    return {
      items: products.map((product) =>
        serializeProduct(product, publishedByProduct.get(product.id)),
      ),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createProduct(bakeryId: string, input: CreateProductDto) {
    await this.requireActiveUnit(input.salesUnitId);
    try {
      const product = await this.prisma.product.create({
        data: {
          bakeryId,
          name: input.name,
          description: normalizeText(input.description),
          salesUnitId: input.salesUnitId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          salesUnit: {
            select: { id: true, code: true, name: true, dimension: true },
          },
        },
      });
      return { ...product, recipeSummary: emptyRecipeSummary() };
    } catch (error) {
      this.throwIfUniqueConflict(error, 'A product with this name already exists.');
      throw error;
    }
  }

  async getProduct(bakeryId: string, id: string) {
    const product = await this.findProduct(bakeryId, id, PRODUCT_DETAIL_SELECT);
    const published = product.recipeVersions[0];
    const draft = await this.prisma.recipeVersion.findFirst({
      where: { bakeryId, productId: id, status: RecipeVersionStatus.DRAFT },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versions = await this.prisma.recipeVersion.count({
      where: { bakeryId, productId: id },
    });

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      status: product.status,
      salesUnit: product.salesUnit,
      recipeSummary: {
        draftVersionNumber: draft?.versionNumber ?? null,
        publishedVersion: published
          ? {
              versionNumber: published.versionNumber,
              outputQuantity: published.outputQuantity.toString(),
              outputUnit: published.outputUnit,
              effectiveFrom: formatDateOnly(published.effectiveFrom),
              effectiveTo: published.effectiveTo
                ? formatDateOnly(published.effectiveTo)
                : null,
            }
          : null,
        versionCount: versions,
        recipeStatus: draft
          ? 'DRAFT_AVAILABLE'
          : published
            ? 'PUBLISHED'
            : 'NO_RECIPE',
      },
    };
  }

  async updateProduct(
    bakeryId: string,
    id: string,
    input: UpdateProductDto,
  ) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one editable field is required.');
    }
    if (input.salesUnitId) {
      const selectedUnit = await this.requireActiveUnit(input.salesUnitId);
      const publishedVersions = await this.prisma.recipeVersion.findMany({
        where: {
          bakeryId,
          productId: id,
          status: RecipeVersionStatus.PUBLISHED,
        },
        select: { outputUnit: { select: { dimension: true } } },
      });
      if (
        publishedVersions.some(
          (version) => version.outputUnit.dimension !== selectedUnit.dimension,
        )
      ) {
        throw new BadRequestException(
          'The sales unit must remain compatible with every published recipe version.',
        );
      }
    }
    try {
      const product = await this.prisma.product.update({
        where: { id_bakeryId: { id, bakeryId } },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined
            ? {}
            : { description: normalizeText(input.description) }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.salesUnitId === undefined
            ? {}
            : { salesUnitId: input.salesUnitId }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          salesUnit: {
            select: { id: true, code: true, name: true, dimension: true },
          },
        },
      });
      return this.getProduct(bakeryId, product.id);
    } catch (error) {
      this.throwIfUniqueConflict(error, 'A product with this name already exists.');
      if (isRecordNotFound(error)) throw new NotFoundException('Product not found.');
      throw error;
    }
  }

  async listRecipeVersions(bakeryId: string, productId: string) {
    await this.requireProduct(bakeryId, productId);
    const versions = await this.prisma.recipeVersion.findMany({
      where: { bakeryId, productId },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        outputQuantity: true,
        outputUnit: { select: { id: true, code: true, name: true } },
        effectiveFrom: true,
        effectiveTo: true,
        _count: { select: { materials: true } },
      },
      orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
    });
    return versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      outputQuantity: version.outputQuantity.toString(),
      outputUnit: version.outputUnit,
      effectiveFrom: version.effectiveFrom
        ? formatDateOnly(version.effectiveFrom)
        : null,
      effectiveTo: version.effectiveTo
        ? formatDateOnly(version.effectiveTo)
        : null,
      materialCount: version._count.materials,
    }));
  }

  async createRecipeVersion(
    bakeryId: string,
    productId: string,
    input: CreateRecipeVersionDto,
  ) {
    await this.requireProduct(bakeryId, productId);
    try {
      const created = await this.prisma.$transaction(
        async (transaction) => {
          const latest = await transaction.recipeVersion.findFirst({
            where: { bakeryId, productId },
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true },
          });
          const published = await transaction.recipeVersion.findFirst({
            where: {
              bakeryId,
              productId,
              status: RecipeVersionStatus.PUBLISHED,
            },
            orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
            select: {
              outputQuantity: true,
              outputUnitId: true,
              preparationNotes: true,
              materials: {
                orderBy: [{ position: 'asc' }, { id: 'asc' }],
                select: {
                  materialId: true,
                  quantity: true,
                  unitId: true,
                  position: true,
                  notes: true,
                },
              },
              laborOperations: {
                orderBy: [{ position: 'asc' }, { id: 'asc' }],
                select: {
                  laborRoleId: true,
                  operationName: true,
                  durationMinutes: true,
                  workersCount: true,
                  position: true,
                  notes: true,
                },
              },
            },
          });

          const outputQuantity = published?.outputQuantity ??
            parsePositiveDecimal(input.outputQuantity, 'outputQuantity');
          const outputUnitId = published?.outputUnitId ?? input.outputUnitId;
          if (!outputUnitId) {
            throw new BadRequestException(
              'outputUnitId is required for the first recipe version.',
            );
          }
          await this.requireActiveUnit(outputUnitId);
          if (published?.outputUnitId === undefined && input.outputQuantity === undefined) {
            throw new BadRequestException(
              'outputQuantity is required for the first recipe version.',
            );
          }

          const version = await transaction.recipeVersion.create({
            data: {
              bakeryId,
              productId,
              versionNumber: (latest?.versionNumber ?? 0) + 1,
              outputQuantity,
              outputUnitId,
              preparationNotes:
                published?.preparationNotes ??
                normalizeText(input.preparationNotes),
              ...(published && published.materials.length > 0
                ? {
                    materials: {
                      create: published.materials.map((line) => ({
                        materialId: line.materialId,
                        quantity: line.quantity,
                        unitId: line.unitId,
                        position: line.position,
                        notes: line.notes,
                      })),
                    },
                  }
                : {}),
              ...(published && published.laborOperations.length > 0
                ? {
                    laborOperations: {
                      create: published.laborOperations.map((operation) => ({
                        laborRoleId: operation.laborRoleId,
                        operationName: operation.operationName,
                        durationMinutes: operation.durationMinutes,
                        workersCount: operation.workersCount,
                        position: operation.position,
                        notes: operation.notes,
                      })),
                    },
                  }
                : {}),
            },
            select: { id: true, versionNumber: true },
          });
          return {
            ...version,
            clonedFromPublished: Boolean(published),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return created;
    } catch (error) {
      this.throwIfVersionConflict(error);
      throw error;
    }
  }

  async getRecipeVersion(
    bakeryId: string,
    productId: string,
    versionId: string,
  ) {
    await this.requireProduct(bakeryId, productId);
    const version = await this.findVersion(bakeryId, productId, versionId);
    return serializeVersion(version);
  }

  async updateRecipeVersion(
    bakeryId: string,
    productId: string,
    versionId: string,
    input: UpdateRecipeVersionDto,
  ) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one editable field is required.');
    }
    const version = await this.findVersion(bakeryId, productId, versionId);
    this.requireDraft(version);
    if (input.outputQuantity !== undefined) {
      parsePositiveDecimal(input.outputQuantity, 'outputQuantity');
    }
    if (input.outputUnitId) await this.requireActiveUnit(input.outputUnitId);
    await this.prisma.recipeVersion.updateMany({
      where: {
        id: versionId,
        bakeryId,
        productId,
        status: RecipeVersionStatus.DRAFT,
      },
      data: {
        ...(input.outputQuantity === undefined
          ? {}
          : { outputQuantity: new Prisma.Decimal(input.outputQuantity) }),
        ...(input.outputUnitId === undefined
          ? {}
          : { outputUnitId: input.outputUnitId }),
        ...(input.preparationNotes === undefined
          ? {}
          : { preparationNotes: normalizeText(input.preparationNotes) }),
      },
    }).then((result) => {
      if (result.count !== 1) {
        throw new ConflictException('The recipe version changed; reload it and retry.');
      }
    });
    return this.getRecipeVersion(bakeryId, productId, versionId);
  }

  async replaceRecipeMaterials(
    bakeryId: string,
    productId: string,
    versionId: string,
    items: RecipeMaterialInputDto[],
  ) {
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const version = await transaction.recipeVersion.findFirst({
            where: { id: versionId, bakeryId, productId },
            select: { id: true, status: true },
          });
          if (!version) throw new NotFoundException('Recipe version not found.');
          this.requireDraft(version);
          await this.validateRecipeMaterials(transaction, bakeryId, items);

          await transaction.recipeMaterial.deleteMany({
            where: { bakeryId, recipeVersionId: versionId },
          });
          if (items.length > 0) {
            await transaction.recipeMaterial.createMany({
              data: items.map((item, position) => ({
                bakeryId,
                recipeVersionId: versionId,
                materialId: item.materialId,
                quantity: new Prisma.Decimal(item.quantity),
                unitId: item.unitId,
                position,
                notes: normalizeText(item.notes),
              })),
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwIfVersionConflict(error);
      throw error;
    }
    return this.getRecipeVersion(bakeryId, productId, versionId);
  }

  async publishRecipeVersion(
    bakeryId: string,
    productId: string,
    versionId: string,
    input: PublishRecipeVersionDto,
  ) {
    const effectiveFrom = parseDateOnly(input.effectiveFrom);
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const product = await transaction.product.findFirst({
            where: { id: productId, bakeryId },
            select: {
              id: true,
              salesUnit: {
                select: {
                  dimension: true,
                  isActive: true,
                },
              },
            },
          });
          if (!product) throw new NotFoundException('Product not found.');
          const version = await transaction.recipeVersion.findFirst({
            where: { id: versionId, bakeryId, productId },
            select: {
              id: true,
              status: true,
              outputQuantity: true,
              outputUnit: { select: { dimension: true, isActive: true } },
              materials: {
                select: { materialId: true, quantity: true, unitId: true },
              },
            },
          });
          if (!version) throw new NotFoundException('Recipe version not found.');
          this.requireDraft(version);
          if (
            !product.salesUnit.isActive ||
            !version.outputUnit.isActive ||
            product.salesUnit.dimension !== version.outputUnit.dimension
          ) {
            throw new BadRequestException(
              'The output unit must be active and compatible with the product sales unit.',
            );
          }
          if (
            !version.outputQuantity.isFinite() ||
            version.outputQuantity.lte(0)
          ) {
            throw new BadRequestException(
              'Recipe output quantity must be greater than zero.',
            );
          }
          if (version.materials.length === 0) {
            throw new BadRequestException(
              'A recipe needs at least one active material to be published.',
            );
          }
          await this.validateRecipeMaterials(
            transaction,
            bakeryId,
            version.materials.map((line) => ({
              materialId: line.materialId,
              quantity: line.quantity.toString(),
              unitId: line.unitId,
            })),
          );

          const latest = await transaction.recipeVersion.findFirst({
            where: {
              bakeryId,
              productId,
              status: RecipeVersionStatus.PUBLISHED,
            },
            orderBy: [{ effectiveFrom: 'desc' }, { versionNumber: 'desc' }],
            select: {
              id: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          });
          if (latest) {
            if (
              !latest.effectiveFrom ||
              effectiveFrom <= latest.effectiveFrom ||
              (latest.effectiveTo && effectiveFrom <= latest.effectiveTo)
            ) {
              throw new BadRequestException(
                'Publication date must be after the latest published period and cannot overlap it.',
              );
            }
            if (latest.effectiveTo === null) {
              const closed = await transaction.recipeVersion.updateMany({
                where: {
                  id: latest.id,
                  bakeryId,
                  productId,
                  status: RecipeVersionStatus.PUBLISHED,
                  effectiveTo: null,
                },
                data: { effectiveTo: addUtcDays(effectiveFrom, -1) },
              });
              if (closed.count !== 1) {
                throw new ConflictException(
                  'The published recipe changed; reload the product and retry.',
                );
              }
            }
          }

          const published = await transaction.recipeVersion.updateMany({
            where: {
              id: versionId,
              bakeryId,
              productId,
              status: RecipeVersionStatus.DRAFT,
            },
            data: {
              status: RecipeVersionStatus.PUBLISHED,
              effectiveFrom,
              effectiveTo: null,
            },
          });
          if (published.count !== 1) {
            throw new ConflictException(
              'The recipe version changed; reload it before publishing.',
            );
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwIfVersionConflict(error);
      throw error;
    }
    return this.getRecipeVersion(bakeryId, productId, versionId);
  }

  private async latestPublishedSummaries(
    bakeryId: string,
    productIds: string[],
  ) {
    if (productIds.length === 0) return new Map<string, PublishedSummary>();
    const rows = await this.prisma.recipeVersion.findMany({
      where: {
        bakeryId,
        productId: { in: productIds },
        status: RecipeVersionStatus.PUBLISHED,
        effectiveFrom: { lte: startOfUtcDay(new Date()) },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: startOfUtcDay(new Date()) } },
        ],
      },
      select: {
        productId: true,
        versionNumber: true,
        effectiveFrom: true,
        effectiveTo: true,
        outputQuantity: true,
        outputUnit: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { productId: 'asc' },
        { effectiveFrom: 'desc' },
        { versionNumber: 'desc' },
      ],
    });
    const result = new Map<string, PublishedSummary>();
    for (const row of rows) {
      if (!result.has(row.productId)) {
        result.set(row.productId, {
          versionNumber: row.versionNumber,
          effectiveFrom: row.effectiveFrom
            ? formatDateOnly(row.effectiveFrom)
            : null,
          effectiveTo: row.effectiveTo
            ? formatDateOnly(row.effectiveTo)
            : null,
          outputQuantity: row.outputQuantity.toString(),
          outputUnit: row.outputUnit,
        });
      }
    }
    return result;
  }

  private async findProduct(
    bakeryId: string,
    id: string,
    select: typeof PRODUCT_DETAIL_SELECT,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, bakeryId },
      select,
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private async requireProduct(bakeryId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, bakeryId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private async findVersion(
    bakeryId: string,
    productId: string,
    versionId: string,
  ): Promise<VersionDetailRecord> {
    const version = await this.prisma.recipeVersion.findFirst({
      where: { id: versionId, productId, bakeryId },
      select: versionDetailSelect,
    });
    if (!version) throw new NotFoundException('Recipe version not found.');
    return version;
  }

  private async requireActiveUnit(id: string) {
    const unit = await this.prisma.measurementUnit.findFirst({
      where: { id, isActive: true },
      select: { id: true, dimension: true },
    });
    if (!unit) {
      throw new BadRequestException('The selected unit does not exist or is inactive.');
    }
    return unit;
  }

  private async validateRecipeMaterials(
    transaction: Prisma.TransactionClient,
    bakeryId: string,
    items: Array<Pick<RecipeMaterialInputDto, 'materialId' | 'quantity' | 'unitId'>>,
  ) {
    const materialIds = items.map((item) => item.materialId);
    if (new Set(materialIds).size !== materialIds.length) {
      throw new BadRequestException(
        'A material can appear only once in a recipe.',
      );
    }
    for (const item of items) {
      parsePositiveDecimal(item.quantity, 'quantity');
    }
    if (items.length === 0) return;

    const [materials, units] = await Promise.all([
      transaction.material.findMany({
        where: {
          bakeryId,
          id: { in: materialIds },
          isActive: true,
        },
        select: {
          id: true,
          baseUnit: { select: { dimension: true } },
        },
      }),
      transaction.measurementUnit.findMany({
        where: {
          id: { in: [...new Set(items.map((item) => item.unitId))] },
          isActive: true,
        },
        select: { id: true, dimension: true },
      }),
    ]);
    const materialsById = new Map(materials.map((material) => [material.id, material]));
    const unitsById = new Map(units.map((unit) => [unit.id, unit]));
    if (materialsById.size !== new Set(materialIds).size) {
      throw new BadRequestException(
        'Every recipe material must be active and belong to this bakery.',
      );
    }
    if (unitsById.size !== new Set(items.map((item) => item.unitId)).size) {
      throw new BadRequestException(
        'Every recipe unit must exist and be active.',
      );
    }
    for (const item of items) {
      const material = materialsById.get(item.materialId);
      const unit = unitsById.get(item.unitId);
      if (
        !material ||
        !unit ||
        material.baseUnit.dimension !== unit.dimension
      ) {
        throw new BadRequestException(
          'Each ingredient unit must have the same dimension as its material base unit.',
        );
      }
    }
  }

  private requireDraft(version: { status: RecipeVersionStatus }) {
    if (version.status !== RecipeVersionStatus.DRAFT) {
      throw new ConflictException('Only a draft recipe version can be changed.');
    }
  }

  private throwIfUniqueConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }

  private throwIfVersionConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      throw new ConflictException(
        'A concurrent recipe version change occurred. Reload the product and retry.',
      );
    }
  }
}

type PublishedSummary = {
  versionNumber: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  outputQuantity: string;
  outputUnit: { id: string; code: string; name: string };
};

function serializeProduct(
  product: ProductRecord,
  published: PublishedSummary | undefined,
) {
  const draftVersionNumber = product.recipeVersions[0]?.versionNumber ?? null;
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    status: product.status,
    salesUnit: product.salesUnit,
    recipeSummary: {
      draftVersionNumber,
      publishedVersion: published ?? null,
      recipeStatus: draftVersionNumber
        ? 'DRAFT_AVAILABLE'
        : published
          ? 'PUBLISHED'
          : 'NO_RECIPE',
    },
  };
}

function serializeVersion(version: VersionDetailRecord) {
  return {
    id: version.id,
    productId: version.productId,
    versionNumber: version.versionNumber,
    status: version.status,
    outputQuantity: version.outputQuantity.toString(),
    outputUnit: version.outputUnit,
    effectiveFrom: version.effectiveFrom
      ? formatDateOnly(version.effectiveFrom)
      : null,
    effectiveTo: version.effectiveTo
      ? formatDateOnly(version.effectiveTo)
      : null,
    preparationNotes: version.preparationNotes,
    materials: version.materials.map((line) => ({
      id: line.id,
      materialId: line.materialId,
      material: line.material,
      quantity: line.quantity.toString(),
      unit: line.unit,
      position: line.position,
      notes: line.notes,
    })),
    laborOperations: version.laborOperations.map((operation) => ({
      id: operation.id,
      laborRoleId: operation.laborRoleId,
      laborRole: operation.laborRole,
      operationName: operation.operationName,
      durationMinutes: operation.durationMinutes.toString(),
      workersCount: operation.workersCount.toString(),
      position: operation.position,
      notes: operation.notes,
    })),
  };
}

function emptyRecipeSummary() {
  return {
    draftVersionNumber: null,
    publishedVersion: null,
    versionCount: 0,
    recipeStatus: 'NO_RECIPE' as const,
  };
}

function parsePositiveDecimal(value: string | undefined, field: string) {
  if (value === undefined) {
    throw new BadRequestException(`${field} is required.`);
  }
  const decimal = new Prisma.Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new BadRequestException(`${field} must be greater than zero.`);
  }
  return decimal;
}

function normalizeText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('effectiveFrom must use YYYY-MM-DD format.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || formatDateOnly(date) !== value) {
    throw new BadRequestException('effectiveFrom must be a valid calendar date.');
  }
  return date;
}

function formatDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
