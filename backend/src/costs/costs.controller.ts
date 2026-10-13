import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  CurrentBakeryId,
  CurrentUser,
  RequireBakeryContext,
} from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CreateCostCalculationDto } from './costs.dto.js';
import { CostsService } from './costs.service.js';

@Controller()
@RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Post('products/:productId/cost-calculations')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  calculate(
    @CurrentBakeryId() bakeryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: CreateCostCalculationDto,
  ) {
    return this.costsService.calculate(bakeryId, user.id, productId, input);
  }

  @Get('products/:productId/cost-calculations')
  list(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.costsService.list(bakeryId, productId);
  }

  @Get('cost-calculations/:calculationId')
  get(
    @CurrentBakeryId() bakeryId: string,
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
  ) {
    return this.costsService.get(bakeryId, calculationId);
  }
}
