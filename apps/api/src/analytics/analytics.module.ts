import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { KpiService } from './kpi.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PlannerService } from '../planner/planner.service';

@Module({
  providers: [AnalyticsService, KpiService, AttendanceService, PlannerService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
