import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from './authenticated-user.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './auth.decorators.js';
import { LoginDto } from './auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
