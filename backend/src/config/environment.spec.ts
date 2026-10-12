import { loadEnvironment } from './environment.js';

describe('loadEnvironment', () => {
  const baseEnvironment: NodeJS.ProcessEnv = {
    DATABASE_URL: 'postgresql://user:placeholder@localhost:5433/panaderia',
    JWT_SECRET: 'local-test-secret-with-at-least-32-bytes',
    NODE_ENV: 'development',
  };

  it('uses development defaults when optional values are omitted', () => {
    expect(loadEnvironment(baseEnvironment)).toEqual({
      port: 3000,
      frontendOrigin: 'http://localhost:4200',
      jwtSecret: 'local-test-secret-with-at-least-32-bytes',
    });
  });

  it('requires a sufficiently long JWT secret', () => {
    expect(() =>
      loadEnvironment({ ...baseEnvironment, JWT_SECRET: 'too-short' }),
    ).toThrow('JWT_SECRET must contain at least 32 bytes.');
  });

  it('requires a frontend origin outside development', () => {
    expect(() =>
      loadEnvironment({ ...baseEnvironment, NODE_ENV: 'production' }),
    ).toThrow('FRONTEND_ORIGIN must be configured outside development.');
  });

  it('rejects invalid ports and non-origin CORS values', () => {
    expect(() =>
      loadEnvironment({ ...baseEnvironment, PORT: '70000' }),
    ).toThrow('PORT must be an integer between 1 and 65535.');
    expect(() =>
      loadEnvironment({
        ...baseEnvironment,
        FRONTEND_ORIGIN: 'https://example.com/app',
      }),
    ).toThrow('FRONTEND_ORIGIN must be a valid HTTP(S) origin.');
  });

  it('rejects invalid database URLs without exposing the configured value', () => {
    expect(() =>
      loadEnvironment({ ...baseEnvironment, DATABASE_URL: 'not-a-url' }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL.');
  });
});
