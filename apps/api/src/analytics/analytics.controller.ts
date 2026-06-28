import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { KpiService } from './kpi.service';

@Controller('analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly kpi: KpiService,
  ) {}

  @Get('kpis')
  kpis(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.kpi.kpis(user, { districtId, blockId, schoolId });
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.analytics.overview(user);
  }

  @Get('districts')
  districts(@CurrentUser() user: AuthUser) {
    return this.analytics.districtSummaries(user);
  }

  @Get('map-districts')
  mapDistricts(@CurrentUser() user: AuthUser) {
    return this.analytics.allDistrictSummaries(user);
  }

  @Get('blocks')
  blocks(@CurrentUser() user: AuthUser, @Query('districtId') districtId: string) {
    return this.analytics.blockSummaries(user, districtId);
  }

  @Get('subjects')
  subjects(@CurrentUser() user: AuthUser, @Query('examType') examType?: string) {
    return this.analytics.subjectAverages(user, examType === '12TH' ? '12TH' : '10TH');
  }

  @Get('enrollment')
  enrollment(@CurrentUser() user: AuthUser) {
    return this.analytics.enrollmentDemographics(user);
  }

  @Get('teacher-stats')
  teacherStats(@CurrentUser() user: AuthUser, @Query('districtId') districtId?: string) {
    return this.analytics.teacherStats(user, districtId);
  }

  @Get('attendance')
  attendance(
    @CurrentUser() user: AuthUser,
    @Query('period') period?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.analytics.attendance(
      user,
      period === 'day' ? 'day' : 'month',
      month !== undefined ? parseInt(month, 10) : undefined,
      year !== undefined ? parseInt(year, 10) : undefined,
    );
  }
}
