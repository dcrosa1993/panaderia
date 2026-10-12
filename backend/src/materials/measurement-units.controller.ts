import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ListUnitsQueryDto } from './materials.dto.js';
import { MaterialsService } from './materials.service.js';

@Controller('measurement-units')
@UseGuards(JwtAuthGuard)
export class MeasurementUnitsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  listUnits(@Query() query: ListUnitsQueryDto) {
    return this.materialsService.listMeasurementUnits(query.dimension);
  }
}
