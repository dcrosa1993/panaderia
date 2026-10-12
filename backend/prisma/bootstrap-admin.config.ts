import type { BootstrapAdminInput } from '../src/auth/bootstrap-admin.service.js';

const REQUIRED_VARIABLES = [
  'DATABASE_URL',
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_NAME',
  'BOOTSTRAP_BAKERY_NAME',
] as const;

export interface BootstrapAdminConfig {
  connectionString: string;
  input: BootstrapAdminInput;
}

export function readBootstrapAdminConfig(
  environment: NodeJS.ProcessEnv,
): BootstrapAdminConfig {
  const values = {
    DATABASE_URL: environment.DATABASE_URL?.trim(),
    BOOTSTRAP_ADMIN_EMAIL: environment.BOOTSTRAP_ADMIN_EMAIL?.trim(),
    BOOTSTRAP_ADMIN_PASSWORD: environment.BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_NAME: environment.BOOTSTRAP_ADMIN_NAME?.trim(),
    BOOTSTRAP_BAKERY_NAME: environment.BOOTSTRAP_BAKERY_NAME?.trim(),
  };
  const missing = REQUIRED_VARIABLES.filter((name) => !values[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.`,
    );
  }

  const required = (name: (typeof REQUIRED_VARIABLES)[number]): string => {
    const value = values[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}.`);
    }
    return value;
  };

  return {
    connectionString: required('DATABASE_URL'),
    input: {
      email: required('BOOTSTRAP_ADMIN_EMAIL'),
      password: required('BOOTSTRAP_ADMIN_PASSWORD'),
      displayName: required('BOOTSTRAP_ADMIN_NAME'),
      bakeryName: required('BOOTSTRAP_BAKERY_NAME'),
    },
  };
}
