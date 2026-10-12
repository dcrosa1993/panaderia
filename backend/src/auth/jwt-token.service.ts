import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

const TOKEN_LIFETIME_SECONDS = 15 * 60;
const TOKEN_ISSUER = 'panaderia-api';

export interface AccessTokenClaims {
  iss: typeof TOKEN_ISSUER;
  sub: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtTokenService {
  private readonly secret: Uint8Array;

  constructor(secret = process.env.JWT_SECRET ?? '') {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('JWT_SECRET must contain at least 32 bytes.');
    }
    this.secret = new TextEncoder().encode(secret);
  }

  async createAccessToken(userId: string): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(TOKEN_ISSUER)
      .setSubject(userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + TOKEN_LIFETIME_SECONDS)
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    if (token.length > 4096) {
      return null;
    }

    try {
      const { payload, protectedHeader } = await jwtVerify(
        token,
        this.secret,
        { algorithms: ['HS256'], issuer: TOKEN_ISSUER },
      );
      const { iss, sub, iat, exp } = payload;
      const now = Math.floor(Date.now() / 1000);
      if (
        protectedHeader.typ !== 'JWT' ||
        iss !== TOKEN_ISSUER ||
        typeof sub !== 'string' ||
        !this.isInteger(iat) ||
        !this.isInteger(exp) ||
        iat > now + 60 ||
        exp <= iat ||
        exp - iat > TOKEN_LIFETIME_SECONDS
      ) {
        return null;
      }

      return { iss: TOKEN_ISSUER, sub, iat, exp };
    } catch {
      return null;
    }
  }

  private isInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
  }
}
