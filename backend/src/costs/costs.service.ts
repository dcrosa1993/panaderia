import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCostCalculationDto } from './costs.dto.js';

const calculationInclude = {
  product: {
    select: {
      id: true,
      name: true,
      salesUnit: {
        select: {
          id: true,
          code: true,
          name: true,
          dimension: true,
          conversionFactor: true,
          isActive: true,
        },
      },
    },
  },
  recipeVersion: {
    include: {
      outputUnit: {
        select: {
          id: true,
          code: true,
          name: true,
          dimension: true,
          conversionFactor: true,
          isActive: true,
        },
      },
      materials: {
        orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
        include: {
          unit: {
            select: {
              id: true,
              code: true,
              name: true,
              dimension: true,
              conversionFactor: true,
              isActive: true,
            },
          },
          material: {
            include: {
              baseUnit: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  dimension: true,
                  conversionFactor: true,
                  isActive: true,
                },
              },
              prices: true,
            },
          },
        },
      },
      laborOperations: {
        orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
        include: {
          laborRole: {
            include: { rates: true },
          },
        },
      },
    },
  },
  lines: { orderBy: [{ lineType: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.CostCalculationInclude;

@Injectable()
export class CostsService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(
    bakeryId: string,
    userId: string,
    productId: string,
    input: CreateCostCalculationDto,
  ) {
    const valuationDate = parseDateOnly(input.valuationDate, 'valuationDate');
    const product = await this.prisma.product.findFirst({
      where: { bakeryId, id: productId },
      select: {
        id: true,
        name: true,
        salesUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            dimension: true,
            conversionFactor: true,
            isActive: true,
          },
        },
        recipeVersions: {
          where: {
            status: 'PUBLISHED',
            ...(input.recipeVersionId ? { id: input.recipeVersionId } : {}),
            effectiveFrom: { lte: valuationDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: valuationDate } }],
          },
          select: { id: true },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    if (input.recipeVersionId && product.recipeVersions.length === 0) {
      throw new NotFoundException(
        'Published recipe version not found for this product and valuation date.',
      );
    }
    if (product.recipeVersions.length === 0) {
      throw new NotFoundException(
        'No published recipe version is effective on the valuation date.',
      );
    }
    if (product.recipeVersions.length > 1) {
      throw new ConflictException(
        'More than one published recipe version is effective on the valuation date.',
      );
    }

    const recipe = await this.prisma.recipeVersion.findFirst({
      where: {
        bakeryId,
        productId,
        id: product.recipeVersions[0].id,
        status: 'PUBLISHED',
      },
      include: {
        outputUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            dimension: true,
            conversionFactor: true,
            isActive: true,
          },
        },
        materials: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          include: {
            unit: {
              select: {
                id: true,
                code: true,
                name: true,
                dimension: true,
                conversionFactor: true,
                isActive: true,
              },
            },
            material: {
              include: {
                baseUnit: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    dimension: true,
                    conversionFactor: true,
                    isActive: true,
                  },
                },
                prices: {
                  where: {
                    bakeryId,
                    effectiveFrom: { lte: valuationDate },
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gte: valuationDate } },
                    ],
                  },
                  include: {
                    packageUnit: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        dimension: true,
                        conversionFactor: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        laborOperations: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          include: {
            laborRole: {
              include: {
                rates: {
                  where: {
                    bakeryId,
                    effectiveFrom: { lte: valuationDate },
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gte: valuationDate } },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe version not found.');
    const overheadExpenses = await this.prisma.overheadExpense.findMany({
      where: {
        bakeryId,
        periodStart: { lte: valuationDate },
        periodEnd: { gte: valuationDate },
      },
      include: {
        allocationUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            dimension: true,
            conversionFactor: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const allOverheadsCount = overheadExpenses.length
      ? overheadExpenses.length
      : await this.prisma.overheadExpense.count({ where: { bakeryId } });
    return this.persistCalculation({
      bakeryId,
      userId,
      product,
      recipe,
      valuationDate,
      overheadExpenses,
      anyOverheadConfigured: allOverheadsCount > 0,
    });
  }

  async list(bakeryId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, bakeryId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');
    const calculations = await this.prisma.costCalculation.findMany({
      where: { bakeryId, productId },
      select: {
        id: true,
        recipeVersionId: true,
        valuationDate: true,
        status: true,
        materialCostCUP: true,
        laborCostCUP: true,
        overheadCostCUP: true,
        totalProductionCostCUP: true,
        outputQuantity: true,
        outputUnitSnapshot: true,
        unitCostCUP: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return calculations.map(serializeCalculation);
  }

  async get(bakeryId: string, calculationId: string) {
    const calculation = await this.prisma.costCalculation.findFirst({
      where: { id: calculationId, bakeryId },
      include: calculationInclude,
    });
    if (!calculation) throw new NotFoundException('Cost calculation not found.');
    return serializeCalculation(calculation);
  }

  private async persistCalculation(args: {
    bakeryId: string;
    userId: string;
    product: {
      id: string;
      name: string;
      salesUnit: {
        id: string;
        code: string;
        name: string;
        dimension: string;
        conversionFactor: Prisma.Decimal;
        isActive: boolean;
      };
    };
    recipe: Awaited<ReturnType<CostsService['findRecipeForCalculation']>>;
    valuationDate: Date;
    overheadExpenses: Awaited<ReturnType<CostsService['findOverheads']>>;
    anyOverheadConfigured: boolean;
  }) {
    const reasons: IncompleteReason[] = [];
    const lines: LineInput[] = [];
    let allMaterialsComplete = args.recipe.materials.length > 0;
    let materialTotal = new Prisma.Decimal(0);
    if (args.recipe.materials.length === 0) {
      reasons.push(reason('MATERIAL', 'NO_RECIPE_MATERIALS', 'La receta no tiene materiales configurados.'));
    }
    for (const line of args.recipe.materials) {
      const material = line.material;
      const priceOptions = material.prices;
      if (!material.isActive || !line.unit.isActive || !material.baseUnit.isActive) {
        allMaterialsComplete = false;
        reasons.push(reason('MATERIAL', 'INACTIVE_INPUT', `Material o unidad inactiva: ${material.name}.`));
        continue;
      }
      if (priceOptions.length > 0 && !priceOptions[0].packageUnit.isActive) {
        allMaterialsComplete = false;
        reasons.push(reason('MATERIAL', 'INACTIVE_PRICE_UNIT', `La unidad del precio de compra está inactiva para ${material.name}.`));
        continue;
      }
      if (!line.quantity.isFinite() || line.quantity.lte(0)) {
        allMaterialsComplete = false;
        reasons.push(reason('MATERIAL', 'INVALID_QUANTITY', `Cantidad no válida para ${material.name}.`));
        continue;
      }
      if (priceOptions.length === 0) {
        allMaterialsComplete = false;
        reasons.push(reason('MATERIAL', 'MISSING_PRICE', `No hay precio vigente para ${material.name}.`));
        continue;
      }
      if (priceOptions.length > 1) {
        allMaterialsComplete = false;
        reasons.push(reason('MATERIAL', 'AMBIGUOUS_PRICE', `Hay varios precios vigentes para ${material.name}.`));
        continue;
      }
      const price = priceOptions[0];
      const recipeBaseQuantity = convertQuantity(
        line.quantity,
        line.unit,
        material.baseUnit,
        material.densityGramPerMl,
      );
      const packageBaseQuantity = convertQuantity(
        price.packageQuantity,
        price.packageUnit,
        material.baseUnit,
        material.densityGramPerMl,
      );
      if (!recipeBaseQuantity || !packageBaseQuantity || packageBaseQuantity.lte(0)) {
        allMaterialsComplete = false;
        reasons.push(reason('MATERIAL', 'INCOMPATIBLE_UNITS', `No se puede convertir con seguridad las unidades de ${material.name}.`));
        continue;
      }
      const costPerBaseUnit = price.packagePriceCUP.div(packageBaseQuantity);
      const lineCost = recipeBaseQuantity.mul(costPerBaseUnit);
      materialTotal = materialTotal.add(money(lineCost));
      lines.push({
        lineType: 'MATERIAL',
        descriptionSnapshot: material.name,
        quantity: recipeBaseQuantity,
        unitNameSnapshot: material.baseUnit.code,
        unitCostCUP: costPerBaseUnit,
        totalCUP: money(lineCost),
        detailsSnapshot: {
          materialId: material.id,
          recipeMaterialId: line.id,
          materialPriceId: price.id,
          packagePriceCUP: price.packagePriceCUP.toString(),
          packageQuantityInBaseUnit: packageBaseQuantity.toString(),
          packageQuantityOriginal: price.packageQuantity.toString(),
          packageUnit: {
            id: price.packageUnit.id,
            code: price.packageUnit.code,
            conversionFactor: price.packageUnit.conversionFactor.toString(),
          },
          recipeQuantityOriginal: line.quantity.toString(),
          recipeUnit: {
            id: line.unit.id,
            code: line.unit.code,
            conversionFactor: line.unit.conversionFactor.toString(),
          },
          baseUnit: {
            id: material.baseUnit.id,
            code: material.baseUnit.code,
            conversionFactor: material.baseUnit.conversionFactor.toString(),
          },
          densityGramPerMl: material.densityGramPerMl?.toString() ?? null,
        },
      });
    }

    let allLaborComplete = args.recipe.laborOperations.length > 0;
    let laborTotal = new Prisma.Decimal(0);
    let laborMinutes = new Prisma.Decimal(0);
    if (args.recipe.laborOperations.length === 0) {
      reasons.push(reason('LABOR', 'NO_LABOR_OPERATIONS', 'No hay operaciones de mano de obra configuradas.'));
    }
    for (const operation of args.recipe.laborOperations) {
      const role = operation.laborRole;
      const rates = role.rates;
      if (!role.isActive || !operation.durationMinutes.isFinite() || operation.durationMinutes.lte(0) || !operation.workersCount.isFinite() || operation.workersCount.lte(0)) {
        allLaborComplete = false;
        reasons.push(reason('LABOR', 'INVALID_LABOR_INPUT', `Puesto inactivo o duración/cantidad no válida: ${operation.operationName}.`));
        continue;
      }
      if (rates.length !== 1) {
        allLaborComplete = false;
        reasons.push(reason('LABOR', rates.length === 0 ? 'MISSING_LABOR_RATE' : 'AMBIGUOUS_LABOR_RATE', rates.length === 0 ? `No hay tarifa vigente para ${role.name}.` : `Hay tarifas vigentes superpuestas para ${role.name}.`));
        continue;
      }
      const rate = rates[0];
      const operationCost = rate.hourlyRateCUP.mul(operation.durationMinutes).div(60).mul(operation.workersCount);
      laborTotal = laborTotal.add(money(operationCost));
      laborMinutes = laborMinutes.add(operation.durationMinutes.mul(operation.workersCount));
      lines.push({
        lineType: 'LABOR',
        descriptionSnapshot: `${operation.operationName} — ${role.name}`,
        quantity: operation.durationMinutes.mul(operation.workersCount),
        unitNameSnapshot: 'min',
        unitCostCUP: rate.hourlyRateCUP.div(60),
        totalCUP: money(operationCost),
        detailsSnapshot: {
          recipeLaborOperationId: operation.id,
          laborRoleId: role.id,
          laborRoleName: role.name,
          durationMinutes: operation.durationMinutes.toString(),
          workersCount: operation.workersCount.toString(),
          hourlyRateCUP: rate.hourlyRateCUP.toString(),
          laborRateId: rate.id,
        },
      });
    }

    const outputQuantity = args.recipe.outputQuantity;
    const outputInSalesUnits = convertQuantity(
      outputQuantity,
      args.recipe.outputUnit,
      args.product.salesUnit,
      null,
    );
    if (!args.recipe.outputUnit.isActive || !args.product.salesUnit.isActive || outputQuantity.lte(0) || !outputInSalesUnits || outputInSalesUnits.lte(0)) {
      reasons.push(reason('OUTPUT', 'INVALID_OUTPUT_CONVERSION', 'No se puede convertir el rendimiento de la receta a la unidad comercial del producto.'));
    }

    let allOverheadComplete = args.overheadExpenses.length > 0;
    let overheadTotal = new Prisma.Decimal(0);
    const directCost = allMaterialsComplete && allLaborComplete
      ? materialTotal.add(laborTotal)
      : null;
    if (args.overheadExpenses.length === 0) {
      reasons.push(reason(
        'OVERHEAD',
        args.anyOverheadConfigured ? 'NO_OVERHEAD_FOR_DATE' : 'NO_OVERHEAD_CONFIGURED',
        args.anyOverheadConfigured
          ? 'No hay gastos indirectos configurados para esta fecha; existen gastos en otros períodos.'
          : 'No hay gastos indirectos configurados para esta fecha.',
      ));
    }
    for (const expense of args.overheadExpenses) {
      const base = expense.allocationBaseQuantity;
      let allocation: Prisma.Decimal | null = null;
      if (!base || !base.isFinite() || base.lte(0)) {
        allocation = null;
      } else if (expense.allocationMethod === 'BATCHES') {
        allocation = expense.amountCUP.div(base);
      } else if (expense.allocationMethod === 'LABOR_HOURS' && expense.allocationUnit?.isActive && expense.allocationUnit.dimension === 'TIME') {
        const periodMinutes = base.mul(expense.allocationUnit.conversionFactor);
        if (periodMinutes.gt(0)) allocation = expense.amountCUP.mul(laborMinutes.div(60)).div(periodMinutes.div(60));
      } else if (expense.allocationMethod === 'OUTPUT_QUANTITY' && expense.allocationUnit?.isActive && outputInSalesUnits) {
        const outputForAllocation = convertQuantity(
          outputInSalesUnits,
          args.product.salesUnit,
          expense.allocationUnit,
          null,
        );
        if (outputForAllocation) allocation = expense.amountCUP.mul(outputForAllocation).div(base);
      } else if (expense.allocationMethod === 'DIRECT_COST_PROPORTION' && !expense.allocationUnitId && directCost?.gt(0)) {
        allocation = expense.amountCUP.mul(directCost).div(base);
      }
      if (!allocation || !allocation.isFinite()) {
        allOverheadComplete = false;
        reasons.push(reason('OVERHEAD', 'UNALLOCATABLE_EXPENSE', `No se puede asignar el gasto indirecto «${expense.name}» con su base/unidad configurada.`));
        continue;
      }
      overheadTotal = overheadTotal.add(money(allocation));
      lines.push({
        lineType: 'OVERHEAD',
        descriptionSnapshot: expense.name,
        quantity: new Prisma.Decimal(1),
        unitNameSnapshot: 'lote',
        unitCostCUP: allocation,
        totalCUP: money(allocation),
        detailsSnapshot: {
          overheadExpenseId: expense.id,
          category: expense.category,
          allocationMethod: expense.allocationMethod,
          expenseAmountCUP: expense.amountCUP.toString(),
          allocationBaseQuantity: base?.toString() ?? null,
          allocationUnit: expense.allocationUnit
            ? {
                id: expense.allocationUnit.id,
                code: expense.allocationUnit.code,
                conversionFactor: expense.allocationUnit.conversionFactor.toString(),
              }
            : null,
          periodStart: expense.periodStart.toISOString().slice(0, 10),
          periodEnd: expense.periodEnd.toISOString().slice(0, 10),
          allocatedAmountCUP: allocation.toString(),
        },
      });
    }

    const materialCost = allMaterialsComplete ? money(materialTotal) : null;
    const laborCost = allLaborComplete ? money(laborTotal) : null;
    const overheadCost = allOverheadComplete ? money(overheadTotal) : null;
    const complete = materialCost !== null && laborCost !== null && overheadCost !== null && outputInSalesUnits !== null;
    const total = complete
      ? money(materialTotal.add(laborTotal).add(overheadTotal))
      : null;
    const unitCost = total !== null && outputInSalesUnits
      ? total.div(outputInSalesUnits).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
      : null;

    const created = await this.prisma.$transaction(async (transaction) => {
      const calculation = await transaction.costCalculation.create({
        data: {
          bakeryId: args.bakeryId,
          productId: args.product.id,
          recipeVersionId: args.recipe.id,
          createdByUserId: args.userId,
          valuationDate: args.valuationDate,
          status: complete ? 'COMPLETE' : 'INCOMPLETE',
          materialCostCUP: materialCost,
          laborCostCUP: laborCost,
          overheadCostCUP: overheadCost,
          totalProductionCostCUP: total,
          outputQuantity: outputInSalesUnits,
          outputUnitSnapshot: args.product.salesUnit.code,
          unitCostCUP: unitCost,
          incompleteReasons: reasons as Prisma.InputJsonValue,
          inputSnapshot: {
            product: { id: args.product.id, name: args.product.name },
            recipeVersion: {
              id: args.recipe.id,
              versionNumber: args.recipe.versionNumber,
              outputQuantity: args.recipe.outputQuantity.toString(),
              outputUnit: args.recipe.outputUnit.code,
              effectiveFrom: args.recipe.effectiveFrom?.toISOString().slice(0, 10) ?? null,
              effectiveTo: args.recipe.effectiveTo?.toISOString().slice(0, 10) ?? null,
            },
            valuationDate: args.valuationDate.toISOString().slice(0, 10),
            salesUnit: args.product.salesUnit.code,
            salesUnitId: args.product.salesUnit.id,
            salesUnitConversionFactor: args.product.salesUnit.conversionFactor.toString(),
            outputQuantityInSalesUnits: outputInSalesUnits?.toString() ?? null,
            outputUnitId: args.recipe.outputUnit.id,
            outputUnitConversionFactor: args.recipe.outputUnit.conversionFactor.toString(),
          },
          lines: { create: lines.map(line => ({ ...line, bakeryId: args.bakeryId })) },
        },
        include: calculationInclude,
      });
      return calculation;
    });
    return serializeCalculation(created);
  }

  private findRecipeForCalculation(_id: string) {
    return this.prisma.recipeVersion.findFirstOrThrow({
      where: { id: _id },
      include: {
        outputUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            dimension: true,
            conversionFactor: true,
            isActive: true,
          },
        },
        materials: {
          include: {
            unit: {
              select: {
                id: true,
                code: true,
                name: true,
                dimension: true,
                conversionFactor: true,
                isActive: true,
              },
            },
            material: {
              include: {
                baseUnit: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    dimension: true,
                    conversionFactor: true,
                    isActive: true,
                  },
                },
                prices: { include: { packageUnit: true } },
              },
            },
          },
        },
        laborOperations: {
          include: { laborRole: { include: { rates: true } } },
        },
      },
    });
  }

  private findOverheads(_id: string) {
    return this.prisma.overheadExpense.findMany({
      where: { bakeryId: _id },
      include: { allocationUnit: { select: { id: true, code: true, name: true, dimension: true, conversionFactor: true, isActive: true } } },
    });
  }
}

type IncompleteReason = { category: string; code: string; message: string };
type LineInput = {
  lineType: 'MATERIAL' | 'LABOR' | 'OVERHEAD';
  descriptionSnapshot: string;
  quantity: Prisma.Decimal | null;
  unitNameSnapshot: string | null;
  unitCostCUP: Prisma.Decimal | null;
  totalCUP: Prisma.Decimal | null;
  detailsSnapshot: Prisma.InputJsonValue;
};

function reason(category: string, code: string, message: string): IncompleteReason {
  return { category, code, message };
}

export function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function convertQuantity(
  quantity: Prisma.Decimal,
  from: { dimension: string; conversionFactor: Prisma.Decimal; isActive: boolean },
  to: { dimension: string; conversionFactor: Prisma.Decimal; isActive: boolean },
  density: Prisma.Decimal | null,
): Prisma.Decimal | null {
  if (!from.isActive || !to.isActive || from.conversionFactor.lte(0) || to.conversionFactor.lte(0)) return null;
  if (from.dimension === to.dimension) {
    return quantity.mul(from.conversionFactor).div(to.conversionFactor);
  }
  if (!density || !density.isFinite() || density.lte(0)) return null;
  if (from.dimension === 'MASS' && to.dimension === 'VOLUME') {
    return quantity.mul(from.conversionFactor).div(density).div(to.conversionFactor);
  }
  if (from.dimension === 'VOLUME' && to.dimension === 'MASS') {
    return quantity.mul(from.conversionFactor).mul(density).div(to.conversionFactor);
  }
  return null;
}

function parseDateOnly(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!DATE_ONLY.test(value) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid YYYY-MM-DD calendar date.`);
  }
  return date;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function serializeCalculation<T extends {
  id: string;
  recipeVersionId: string;
  valuationDate: Date;
  status: string;
  materialCostCUP: Prisma.Decimal | null;
  laborCostCUP: Prisma.Decimal | null;
  overheadCostCUP: Prisma.Decimal | null;
  totalProductionCostCUP: Prisma.Decimal | null;
  outputQuantity: Prisma.Decimal | null;
  outputUnitSnapshot: string | null;
  unitCostCUP: Prisma.Decimal | null;
  incompleteReasons?: Prisma.JsonValue | null;
  inputSnapshot?: Prisma.JsonValue;
  createdAt?: Date;
  lines?: Array<{
    id: string;
    lineType: string;
    descriptionSnapshot: string;
    quantity: Prisma.Decimal | null;
    unitNameSnapshot: string | null;
    unitCostCUP: Prisma.Decimal | null;
    totalCUP: Prisma.Decimal | null;
    detailsSnapshot: Prisma.JsonValue | null;
  }>;
}> (item: T) {
  return {
    id: item.id,
    recipeVersionId: item.recipeVersionId,
    valuationDate: item.valuationDate.toISOString().slice(0, 10),
    status: item.status,
    materialCostCUP: item.materialCostCUP?.toString() ?? null,
    laborCostCUP: item.laborCostCUP?.toString() ?? null,
    overheadCostCUP: item.overheadCostCUP?.toString() ?? null,
    totalProductionCostCUP: item.totalProductionCostCUP?.toString() ?? null,
    outputQuantity: item.outputQuantity?.toString() ?? null,
    outputUnitSnapshot: item.outputUnitSnapshot,
    unitCostCUP: item.unitCostCUP?.toString() ?? null,
    incompleteReasons: item.incompleteReasons ?? [],
    inputSnapshot: item.inputSnapshot ?? null,
    createdAt: item.createdAt?.toISOString() ?? null,
    lines: item.lines?.map((line) => ({
      ...line,
      quantity: line.quantity?.toString() ?? null,
      unitCostCUP: line.unitCostCUP?.toString() ?? null,
      totalCUP: line.totalCUP?.toString() ?? null,
    })),
  };
}
