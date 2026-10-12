import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApplication } from './../src/app-setup.js';
import type { AuthenticatedUser } from './../src/auth/authenticated-user.js';
import {
  CurrentBakeryId,
  CurrentUser,
  RequireBakeryContext,
} from './../src/auth/auth.decorators.js';
import { JwtTokenService } from './../src/auth/jwt-token.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const testJwtSecret = 'e2e-test-signing-secret-with-more-than-32-bytes';
const originalJwtSecret = process.env.JWT_SECRET;
const testUser = {
  id: '7b5d6e8a-e070-4e0d-94d8-3b9f3a3a38e9',
  email: 'admin@example.test',
  emailNormalized: 'admin@example.test',
  passwordHash: '',
  displayName: 'Bakery Admin',
  status: 'ACTIVE',
  isPlatformAdmin: false,
};
const testBakeryId = 'a9c6a29d-4cc0-4885-9bdf-45ee343934ae';

@Controller('test/tenant')
class TenantProbeController {
  @Get()
  @RequireBakeryContext('ADMIN', 'EDITOR')
  getTenant(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBakeryId() bakeryId: string,
  ) {
    return { userId: user.id, bakeryId };
  }
}

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  const queryRaw = vi.fn();
  const userFindUnique = vi.fn();
  const membershipFindMany = vi.fn();
  const membershipFindUnique = vi.fn();
  const prisma = {
    $queryRaw: queryRaw,
    user: { findUnique: userFindUnique },
    membership: {
      findMany: membershipFindMany,
      findUnique: membershipFindUnique,
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = testJwtSecret;
    testUser.passwordHash = await argon2.hash('Correct-Horse-Battery');
  });

  beforeEach(async () => {
    queryRaw.mockReset();
    userFindUnique.mockReset();
    membershipFindMany.mockReset();
    membershipFindUnique.mockReset();
    userFindUnique.mockImplementation(async ({ where }) => {
      if (
        where.emailNormalized === testUser.emailNormalized ||
        where.id === testUser.id
      ) {
        return { ...testUser };
      }
      return null;
    });
    membershipFindMany.mockResolvedValue([
      {
        role: 'ADMIN',
        bakery: { id: testBakeryId, name: 'Test bakery' },
      },
    ]);
    membershipFindUnique.mockResolvedValue({
      role: 'ADMIN',
      status: 'ACTIVE',
      bakery: { status: 'ACTIVE' },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TenantProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app, 'http://localhost:4200');
    await app.init();
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('serves the existing root route beneath the API prefix', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('serves liveness without querying PostgreSQL', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/liveness')
      .expect(200)
      .expect({ status: 'ok' })
      .then(() => expect(queryRaw).not.toHaveBeenCalled());
  });

  it('allows the configured frontend origin through CORS', () => {
    return request(app.getHttpServer())
      .options('/api/v1/health/liveness')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)
      .expect('access-control-allow-origin', 'http://localhost:4200')
      .expect('access-control-allow-credentials', 'true');
  });

  it('serves readiness after a successful PostgreSQL query', () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    return request(app.getHttpServer())
      .get('/api/v1/health/readiness')
      .expect(200)
      .expect({ status: 'ok' })
      .then(() => expect(queryRaw).toHaveBeenCalledOnce());
  });

  it('returns 503 when the PostgreSQL query fails', () => {
    queryRaw.mockRejectedValue(new Error('database connection failed'));

    return request(app.getHttpServer())
      .get('/api/v1/health/readiness')
      .expect(503)
      .expect({
        status: 'error',
        message: 'Database unavailable',
      });
  });

  it('logs in and returns a verifiable short-lived access token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ' ADMIN@EXAMPLE.TEST ', password: 'Correct-Horse-Battery' })
      .expect(201);

    expect(response.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    await expect(
      app.get(JwtTokenService).verifyAccessToken(response.body.accessToken),
    ).resolves.toMatchObject({ sub: testUser.id });
    expect(userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { emailNormalized: testUser.emailNormalized },
      }),
    );
  });

  it('uses the same login error for an incorrect password and unknown account', async () => {
    const incorrectPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'wrong-password' })
      .expect(401);
    const unknownAccount = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.test', password: 'wrong-password' })
      .expect(401);

    expect(incorrectPassword.body).toEqual(unknownAccount.body);
  });

  it('does not authenticate an inactive account with a correct password', async () => {
    userFindUnique.mockResolvedValueOnce({ ...testUser, status: 'SUSPENDED' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'Correct-Horse-Battery' })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('rejects missing and invalid tokens for the current-user endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
  });

  it('returns the current authenticated user without password fields', async () => {
    const token = await login();

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        id: testUser.id,
        email: testUser.email,
        displayName: testUser.displayName,
        isPlatformAdmin: false,
      });
  });

  it('revokes access after the user account becomes inactive', async () => {
    const token = await login();
    userFindUnique.mockResolvedValueOnce({
      ...testUser,
      status: 'SUSPENDED',
    });

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('returns only active bakery memberships for the authenticated user', async () => {
    const token = await login();
    const response = await request(app.getHttpServer())
      .get('/api/v1/bakeries')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual([
      { id: testBakeryId, name: 'Test bakery', role: 'ADMIN' },
    ]);
    expect(membershipFindMany).toHaveBeenCalledWith({
      where: {
        userId: testUser.id,
        status: 'ACTIVE',
        bakery: { status: 'ACTIVE' },
      },
      select: {
        role: true,
        bakery: { select: { id: true, name: true } },
      },
      orderBy: { bakery: { name: 'asc' } },
    });
  });

  it('rejects missing and malformed bakery context before accessing a tenant', async () => {
    const token = await login();
    const base = request(app.getHttpServer())
      .get('/api/v1/test/tenant')
      .set('Authorization', `Bearer ${token}`);

    await base.expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/test/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Bakery-Id', 'not-a-uuid')
      .expect(400);
    expect(membershipFindUnique).not.toHaveBeenCalled();
  });

  it('checks the authenticated user membership for the selected bakery', async () => {
    const token = await login();
    membershipFindUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get('/api/v1/test/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Bakery-Id', testBakeryId)
      .expect(403);

    expect(membershipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_bakeryId: { userId: testUser.id, bakeryId: testBakeryId },
        },
      }),
    );
  });

  it('denies inactive memberships and inactive bakeries', async () => {
    const token = await login();
    membershipFindUnique.mockResolvedValueOnce({
      role: 'ADMIN',
      status: 'SUSPENDED',
      bakery: { status: 'ACTIVE' },
    });
    await tenantRequest(token).expect(403);

    membershipFindUnique.mockResolvedValueOnce({
      role: 'ADMIN',
      status: 'ACTIVE',
      bakery: { status: 'SUSPENDED' },
    });
    await tenantRequest(token).expect(403);
  });

  it('allows bakery admins and editors but denies viewers on editor routes', async () => {
    const token = await login();

    for (const role of ['ADMIN', 'EDITOR'] as const) {
      membershipFindUnique.mockResolvedValueOnce({
        role,
        status: 'ACTIVE',
        bakery: { status: 'ACTIVE' },
      });
      await tenantRequest(token)
        .expect(200)
        .expect({ userId: testUser.id, bakeryId: testBakeryId });
    }

    membershipFindUnique.mockResolvedValueOnce({
      role: 'VIEWER',
      status: 'ACTIVE',
      bakery: { status: 'ACTIVE' },
    });
    await tenantRequest(token).expect(403);
  });

  async function login(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: 'Correct-Horse-Battery' })
      .expect(201);
    if (typeof response.body.accessToken !== 'string') {
      throw new Error('Login response did not include an access token.');
    }
    return response.body.accessToken;
  }

  function tenantRequest(token: string) {
    return request(app.getHttpServer())
      .get('/api/v1/test/tenant')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Bakery-Id', testBakeryId);
  }

  afterEach(async () => {
    await app.close();
  });
});
