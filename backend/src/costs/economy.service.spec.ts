import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EconomyService } from './economy.service.js';

const bakeryId = '10000000-0000-4000-8000-000000000001';
const versionId = '20000000-0000-4000-8000-000000000001';
const roleId = '30000000-0000-4000-8000-000000000001';

describe('EconomyService', () => {
  it('closes the open labor rate on the preceding day when adding a later rate', async () => {
    const oldRate = {
      id: 'old-rate',
      bakeryId,
      laborRoleId: roleId,
      hourlyRateCUP: new Prisma.Decimal('10'),
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const tx = {
      laborRate: {
        findMany: vi.fn().mockResolvedValue([oldRate]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({
          id: 'new-rate',
          hourlyRateCUP: new Prisma.Decimal('12'),
          effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
          effectiveTo: null,
          notes: null,
        }),
      },
    };
    const prisma = {
      laborRole: {
        findFirst: vi.fn().mockResolvedValue({ id: roleId, isActive: true }),
      },
      $transaction: vi.fn(async (
        operation: (transaction: typeof tx) => unknown,
      ) => operation(tx)),
    };
    const service = new EconomyService(prisma as unknown as PrismaService);

    const result = await service.createRate(bakeryId, roleId, {
      hourlyRateCUP: '12',
      effectiveFrom: '2026-02-01',
    });

    expect(tx.laborRate.updateMany).toHaveBeenCalledWith({
      where: { id: 'old-rate', bakeryId },
      data: { effectiveTo: new Date('2026-01-31T00:00:00.000Z') },
    });
    expect(result).toMatchObject({
      hourlyRateCUP: '12',
      effectiveFrom: '2026-02-01',
      effectiveTo: null,
    });
  });

  it('isolates operation replacement by bakery and refuses published recipes', async () => {
    const tx = {
      recipeVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: versionId,
          status: 'PUBLISHED',
        }),
      },
      laborRole: { findMany: vi.fn() },
      recipeLaborOperation: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (
        operation: (transaction: typeof tx) => unknown,
      ) => operation(tx)),
      recipeLaborOperation: { findMany: vi.fn() },
    };
    const service = new EconomyService(prisma as unknown as PrismaService);

    await expect(service.replaceOperations(bakeryId, 'product-id', versionId, [{
      laborRoleId: roleId,
      operationName: 'Amasado',
      durationMinutes: '20',
      workersCount: '1',
    }])).rejects.toBeInstanceOf(ConflictException);

    expect(tx.recipeVersion.findFirst).toHaveBeenCalledWith({
      where: { id: versionId, productId: 'product-id', bakeryId },
      select: { id: true, status: true },
    });
    expect(tx.recipeLaborOperation.deleteMany).not.toHaveBeenCalled();
  });
});
