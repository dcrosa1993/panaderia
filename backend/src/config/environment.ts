export interface AppEnvironment {
  port: number;
  frontendOrigin: string;
}

export function loadEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AppEnvironment {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be configured.');
  }

  let parsedDatabaseUrl: URL;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (
    parsedDatabaseUrl.protocol !== 'postgres:' &&
    parsedDatabaseUrl.protocol !== 'postgresql:'
  ) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }
  if (!parsedDatabaseUrl.hostname || parsedDatabaseUrl.pathname.length < 2) {
    throw new Error('DATABASE_URL must include a host and database name.');
  }

  const rawPort = environment.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  const configuredOrigin = environment.FRONTEND_ORIGIN;
  const rawOrigin =
    configuredOrigin ??
    (nodeEnvironment === 'development' ? 'http://localhost:4200' : undefined);

  if (!rawOrigin) {
    throw new Error('FRONTEND_ORIGIN must be configured outside development.');
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(rawOrigin);
  } catch {
    throw new Error('FRONTEND_ORIGIN must be a valid HTTP(S) origin.');
  }

  if (
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin === 'null' ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.pathname !== '/' ||
    parsedOrigin.search ||
    parsedOrigin.hash ||
    (rawOrigin !== parsedOrigin.origin && rawOrigin !== `${parsedOrigin.origin}/`)
  ) {
    throw new Error('FRONTEND_ORIGIN must be a valid HTTP(S) origin.');
  }

  return { port, frontendOrigin: parsedOrigin.origin };
}
