import { readBootstrapAdminConfig } from './bootstrap-admin.config.js';

describe('readBootstrapAdminConfig', () => {
  const completeEnvironment: NodeJS.ProcessEnv = {
    DATABASE_URL: 'postgresql://user:password@localhost:5433/panaderia',
    BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
    BOOTSTRAP_ADMIN_PASSWORD: 'A-long-bootstrap-password',
    BOOTSTRAP_ADMIN_NAME: 'Initial Admin',
    BOOTSTRAP_BAKERY_NAME: 'First bakery',
  };

  it('reports the names of all missing required variables without values', () => {
    expect(() => readBootstrapAdminConfig({})).toThrow(
      'Missing required environment variables: DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_BAKERY_NAME.',
    );
  });

  it('reports blank variables as missing without exposing their values', () => {
    expect(() =>
      readBootstrapAdminConfig({
        ...completeEnvironment,
        BOOTSTRAP_ADMIN_EMAIL: '  ',
      }),
    ).toThrow('Missing required environment variables: BOOTSTRAP_ADMIN_EMAIL.');
  });

  it('reads the configured values and trims non-password settings', () => {
    const config = readBootstrapAdminConfig({
      ...completeEnvironment,
      DATABASE_URL: ' postgresql://user:password@localhost:5433/panaderia ',
      BOOTSTRAP_ADMIN_EMAIL: ' admin@example.test ',
      BOOTSTRAP_ADMIN_NAME: ' Initial Admin ',
      BOOTSTRAP_BAKERY_NAME: ' First bakery ',
    });

    expect(config).toEqual({
      connectionString: 'postgresql://user:password@localhost:5433/panaderia',
      input: {
        email: 'admin@example.test',
        password: 'A-long-bootstrap-password',
        displayName: 'Initial Admin',
        bakeryName: 'First bakery',
      },
    });
  });
});
