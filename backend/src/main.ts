import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApplication } from './app-setup.js';
import { loadEnvironment } from './config/environment.js';

async function bootstrap() {
  const environment = loadEnvironment();
  const app = await NestFactory.create(AppModule);
  configureApplication(app, environment.frontendOrigin);
  app.enableShutdownHooks();
  await app.listen(environment.port);
}
await bootstrap();
