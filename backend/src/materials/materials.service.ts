import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  MeasurementDimension,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateMaterialDto,
  CreateMaterialPriceDto,
  ListMaterialsQueryDto,
  UpdateMaterialDto,
} from './materials.dto.js';

const currentMaterialSelect = {
  id: true,
  name: true,
  kind: true,
  baseUnitId: true,
  densityGramPerMl: true,
  isActive: true,
  baseUnit: {
    select: {
      id: true,
      code: true,
      name: true,
      dimension: true,
      conversionFactor: true,
    },
  },
} satisfies Prisma.MaterialSelect;

type MaterialRecord = Prisma.MaterialGetPayload<{
  select: typeof currentMaterialSelect;
}>;

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMeasurementUnits(dimension?: MeasurementDimension) {
    return this.prisma.measurementUnit.findMany({
      where: {
        isActive: true,
        ...(dimension ? { dimension } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        dimension: true,
        conversionFactor: true,
      },
      orderBy: [{ dimension: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async previewPrice(
    bakeryId: string,
    materialId: string,
    input: CreateMaterialPriceDto,
  ) {
    const material = await this.findMaterial(bakeryId, materialId);
    const packageUnit = await this.findActiveUnit(input.packageUnitId);
    if (packageUnit.dimension !== material.baseUnit.dimension) {
      throw new BadRequestException(
        `Package unit dimension ${packageUnit.dimension} does not match base unit dimension ${material.baseUnit.dimension}. Mass/volume conversions are not supported.`,
      );
    }

    const price = new Prisma.Decimal(input.packagePriceCUP);
    const quantity = new Prisma.Decimal(input.packageQuantity);
    if (!price.isFinite() || !quantity.isFinite() || price.lte(0) || quantity.lte(0)) {
      throw new BadRequestException(
        'Package price and quantity must be greater than zero.',
      );
    }
    const effectiveFrom = parseDateOnly(input.effectiveFrom, 'effectiveFrom');
    const effectiveTo =
      input.effectiveTo == null
        ? null
        : parseDateOnly(input.effectiveTo, 'effectiveTo');
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo must be on or after effectiveFrom.',
      );
    }

    const normalizedQuantityInBaseUnit = quantity
      .mul(packageUnit.conversionFactor)
      .div(material.baseUnit.conversionFactor);
    if (
      !normalizedQuantityInBaseUnit.isFinite() ||
      normalizedQuantityInBaseUnit.lte(0)
    ) {
      throw new BadRequestException(
        'Package quantity cannot be normalized to the material base unit.',
      );
    }

    return {
      packagePriceCUP: price.toString(),
      packageQuantity: quantity.toString(),
      packageUnit: serializeUnit(packageUnit),
      baseUnit: serializeUnit(material.baseUnit),
      normalizedQuantityInBaseUnit: normalizedQuantityInBaseUnit.toString(),
      pricePerBaseUnitCUP: price.div(normalizedQuantityInBaseUnit).toString(),
    };
  }

  async listMaterials(
    bakeryId: string,
    query: ListMaterialsQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.MaterialWhereInput = {
      bakeryId,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [total, materials] = await this.prisma.$transaction([
      this.prisma.material.count({ where }),
      this.prisma.material.findMany({
        where,
        select: currentMaterialSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const asOf = startOfUtcDay(new Date());

    return {
      items: await Promise.all(
        materials.map((material) => this.serializeMaterial(material, bakeryId, asOf)),
      ),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createMaterial(bakeryId: string, input: CreateMaterialDto) {
    const baseUnit = await this.findActiveUnit(input.baseUnitId);
    const material = await this.prisma.material.create({
      data: {
        bakeryId,
        name: input.name,
        kind: input.kind,
        baseUnitId: baseUnit.id,
        ...(input.densityGramPerMl === undefined
          ? {}
          : {
              densityGramPerMl:
                input.densityGramPerMl === null
                  ? null
                  : new Prisma.Decimal(input.densityGramPerMl),
            }),
      },
      select: currentMaterialSelect,
    });
    return this.serializeMaterial(material, bakeryId, startOfUtcDay(new Date()));
  }

  async getMaterial(bakeryId: string, id: string) {
    const material = await this.findMaterial(bakeryId, id);
    return this.serializeMaterial(material, bakeryId, startOfUtcDay(new Date()));
  }

  async updateMaterial(
    bakeryId: string,
    id: string,
    input: UpdateMaterialDto,
  ) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one editable field is required.');
    }
    const material = await this.findMaterial(bakeryId, id);
    if (input.baseUnitId && input.baseUnitId !== material.baseUnitId) {
      const activePrices = await this.prisma.materialPrice.count({
        where: { bakeryId, materialId: id },
      });
      if (activePrices > 0) {
        throw new BadRequestException(
          'The base unit cannot change after price history exists.',
        );
      }
    }

    if (input.baseUnitId) {
      await this.findActiveUnit(input.baseUnitId);
    }

    const updated = await this.prisma.material.update({
      where: { id_bakeryId: { id, bakeryId } },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.baseUnitId === undefined
          ? {}
          : { baseUnitId: input.baseUnitId }),
        ...(input.densityGramPerMl === undefined
          ? {}
          : {
              densityGramPerMl:
                input.densityGramPerMl === null
                  ? null
                  : new Prisma.Decimal(input.densityGramPerMl),
            }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: currentMaterialSelect,
    });
    return this.serializeMaterial(updated, bakeryId, startOfUtcDay(new Date()));
  }

  async listPrices(bakeryId: string, materialId: string) {
    const material = await this.findMaterial(bakeryId, materialId);
    const prices = await this.prisma.materialPrice.findMany({
      where: { bakeryId, materialId },
      select: {
        id: true,
        packagePriceCUP: true,
        packageQuantity: true,
        packageUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            dimension: true,
            conversionFactor: true,
          },
        },
        effectiveFrom: true,
        effectiveTo: true,
        sourceNote: true,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    return {
      material: {
        id: material.id,
        name: material.name,
        baseUnit: serializeUnit(material.baseUnit),
      },
      items: prices.map((price) => serializePrice(price, material.baseUnit)),
    };
  }

  async createPrice(
    bakeryId: string,
    materialId: string,
    input: CreateMaterialPriceDto,
  ) {
    const material = await this.findMaterial(bakeryId, materialId);
    if (!material.isActive) {
      throw new BadRequestException('Inactive materials cannot receive prices.');
    }

    const price = new Prisma.Decimal(input.packagePriceCUP);
    const quantity = new Prisma.Decimal(input.packageQuantity);
    if (!price.isFinite() || !quantity.isFinite() || price.lte(0) || quantity.lte(0)) {
      throw new BadRequestException(
        'Package price and quantity must be greater than zero.',
      );
    }

    const effectiveFrom = parseDateOnly(input.effectiveFrom, 'effectiveFrom');
    const effectiveTo =
      input.effectiveTo == null
        ? null
        : parseDateOnly(input.effectiveTo, 'effectiveTo');
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo must be on or after effectiveFrom.',
      );
    }

    const packageUnit = await this.findActiveUnit(input.packageUnitId);
    if (packageUnit.dimension !== material.baseUnit.dimension) {
      throw new BadRequestException(
        `Package unit dimension ${packageUnit.dimension} does not match base unit dimension ${material.baseUnit.dimension}. Mass/volume conversions are not supported.`,
      );
    }

    const normalizedQuantity = quantity
      .mul(packageUnit.conversionFactor)
      .div(material.baseUnit.conversionFactor);
    if (!normalizedQuantity.isFinite() || normalizedQuantity.lte(0)) {
      throw new BadRequestException(
        'Package quantity cannot be normalized to the material base unit.',
      );
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const latest = await transaction.materialPrice.findFirst({
          where: { bakeryId, materialId },
          orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
          select: { id: true, effectiveFrom: true, effectiveTo: true },
        });

        if (latest && effectiveFrom <= latest.effectiveFrom) {
          throw new BadRequestException(
            'Price periods must be added chronologically after the latest effectiveFrom.',
          );
        }

        if (
          latest &&
          latest.effectiveTo &&
          effectiveFrom <= latest.effectiveTo
        ) {
          throw new BadRequestException(
            'The new price period overlaps the latest recorded price.',
          );
        }

        if (latest && latest.effectiveTo === null) {
          const closesOn = addUtcDays(effectiveFrom, -1);
          if (closesOn < latest.effectiveFrom) {
            throw new BadRequestException(
              'The new price must begin after the current price start date.',
            );
          }
          await transaction.materialPrice.update({
            where: { id_bakeryId: { id: latest.id, bakeryId } },
            data: { effectiveTo: closesOn },
          });
        }

        const created = await transaction.materialPrice.create({
          data: {
            bakeryId,
            materialId,
            packagePriceCUP: price,
            packageQuantity: quantity,
            packageUnitId: packageUnit.id,
            effectiveFrom,
            effectiveTo,
            sourceNote: input.sourceNote?.trim() || null,
          },
          select: {
            id: true,
            packagePriceCUP: true,
            packageQuantity: true,
            packageUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                dimension: true,
                conversionFactor: true,
              },
            },
            effectiveFrom: true,
            effectiveTo: true,
            sourceNote: true,
          },
        });
        return serializePrice(created, material.baseUnit);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A price with this effective start date already exists.',
        );
      }
      throw error;
    }
  }

  private async findMaterial(
    bakeryId: string,
    id: string,
  ): Promise<MaterialRecord> {
    const material = await this.prisma.material.findUnique({
      where: { id_bakeryId: { id, bakeryId } },
      select: currentMaterialSelect,
    });
    if (!material) {
      throw new NotFoundException('Material not found.');
    }
    return material;
  }

  private async findActiveUnit(id: string) {
    const unit = await this.prisma.measurementUnit.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        dimension: true,
        conversionFactor: true,
      },
    });
    if (!unit) {
      throw new BadRequestException('The selected unit does not exist or is inactive.');
    }
    return unit;
  }

  private async serializeMaterial(
    material: MaterialRecord,
    bakeryId: string,
    asOf: Date,
  ) {
    const currentPrice = await this.prisma.materialPrice.findFirst({
      where: {
        bakeryId,
        materialId: material.id,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      select: {
        id: true,
        packagePriceCUP: true,
        packageQuantity: true,
        packageUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            dimension: true,
            conversionFactor: true,
          },
        },
        effectiveFrom: true,
        effectiveTo: true,
        sourceNote: true,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });

    return {
      id: material.id,
      name: material.name,
      kind: material.kind,
      isActive: material.isActive,
      densityGramPerMl: material.densityGramPerMl?.toString() ?? null,
      baseUnit: serializeUnit(material.baseUnit),
      currentPrice: currentPrice
        ? serializePrice(currentPrice, material.baseUnit)
        : null,
    };
  }
}

