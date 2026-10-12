import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const queryRaw = vi.fn();
  let service: HealthService;

  beforeEach(async () => {
    queryRaw.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    service = module.get(HealthService);
  });

  it('reports liveness without requiring a database query', () => {
    expect(service.getLiveness()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('executes a database query for readiness', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.getReadiness()).resolves.toEqual({ status: 'ok' });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('reports the service unavailable when the database query fails', async () => {
    queryRaw.mockRejectedValue(new Error('database connection failed'));

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
