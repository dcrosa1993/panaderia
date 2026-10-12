import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class BakeryContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const bakeryId = request.headers['x-bakery-id'];
    if (typeof bakeryId !== 'string') {
      throw new BadRequestException(
        'X-Bakery-Id header is required for this endpoint.',
      );
    }
    if (!isUUID(bakeryId)) {
      throw new BadRequestException('X-Bakery-Id must be a valid UUID.');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_bakeryId: { userId: user.id, bakeryId } },
      select: {
        role: true,
        status: true,
        bakery: { select: { status: true } },
      },
    });
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.bakery.status !== 'ACTIVE'
    ) {
      throw new ForbiddenException('You do not have access to this bakery.');
    }

    request.bakeryId = bakeryId;
    request.membershipRole = membership.role;
    return true;
  }
}
