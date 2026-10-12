import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from './authenticated-request.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/i.exec(authorization)
        : null;
    if (!match) {
      throw new UnauthorizedException();
    }

    const user = await this.authService.authenticateAccessToken(match[1]);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }
}
