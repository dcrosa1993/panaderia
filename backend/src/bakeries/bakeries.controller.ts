import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/auth.decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BakeriesService } from './bakeries.service.js';

@Controller('bakeries')
@UseGuards(JwtAuthGuard)
export class BakeriesController {
  constructor(private readonly bakeriesService: BakeriesService) {}

  @Get()
  listForCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.bakeriesService.listForUser(user.id);
  }
}
