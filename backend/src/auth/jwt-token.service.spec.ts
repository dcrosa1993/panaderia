import { JwtTokenService } from './jwt-token.service.js';

describe('JwtTokenService', () => {
  const service = new JwtTokenService(
    'unit-test-jwt-secret-with-more-than-32-bytes',
  );

  it('creates a verifiable token with a short expiry', async () => {
    const token = await service.createAccessToken(
      '7b5d6e8a-e070-4e0d-94d8-3b9f3a3a38e9',
    );

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      iss: 'panaderia-api',
      sub: '7b5d6e8a-e070-4e0d-94d8-3b9f3a3a38e9',
      exp: expect.any(Number),
    });
  });

  it('rejects modified or malformed tokens', async () => {
    const token = await service.createAccessToken('user-id');

    await expect(service.verifyAccessToken(`${token}x`)).resolves.toBeNull();
    await expect(service.verifyAccessToken('not.a.jwt')).resolves.toBeNull();
  });
});
