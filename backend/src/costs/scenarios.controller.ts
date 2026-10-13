import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CurrentBakeryId,
  RequireBakeryContext,
} from '../auth/auth.decorators.js';
import {
  CreatePriceScenarioDto,
  CreateTaxAssignmentDto,
  UpdateTaxAssignmentDto,
} from './scenarios.dto.js';
import { ScenariosService } from './scenarios.service.js';

@Controller()
@RequireBakeryContext('ADMIN', 'EDITOR', 'VIEWER')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get('tax-settings/rules')
  rules() {
    return this.scenarios.listRules();
  }

  @Get('tax-settings/assignments')
  assignments(@CurrentBakeryId() bakeryId: string) {
    return this.scenarios.listAssignments(bakeryId);
  }

  @Post('tax-settings/assignments')
  @RequireBakeryContext('ADMIN')
  assign(@CurrentBakeryId() bakeryId: string, @Body() input: CreateTaxAssignmentDto) {
    return this.scenarios.createAssignment(bakeryId, input);
  }

  @Patch('tax-settings/assignments/:id')
  @RequireBakeryContext('ADMIN')
  updateAssignment(
    @CurrentBakeryId() bakeryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTaxAssignmentDto,
  ) {
    return this.scenarios.updateAssignment(bakeryId, id, input);
  }

  @Get('cost-calculations/:calculationId/scenarios')
  list(
    @CurrentBakeryId() bakeryId: string,
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
  ) {
    return this.scenarios.listScenarios(bakeryId, calculationId);
  }

  @Post('cost-calculations/:calculationId/scenarios')
  @RequireBakeryContext('ADMIN', 'EDITOR')
  create(
    @CurrentBakeryId() bakeryId: string,
    @Param('calculationId', ParseUUIDPipe) calculationId: string,
    @Body() input: CreatePriceScenarioDto,
  ) {
    return this.scenarios.createScenario(bakeryId, calculationId, input);
  }

  @Get('price-scenarios/:scenarioId')
  get(
    @CurrentBakeryId() bakeryId: string,
    @Param('scenarioId', ParseUUIDPipe) scenarioId: string,
  ) {
    return this.scenarios.getScenario(bakeryId, scenarioId);
  }
}
