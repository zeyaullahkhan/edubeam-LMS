import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
// Load .env from apps/api directory before any Prisma client is imported
config({ path: resolve(__dirname, '..', '.env') });
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (HSTS, X-Frame-Options, no-sniff, etc.). CSP is left off
  // because the SPA loads CDN fonts/icons; tighten with a CSP allow-list later.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Raise body limit: AI quiz generation posts a base64-encoded PDF/photo of a
  // few book pages, which can be several MB.
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Behind Render's TLS proxy — trust X-Forwarded-* so req.ip is the real client
  // (used by the login rate limiter).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // In production the SPA is served from this same origin, so cross-origin
  // requests are not needed — leave CORS off. For local dev the Vite server
  // proxies /api, so it's same-origin there too. Only enable CORS for an
  // explicit allow-list of origins if ever set via env.
  const allowed = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed?.length) {
    app.enableCors({ origin: allowed, credentials: true });
  }

  app.setGlobalPrefix('api');
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Edubeam LMS listening on port ${port} (API under /api)`);
}

bootstrap();
