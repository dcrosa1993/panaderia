import * as argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  BootstrapAdminInput,
  createBootstrapAdmin,
} from './bootstrap-admin.service.js';

describe('createBootstrapAdmin', () => {
  const input: BootstrapAdminInput = {
    email: 'admin@example.test',
    password: 'A-unique-bootstrap-password',
    displayName: 'Initial Admin',
    bakeryName: 'First bakery',
  };

  it('creates a bakery administrator with an Argon2id password hash', async () => {
    const userCreate = vi.fn().mockResolvedValue({ id: 'user-id' });
    const bakeryCreate = vi.fn().mockResolvedValue({ id: 'bakery-id' });
    const membershipCreate = vi.fn().mockResolvedValue({});
    const userFindUnique = vi.fn().mockResolvedValue(null);
    const prisma = createFakePrisma({
      user: { findUnique: userFindUnique, create: userCreate },
      userCount: 0,
      bakery: { create: bakeryCreate },
      bakeryCount: 0,
      membership: { create: membershipCreate },
    });

    await createBootstrapAdmin(prisma, input);

    const createData = userCreate.mock.calls[0][0].data;
    expect(createData.passwordHash).not.toBe(input.password);
    await expect(argon2.verify(createData.passwordHash, input.password)).resolves
      .toBe(true);
    expect(membershipCreate).toHaveBeenCalledWith({
      data: { userId: 'user-id', bakeryId: 'bakery-id', role: 'ADMIN' },
    });
  });

  it('fails on an existing account without creating or overwriting records', async () => {
    const userCreate = vi.fn();
    const bakeryCreate = vi.fn();
    const membershipCreate = vi.fn();
    const userFindUnique = vi.fn().mockResolvedValue({ id: 'existing-user' });
    const prisma = createFakePrisma({
      user: { findUnique: userFindUnique, create: userCreate },
      userCount: 0,
      bakery: { create: bakeryCreate },
      bakeryCount: 0,
      membership: { create: membershipCreate },
    });

    await expect(createBootstrapAdmin(prisma, input)).rejects.toThrow(
      'An account with this email already exists.',
    );
    expect(userCreate).not.toHaveBeenCalled();
    expect(bakeryCreate).not.toHaveBeenCalled();
    expect(membershipCreate).not.toHaveBeenCalled();
  });

  it('refuses to create a second account or bakery during first-admin setup', async () => {
    const userCreate = vi.fn();
    const bakeryCreate = vi.fn();
    const membershipCreate = vi.fn();
    const prisma = createFakePrisma({
      user: { findUnique: vi.fn().mockResolvedValue(null), create: userCreate },
      userCount: 1,
      bakery: { create: bakeryCreate },
      bakeryCount: 0,
      membership: { create: membershipCreate },
    });

    await expect(createBootstrapAdmin(prisma, input)).rejects.toThrow(
      'Bootstrap is only available before the first account exists.',
    );
    expect(userCreate).not.toHaveBeenCalled();
    expect(bakeryCreate).not.toHaveBeenCalled();
    expect(membershipCreate).not.toHaveBeenCalled();
  });
});

function createFakePrisma({
  userCount,
  bakeryCount,
  ...transaction
}: {
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  bakery: { create: ReturnType<typeof vi.fn> };
  membership: { create: ReturnType<typeof vi.fn> };
  userCount: number;
  bakeryCount: number;
}): PrismaClient {
  const transactionalClient = {
    ...transaction,
    user: {
      ...transaction.user,
      count: vi.fn().mockResolvedValue(userCount),
    },
    bakery: {
      ...transaction.bakery,
      count: vi.fn().mockResolvedValue(bakeryCount),
    },
  };
  const fake = {
    $transaction: vi.fn(
      async (operation: (value: object) => Promise<unknown>) =>
        operation(transactionalClient),
    ),
  };
  return fake as unknown as PrismaClient;
}
