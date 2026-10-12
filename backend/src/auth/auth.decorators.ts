import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { MembershipRole } from '../generated/prisma/enums.js';
import { AuthenticatedRequest } from './authenticated-request.js';
import { BAKERY_ROLES_METADATA } from './auth.constants.js';
import { BakeryContextGuard } from './bakery-context.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    return request.user;
  },
);

export const CurrentBakeryId = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.bakeryId) {
      throw new UnauthorizedException();
    }
    return request.bakeryId;
  },
);

export function RequireBakeryContext(
  ...roles: MembershipRole[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(BAKERY_ROLES_METADATA, roles),
    UseGuards(JwtAuthGuard, BakeryContextGuard, RolesGuard),
  );
}
