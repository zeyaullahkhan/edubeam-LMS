import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { KpiService } from './kpi.service';

@Module({
  providers: [AnalyticsService, KpiService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
