import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentBakeryId,
  RequireBakeryContext,
} from '../auth/auth.decorators.js';
import { MaterialsService } from './materials.service.js';
import {
  CreateMaterialDto,
  CreateMaterialPriceDto,
  ListMaterialsQueryDto,
  UpdateMaterialDto,
} from './materials.dto.js';

@Controller()
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('materials')
  @RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
  listMaterials(
    @CurrentBakeryId() bakeryId: string,
    @Query() query: ListMaterialsQueryDto,
  ) {
    return this.materialsService.listMaterials(bakeryId, query);
  }

  @Post('materials')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  createMaterial(
    @CurrentBakeryId() bakeryId: string,
    @Body() input: CreateMaterialDto,
  ) {
    return this.materialsService.createMaterial(bakeryId, input);
  }

  @Get('materials/:id')
  @RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
  getMaterial(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materialsService.getMaterial(bakeryId, id);
  }

  @Patch('materials/:id')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  updateMaterial(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMaterialDto,
  ) {
    return this.materialsService.updateMaterial(bakeryId, id, input);
  }

  @Get('materials/:id/prices')
  @RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
  listPrices(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materialsService.listPrices(bakeryId, id);
  }

  @Post('materials/:id/prices')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  createPrice(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateMaterialPriceDto,
  ) {
    return this.materialsService.createPrice(bakeryId, id, input);
  }

  @Post('materials/:id/prices/preview')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  previewPrice(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateMaterialPriceDto,
  ) {
    return this.materialsService.previewPrice(bakeryId, id, input);
  }
}
