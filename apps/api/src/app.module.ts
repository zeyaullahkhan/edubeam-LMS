import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Module, type DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SchoolsModule } from './schools/schools.module';
import { UsersModule } from './users/users.module';
import { PeopleModule } from './people/people.module';
import { JWT_SECRET } from './auth/constants';

// In production the built React SPA (apps/web/dist) is served from this same
// service, so the whole app lives on one origin (no CORS). The dist folder only
// exists after `vite build`, so we serve it conditionally — in local dev the web
// app runs on its own Vite server and this module is skipped.
function serveStatic(): DynamicModule[] {
  const webDist = join(__dirname, '..', '..', 'web', 'dist');
  if (!existsSync(join(webDist, 'index.html'))) return [];
  return [
    ServeStaticModule.forRoot({
      rootPath: webDist,
      exclude: ['/api/(.*)'],
    }),
  ];
}

@Module({
  imports: [
    JwtModule.register({ global: true, secret: JWT_SECRET, signOptions: { expiresIn: '12h' } }),
    ...serveStatic(),
    AuthModule,
    AnalyticsModule,
    SchoolsModule,
    UsersModule,
    PeopleModule,
  ],
})
export class AppModule {}
