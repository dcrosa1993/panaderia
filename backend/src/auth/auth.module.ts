import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { BakeryContextGuard } from './bakery-context.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtTokenService } from './jwt-token.service.js';
import { RolesGuard } from './roles.guard.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    BakeryContextGuard,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: JwtTokenService,
      useFactory: () => new JwtTokenService(process.env.JWT_SECRET),
    },
  ],
  exports: [
    AuthService,
    BakeryContextGuard,
    JwtAuthGuard,
    JwtTokenService,
    RolesGuard,
  ],
})
export class AuthModule {}
