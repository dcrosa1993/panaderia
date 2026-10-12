import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createBootstrapAdmin } from '../src/auth/bootstrap-admin.service.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be configured.');
}

const input = {
  email: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim(),
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  displayName: process.env.BOOTSTRAP_ADMIN_NAME?.trim(),
  bakeryName: process.env.BOOTSTRAP_BAKERY_NAME?.trim(),
};

async function main(): Promise<void> {
  if (
    !input.email ||
    !input.password ||
    !input.displayName ||
    !input.bakeryName
  ) {
    throw new Error('All bootstrap administrator and bakery values are required.');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await createBootstrapAdmin(prisma, {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      bakeryName: input.bakeryName,
    });

    console.log('Bootstrap administrator and bakery created.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main()
  .catch(() => {
    console.error(
      'Bootstrap failed; no credentials were logged. Check configuration and account conflicts.',
    );
    process.exitCode = 1;
  });
