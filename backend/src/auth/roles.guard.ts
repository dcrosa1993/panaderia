import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MembershipRole } from '../generated/prisma/enums.js';
import { AuthenticatedRequest } from './authenticated-request.js';
import { BAKERY_ROLES_METADATA } from './auth.constants.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(
      BAKERY_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      !request.membershipRole ||
      !requiredRoles.includes(request.membershipRole)
    ) {
      throw new ForbiddenException(
        'Your bakery role cannot perform this action.',
      );
    }
    return true;
  }
}
