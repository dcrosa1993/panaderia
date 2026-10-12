import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BakeriesController } from './bakeries.controller.js';
import { BakeriesService } from './bakeries.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BakeriesController],
  providers: [BakeriesService],
})
export class BakeriesModule {}