function serializeUnit(unit: {
  id: string;
  code: string;
  name: string;
  dimension: MeasurementDimension;
  conversionFactor: Prisma.Decimal;
}) {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    dimension: unit.dimension,
    conversionFactor: unit.conversionFactor.toString(),
  };
}

function serializePrice(
  price: {
    id: string;
    packagePriceCUP: Prisma.Decimal;
    packageQuantity: Prisma.Decimal;
    packageUnit: {
      id: string;
      code: string;
      name: string;
      dimension: MeasurementDimension;
      conversionFactor: Prisma.Decimal;
    };
    effectiveFrom: Date;
    effectiveTo: Date | null;
    sourceNote: string | null;
  },
  baseUnit: {
    id: string;
    code: string;
    name: string;
    dimension: MeasurementDimension;
    conversionFactor: Prisma.Decimal;
  },
) {
  const normalizedQuantityInBaseUnit = new Prisma.Decimal(
    price.packageQuantity,
  )
    .mul(price.packageUnit.conversionFactor)
    .div(baseUnit.conversionFactor);
  return {
    id: price.id,
    packagePriceCUP: price.packagePriceCUP.toString(),
    packageQuantity: price.packageQuantity.toString(),
    packageUnit: serializeUnit(price.packageUnit),
    effectiveFrom: formatDateOnly(price.effectiveFrom),
    effectiveTo: price.effectiveTo ? formatDateOnly(price.effectiveTo) : null,
    sourceNote: price.sourceNote,
    normalizedQuantityInBaseUnit: normalizedQuantityInBaseUnit.toString(),
    pricePerBaseUnitCUP: new Prisma.Decimal(price.packagePriceCUP)
      .div(normalizedQuantityInBaseUnit)
      .toString(),
    baseUnit: serializeUnit(baseUnit),
  };
}

function parseDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (formatDateOnly(date) !== value) {
    throw new BadRequestException(`${field} must be a valid calendar date.`);
  }
  return date;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
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
