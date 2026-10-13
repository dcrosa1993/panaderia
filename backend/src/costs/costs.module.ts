import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CostsController } from './costs.controller.js';
import { CostsService } from './costs.service.js';
import { EconomyController } from './economy.controller.js';
import { EconomyService } from './economy.service.js';
import { ScenariosController } from './scenarios.controller.js';
import { ScenariosService } from './scenarios.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CostsController, EconomyController, ScenariosController],
  providers: [CostsService, EconomyService, ScenariosService],
})
export class CostsModule {}
