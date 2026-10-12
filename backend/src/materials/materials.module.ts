import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MaterialsController } from './materials.controller.js';
import { MeasurementUnitsController } from './measurement-units.controller.js';
import { MaterialsService } from './materials.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MaterialsController, MeasurementUnitsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
