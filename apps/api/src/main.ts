import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
// Load .env from apps/api directory before any Prisma client is imported
config({ path: resolve(__dirname, '..', '.env') });
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Edubeam LMS listening on port ${port} (API under /api)`);
}

bootstrap();
