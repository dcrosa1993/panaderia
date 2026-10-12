import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApplication } from './../src/app-setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  const queryRaw = vi.fn();

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app, 'http://localhost:4200');
    await app.init();
  });

  beforeEach(() => {
    queryRaw.mockReset();
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

  afterEach(async () => {
    await app.close();
  });
});
