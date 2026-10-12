import { ValidationPipe, type INestApplication } from '@nestjs/common';

export function configureApplication(
  app: INestApplication,
  frontendOrigin: string,
): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: frontendOrigin, credentials: true });
}
