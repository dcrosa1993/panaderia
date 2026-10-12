import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';
import { JwtTokenService } from './jwt-token.service.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const TOKEN_LIFETIME_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = argon2.hash(randomBytes(32), {
    type: argon2.argon2id,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; tokenType: 'Bearer'; expiresIn: number }> {
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized: email.trim().toLowerCase() },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    const passwordMatches = await argon2.verify(
      user?.passwordHash ?? (await this.dummyPasswordHash),
      password,
    );
    if (!user || user.status !== UserStatus.ACTIVE || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return {
      accessToken: await this.jwtTokenService.createAccessToken(user.id),
      tokenType: 'Bearer',
      expiresIn: TOKEN_LIFETIME_SECONDS,
    };
  }

  async authenticateAccessToken(
    token: string,
  ): Promise<AuthenticatedUser | null> {
    const claims = await this.jwtTokenService.verifyAccessToken(token);
    if (!claims) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        isPlatformAdmin: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  }
}
