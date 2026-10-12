import { formatBootstrapError } from './bootstrap-admin.diagnostics.js';

describe('formatBootstrapError', () => {
  it('reports Prisma error type, code, and safe message while redacting secrets', () => {
    const connectionString =
      'postgresql://db-user:db-password@localhost:5433/panaderia';
    const password = 'Sensitive-admin-password';
    const email = 'admin@example.test';
    const error = Object.assign(
      new Error(
        `Connection to ${connectionString} failed for ${email}; password=${password}; Bearer abc.def.ghi`,
      ),
      { name: 'PrismaClientKnownRequestError', code: 'P2002' },
    );

    const diagnostic = formatBootstrapError(error, [
      connectionString,
      password,
      email,
    ]);

    expect(diagnostic).toContain('PrismaClientKnownRequestError, P2002');
    expect(diagnostic).toContain('Connection to [redacted] failed');
    expect(diagnostic).not.toContain(connectionString);
    expect(diagnostic).not.toContain(password);
    expect(diagnostic).not.toContain(email);
    expect(diagnostic).not.toContain('abc.def.ghi');
  });

  it('provides a safe diagnostic for non-Error failures', () => {
    expect(formatBootstrapError('password=do-not-log', [])).toBe(
      'Bootstrap failed [UnknownError]: password=[redacted]',
    );
  });
});
