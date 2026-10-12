import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BakeriesModule } from './bakeries/bakeries.module.js';
import { HealthModule } from './health/health.module.js';
import { MaterialsModule } from './materials/materials.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BakeriesModule,
    MaterialsModule,
    ProductsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
