import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';
import type { PrismaClient } from '../generated/prisma/client.js';

export interface BootstrapAdminInput {
  email: string;
  password: string;
  displayName: string;
  bakeryName: string;
}

export function validateBootstrapInput(input: BootstrapAdminInput): void {
  if (
    !input.email ||
    !input.password ||
    !input.displayName ||
    !input.bakeryName
  ) {
    throw new Error('All bootstrap administrator and bakery values are required.');
  }
  if (
    Buffer.byteLength(input.password, 'utf8') < 12 ||
    input.email.length > 320 ||
    input.displayName.length > 160 ||
    input.bakeryName.length > 180
  ) {
    throw new Error('Bootstrap values do not meet the required length limits.');
  }
  if (!isEmail(input.email)) {
    throw new Error('Bootstrap email must be a valid email address.');
  }
}

export async function createBootstrapAdmin(
  prisma: PrismaClient,
  input: BootstrapAdminInput,
): Promise<void> {
  validateBootstrapInput(input);
  const emailNormalized = input.email.toLowerCase();

  await prisma.$transaction(async (transaction) => {
    const existingUser = await transaction.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error('An account with this email already exists.');
    }
    if ((await transaction.user.count()) > 0) {
      throw new Error('Bootstrap is only available before the first account exists.');
    }
    if ((await transaction.bakery.count()) > 0) {
      throw new Error('Bootstrap is only available before the first bakery exists.');
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = await transaction.user.create({
      data: {
        email: input.email,
        emailNormalized,
        passwordHash,
        displayName: input.displayName,
      },
      select: { id: true },
    });
    const bakery = await transaction.bakery.create({
      data: { name: input.bakeryName },
      select: { id: true },
    });
    await transaction.membership.create({
      data: { userId: user.id, bakeryId: bakery.id, role: 'ADMIN' },
    });
  });
}
