import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createBootstrapAdmin } from '../src/auth/bootstrap-admin.service.js';
import { readBootstrapAdminConfig } from './bootstrap-admin.config.js';
import { formatBootstrapError } from './bootstrap-admin.diagnostics.js';

loadDotenv({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

async function main(): Promise<void> {
  const { connectionString, input } = readBootstrapAdminConfig(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const sensitiveValues = [
    ...getSensitiveEnvironmentValues(process.env),
    connectionString,
    input.email,
    input.email.toLowerCase(),
    input.password,
    input.displayName,
    input.bakeryName,
  ];
  let bootstrapError: unknown;
  let failed = false;

  try {
    await createBootstrapAdmin(prisma, {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      bakeryName: input.bakeryName,
    });
  } catch (error) {
    bootstrapError = error;
    failed = true;
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    if (failed) {
      console.error(formatBootstrapError(error, sensitiveValues));
    } else {
      bootstrapError = error;
      failed = true;
    }
  }

  if (failed) throw bootstrapError;
  console.log('Bootstrap administrator and bakery created.');
}

main().catch((error: unknown) => {
  console.error(
    formatBootstrapError(error, getSensitiveEnvironmentValues(process.env)),
  );
  process.exitCode = 1;
});

function getSensitiveEnvironmentValues(
  environment: NodeJS.ProcessEnv,
): string[] {
  const rawValues = [
    environment.DATABASE_URL,
    environment.BOOTSTRAP_ADMIN_EMAIL,
    environment.BOOTSTRAP_ADMIN_PASSWORD,
    environment.BOOTSTRAP_ADMIN_NAME,
    environment.BOOTSTRAP_BAKERY_NAME,
  ].filter((value): value is string => Boolean(value));

  return [
    ...rawValues,
    ...rawValues.map((value) => value.trim()),
    environment.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? '',
  ];
}
