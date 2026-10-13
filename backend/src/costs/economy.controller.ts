import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CurrentBakeryId,
  RequireBakeryContext,
} from '../auth/auth.decorators.js';
import {
  CreateLaborRateDto,
  CreateLaborRoleDto,
  CreateOverheadExpenseDto,
  ReplaceRecipeLaborOperationsDto,
  UpdateLaborRoleDto,
  UpdateOverheadExpenseDto,
} from './economy.dto.js';
import { EconomyService } from './economy.service.js';

@Controller()
@RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  @Get('labor-roles')
  roles(@CurrentBakeryId() bakeryId: string) {
    return this.economy.listRoles(bakeryId);
  }

  @Post('labor-roles')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  createRole(@CurrentBakeryId() bakeryId: string, @Body() input: CreateLaborRoleDto) {
    return this.economy.createRole(bakeryId, input);
  }

  @Get('labor-roles/:id')
  role(@CurrentBakeryId() bakeryId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.economy.getRole(bakeryId, id);
  }

  @Patch('labor-roles/:id')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  updateRole(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateLaborRoleDto,
  ) {
    return this.economy.updateRole(bakeryId, id, input);
  }

  @Get('labor-roles/:id/rates')
  rates(@CurrentBakeryId() bakeryId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.economy.listRates(bakeryId, id);
  }

  @Post('labor-roles/:id/rates')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  createRate(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateLaborRateDto,
  ) {
    return this.economy.createRate(bakeryId, id, input);
  }

  @Put('products/:productId/recipe-versions/:versionId/labor-operations')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  replaceOperations(
    @CurrentBakeryId() bakeryId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() input: ReplaceRecipeLaborOperationsDto,
  ) {
    return this.economy.replaceOperations(bakeryId, productId, versionId, input.items);
  }

  @Get('overhead-expenses')
  overheads(
    @CurrentBakeryId() bakeryId: string,
    @Query('category') category?: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.economy.listOverheads(bakeryId, category, asOf);
  }

  @Post('overhead-expenses')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  createOverhead(@CurrentBakeryId() bakeryId: string, @Body() input: CreateOverheadExpenseDto) {
    return this.economy.createOverhead(bakeryId, input);
  }

  @Get('overhead-expenses/:id')
  overhead(@CurrentBakeryId() bakeryId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.economy.getOverhead(bakeryId, id);
  }

  @Patch('overhead-expenses/:id')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  updateOverhead(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateOverheadExpenseDto,
  ) {
    return this.economy.updateOverhead(bakeryId, id, input);
  }
}
