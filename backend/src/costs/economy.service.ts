import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateLaborRateDto,
  CreateLaborRoleDto,
  CreateOverheadExpenseDto,
  RecipeLaborOperationInputDto,
  UpdateLaborRoleDto,
  UpdateOverheadExpenseDto,
} from './economy.dto.js';

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  listRoles(bakeryId: string) {
    const asOf = new Date();
    asOf.setUTCHours(0, 0, 0, 0);
    return this.prisma.laborRole.findMany({
      where: { bakeryId },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        rates: {
          where: {
            effectiveFrom: { lte: asOf },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
          },
          select: { hourlyRateCUP: true },
          take: 2,
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }).then((roles) => roles.map((role) => ({
      id: role.id,
      name: role.name,
      isActive: role.isActive,
      currentRate: role.rates.length === 1 ? role.rates[0].hourlyRateCUP.toString() : null,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    })));
  }

  async createRole(bakeryId: string, input: CreateLaborRoleDto) {
    try {
      return await this.prisma.laborRole.create({
        data: { bakeryId, name: input.name.trim() },
        select: { id: true, name: true, isActive: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) throw new ConflictException('Ya existe un puesto con ese nombre.');
      throw error;
    }
  }

  async getRole(bakeryId: string, id: string) {
    const role = await this.prisma.laborRole.findFirst({
      where: { id, bakeryId },
      select: {
        id: true, name: true, isActive: true, createdAt: true, updatedAt: true,
        rates: { select: { id: true, hourlyRateCUP: true, effectiveFrom: true, effectiveTo: true, notes: true }, orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }] },
      },
    });
    if (!role) throw new NotFoundException('Labor role not found.');
    return {
      ...role,
      rates: role.rates.map((rate) => ({
        ...rate,
        hourlyRateCUP: rate.hourlyRateCUP.toString(),
        effectiveFrom: formatDate(rate.effectiveFrom),
        effectiveTo: rate.effectiveTo ? formatDate(rate.effectiveTo) : null,
      })),
    };
  }

  async updateRole(bakeryId: string, id: string, input: UpdateLaborRoleDto) {
    if (Object.keys(input).length === 0) throw new BadRequestException('Indica al menos un campo para actualizar.');
    try {
      const updated = await this.prisma.laborRole.updateMany({
        where: { id, bakeryId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });
      if (!updated.count) throw new NotFoundException('Labor role not found.');
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) throw new ConflictException('Ya existe un puesto con ese nombre.');
      throw error;
    }
    return this.getRole(bakeryId, id);
  }

  async listRates(bakeryId: string, id: string) {
    await this.requireRole(bakeryId, id);
    const rates = await this.prisma.laborRate.findMany({
      where: { bakeryId, laborRoleId: id },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    return rates.map((rate) => ({
      id: rate.id,
      hourlyRateCUP: rate.hourlyRateCUP.toString(),
      effectiveFrom: formatDate(rate.effectiveFrom),
      effectiveTo: rate.effectiveTo ? formatDate(rate.effectiveTo) : null,
      notes: rate.notes,
    }));
  }

  async createRate(bakeryId: string, laborRoleId: string, input: CreateLaborRateDto) {
    const role = await this.requireRole(bakeryId, laborRoleId);
    if (!role.isActive) throw new BadRequestException('No se pueden añadir tarifas a un puesto inactivo.');
    const rate = new Prisma.Decimal(input.hourlyRateCUP);
    const effectiveFrom = parseDate(input.effectiveFrom, 'effectiveFrom');
    const effectiveTo = input.effectiveTo ? parseDate(input.effectiveTo, 'effectiveTo') : null;
    if (!rate.isFinite() || rate.lt(0)) throw new BadRequestException('La tarifa por hora no puede ser negativa.');
    if (effectiveTo && effectiveTo < effectiveFrom) throw new BadRequestException('effectiveTo debe ser igual o posterior a effectiveFrom.');
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.laborRate.findMany({
          where: { bakeryId, laborRoleId },
          orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
        });
        if (existing.some((item) => overlaps(effectiveFrom, effectiveTo, item.effectiveFrom, item.effectiveTo))) {
          const latest = existing[0];
          if (latest && latest.effectiveTo === null && effectiveFrom > latest.effectiveFrom) {
            const others = existing.slice(1);
            if (others.some((item) => overlaps(effectiveFrom, effectiveTo, item.effectiveFrom, item.effectiveTo))) {
              throw new ConflictException('El período de tarifa se solapa con otra tarifa existente.');
            }
            await tx.laborRate.updateMany({
              where: { id: latest.id, bakeryId },
              data: { effectiveTo: addDays(effectiveFrom, -1) },
            });
          } else {
            throw new ConflictException('El período de tarifa se solapa con una tarifa existente.');
          }
        }
        return tx.laborRate.create({
          data: { bakeryId, laborRoleId, hourlyRateCUP: rate, effectiveFrom, effectiveTo, notes: input.notes?.trim() || null },
          select: { id: true, hourlyRateCUP: true, effectiveFrom: true, effectiveTo: true, notes: true },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return {
        ...created,
        hourlyRateCUP: created.hourlyRateCUP.toString(),
        effectiveFrom: formatDate(created.effectiveFrom),
        effectiveTo: created.effectiveTo ? formatDate(created.effectiveTo) : null,
      };
    } catch (error) {
      if (isPrismaCode(error, 'P2002') || isPrismaCode(error, 'P2034')) {
        throw new ConflictException('Conflicto al registrar la tarifa; vuelve a cargar el historial y reintenta.');
      }
      throw error;
    }
  }

  async replaceOperations(
    bakeryId: string,
    productId: string,
    versionId: string,
    items: RecipeLaborOperationInputDto[],
  ) {
    for (const item of items) {
      const duration = new Prisma.Decimal(item.durationMinutes);
      const workers = new Prisma.Decimal(item.workersCount);
      if (duration.lte(0) || workers.lte(0)) throw new BadRequestException('Duración y número de trabajadores deben ser positivos.');
    }
    await this.prisma.$transaction(async (tx) => {
      const version = await tx.recipeVersion.findFirst({
        where: { id: versionId, productId, bakeryId },
        select: { id: true, status: true },
      });
      if (!version) throw new NotFoundException('Recipe version not found.');
      if (version.status !== 'DRAFT') throw new ConflictException('Solo se pueden editar operaciones de una versión borrador.');
      const roleIds = [...new Set(items.map((item) => item.laborRoleId))];
      const roles = roleIds.length ? await tx.laborRole.findMany({
        where: { bakeryId, id: { in: roleIds }, isActive: true },
        select: { id: true },
      }) : [];
      if (roles.length !== roleIds.length) throw new BadRequestException('Todos los puestos deben pertenecer a esta panadería y estar activos.');
      await tx.recipeLaborOperation.deleteMany({ where: { bakeryId, recipeVersionId: versionId } });
      if (items.length) {
        await tx.recipeLaborOperation.createMany({
          data: items.map((item, position) => ({
            bakeryId,
            recipeVersionId: versionId,
            laborRoleId: item.laborRoleId,
            operationName: item.operationName.trim(),
            durationMinutes: new Prisma.Decimal(item.durationMinutes),
            workersCount: new Prisma.Decimal(item.workersCount),
            position,
            notes: item.notes?.trim() || null,
          })),
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const operations = await this.prisma.recipeLaborOperation.findMany({
      where: { bakeryId, recipeVersionId: versionId },
      include: { laborRole: { select: { id: true, name: true, isActive: true } } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return operations.map((operation) => ({
      id: operation.id,
      laborRole: operation.laborRole,
      operationName: operation.operationName,
      durationMinutes: operation.durationMinutes.toString(),
      workersCount: operation.workersCount.toString(),
      position: operation.position,
      notes: operation.notes,
    }));
  }

  async listOverheads(bakeryId: string, category?: string, asOf?: string) {
    const date = asOf ? parseDate(asOf, 'asOf') : undefined;
    if (category && !['ELECTRICITY', 'WATER', 'FUEL', 'RENT', 'MAINTENANCE', 'DEPRECIATION', 'TRANSPORT', 'TELECOMMUNICATIONS', 'OTHER'].includes(category)) {
      throw new BadRequestException('Categoría de gasto indirecto inválida.');
    }
    const expenses = await this.prisma.overheadExpense.findMany({
      where: {
        bakeryId,
        ...(category ? { category: category as never } : {}),
        ...(date ? { periodStart: { lte: date }, periodEnd: { gte: date } } : {}),
      },
      include: { allocationUnit: { select: { id: true, code: true, name: true, dimension: true } } },
      orderBy: [{ periodStart: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    });
    return expenses.map(serializeOverhead);
  }

  async getOverhead(bakeryId: string, id: string) {
    const expense = await this.prisma.overheadExpense.findFirst({
      where: { id, bakeryId },
      include: { allocationUnit: { select: { id: true, code: true, name: true, dimension: true } } },
    });
    if (!expense) throw new NotFoundException('Overhead expense not found.');
    return serializeOverhead(expense);
  }

  async createOverhead(bakeryId: string, input: CreateOverheadExpenseDto) {
    const data = await this.overheadData(input);
    const created = await this.prisma.overheadExpense.create({
      data: { bakeryId, ...data },
      select: { id: true },
    });
    return this.getOverhead(bakeryId, created.id);
  }

  async updateOverhead(bakeryId: string, id: string, input: UpdateOverheadExpenseDto) {
    const current = await this.getOverhead(bakeryId, id);
    if (!Object.keys(input).length) {
      throw new BadRequestException('Indica al menos un campo para actualizar.');
    }
    const merged: CreateOverheadExpenseDto = {
      name: input.name ?? current.name,
      category: input.category ?? current.category as CreateOverheadExpenseDto['category'],
      amountCUP: input.amountCUP ?? current.amountCUP,
      periodStart: input.periodStart ?? current.periodStart,
      periodEnd: input.periodEnd ?? current.periodEnd,
      allocationMethod: input.allocationMethod ?? current.allocationMethod as CreateOverheadExpenseDto['allocationMethod'],
      allocationBaseQuantity: input.allocationBaseQuantity === undefined
        ? current.allocationBaseQuantity
        : input.allocationBaseQuantity,
      allocationUnitId: input.allocationUnitId === undefined
        ? current.allocationUnitId
        : input.allocationUnitId,
      notes: input.notes === undefined ? current.notes : input.notes,
    };
    const data = await this.overheadData(merged);
    await this.prisma.overheadExpense.updateMany({ where: { id, bakeryId }, data });
    return this.getOverhead(bakeryId, id);
  }

  private async overheadData(input: CreateOverheadExpenseDto) {
    const amountCUP = new Prisma.Decimal(input.amountCUP);
    const allocationBaseQuantity = input.allocationBaseQuantity == null
      ? null
      : new Prisma.Decimal(input.allocationBaseQuantity);
    const periodStart = parseDate(input.periodStart, 'periodStart');
    const periodEnd = parseDate(input.periodEnd, 'periodEnd');
    if (amountCUP.lte(0)) throw new BadRequestException('El importe debe ser positivo.');
    if (periodEnd < periodStart) throw new BadRequestException('periodEnd debe ser igual o posterior a periodStart.');
    if (allocationBaseQuantity && allocationBaseQuantity.lte(0)) throw new BadRequestException('La base de reparto debe ser positiva.');
    if (!allocationBaseQuantity) throw new BadRequestException('La base de reparto es obligatoria para este método.');
    if (input.allocationMethod === 'BATCHES' || input.allocationMethod === 'DIRECT_COST_PROPORTION') {
      if (input.allocationUnitId) throw new BadRequestException('Este método no admite unidad de reparto.');
    } else if (!input.allocationUnitId) {
      throw new BadRequestException('Selecciona una unidad para este método de reparto.');
    } else {
      const unit = await this.prisma.measurementUnit.findFirst({
        where: { id: input.allocationUnitId, isActive: true },
        select: { dimension: true },
      });
      if (!unit) throw new BadRequestException('La unidad de reparto no existe o está inactiva.');
      if (input.allocationMethod === 'LABOR_HOURS' && unit.dimension !== 'TIME') {
        throw new BadRequestException('LABOR_HOURS requiere una unidad de tiempo convertible a horas.');
      }
    }
    return {
      name: input.name.trim(),
      category: input.category ?? 'OTHER',
      amountCUP,
      periodStart,
      periodEnd,
      allocationMethod: input.allocationMethod,
      allocationBaseQuantity,
      allocationUnitId: input.allocationUnitId ?? null,
      notes: input.notes?.trim() || null,
    };
  }

  private async requireRole(bakeryId: string, id: string) {
    const role = await this.prisma.laborRole.findFirst({ where: { id, bakeryId } });
    if (!role) throw new NotFoundException('Labor role not found.');
    return role;
  }
}

function serializeOverhead(expense: {
  id: string; name: string; category: string; amountCUP: Prisma.Decimal;
  periodStart: Date; periodEnd: Date; allocationMethod: string;
  allocationBaseQuantity: Prisma.Decimal | null; allocationUnitId: string | null;
  allocationUnit: { id: string; code: string; name: string; dimension: string } | null;
  notes: string | null;
}) {
  return {
    ...expense,
    amountCUP: expense.amountCUP.toString(),
    periodStart: formatDate(expense.periodStart),
    periodEnd: formatDate(expense.periodEnd),
    allocationBaseQuantity: expense.allocationBaseQuantity?.toString() ?? null,
  };
}

function parseDate(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid YYYY-MM-DD calendar date.`);
  }
  return date;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, amount: number) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function overlaps(startA: Date, endA: Date | null, startB: Date, endB: Date | null) {
  return startA <= (endB ?? new Date('9999-12-31T00:00:00.000Z')) &&
    startB <= (endA ?? new Date('9999-12-31T00:00:00.000Z'));
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
