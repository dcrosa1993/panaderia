import * as argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  BootstrapAdminInput,
  createBootstrapAdmin,
  validateBootstrapInput,
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
    await expect(
      argon2.verify(createData.passwordHash, input.password),
    ).resolves.toBe(true);
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

  it('propagates bootstrap database failures so the caller can diagnose them', async () => {
    const databaseError = Object.assign(new Error('database unavailable'), {
      code: 'P1001',
    });
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(databaseError),
    } as unknown as PrismaClient;

    await expect(createBootstrapAdmin(prisma, input)).rejects.toBe(
      databaseError,
    );
  });

  it('accepts the minimum password length of 12 UTF-8 bytes', () => {
    expect(() =>
      validateBootstrapInput({ ...input, password: '🥐🥐🥐' }),
    ).not.toThrow();
  });

  it('reports the password field when it is shorter than 12 UTF-8 bytes', () => {
    expect(() =>
      validateBootstrapInput({ ...input, password: '🥐🥐' }),
    ).toThrow('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 UTF-8 bytes.');
  });

  it('reports every field that exceeds its schema character limit', () => {
    const invalidInput = {
      email: `${'a'.repeat(321)}@example.test`,
      password: input.password,
      displayName: 'D'.repeat(161),
      bakeryName: 'B'.repeat(181),
    };

    expect(() => validateBootstrapInput(invalidInput)).toThrow(
      'BOOTSTRAP_ADMIN_EMAIL must be at most 320 characters. BOOTSTRAP_ADMIN_NAME must be at most 160 characters. BOOTSTRAP_BAKERY_NAME must be at most 180 characters.',
    );
  });

  it('accepts display and bakery names at their schema limits by Unicode character count', () => {
    expect(() =>
      validateBootstrapInput({
        ...input,
        displayName: '🥐'.repeat(160),
        bakeryName: '🍞'.repeat(180),
      }),
    ).not.toThrow();
  });

  it('accepts the email schema length limit before validating email syntax', () => {
    const emailAtLimit = `${'a'.repeat(320)}`;

    expect(() =>
      validateBootstrapInput({ ...input, email: emailAtLimit }),
    ).toThrow('Bootstrap email must be a valid email address.');
  });
});

function createFakePrisma({
  userCount,
  bakeryCount,
  ...transaction
}: {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
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
