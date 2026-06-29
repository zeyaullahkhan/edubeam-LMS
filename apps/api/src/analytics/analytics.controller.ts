import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { KpiService } from './kpi.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PlannerService } from '../planner/planner.service';
import { resolveScope } from './scope';

// In-memory cache: key = role+tenantId+districtId+schoolId, TTL = 2 min
const snapshotCache = new Map<string, { data: any; ts: number }>();
const SNAPSHOT_TTL = 2 * 60 * 1000;

@Controller('analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly kpi: KpiService,
    private readonly attendanceSvc: AttendanceService,
    private readonly plannerSvc: PlannerService,
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

  @Get('snapshot')
  async snapshot(@CurrentUser() user: AuthUser) {
    const key = `${user.role}|${user.tenantId}|${user.districtId}|${user.schoolId}`;
    const cached = snapshotCache.get(key);
    if (cached && Date.now() - cached.ts < SNAPSHOT_TTL) return cached.data;

    const [overview, districts, mapDistricts, enrollment, teacherStats, todayAtt, holidays] = await Promise.all([
      this.analytics.overview(user),
      this.analytics.districtSummaries(user),
      this.analytics.allDistrictSummaries(user),
      this.analytics.enrollmentDemographics(user),
      this.analytics.teacherStats(user),
      this.attendanceSvc.todaySummary(user).catch(() => null),
      this.plannerSvc.getUpcoming(user, 3).catch(() => []),
    ]);

    const data = { overview, districts, mapDistricts, enrollment, teacherStats, todayAtt, holidays };
    snapshotCache.set(key, { data, ts: Date.now() });
    return data;
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
  async enrollment(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const { schoolWhere } = await resolveScope(user, { districtId, blockId, schoolId });
    return this.analytics.enrollmentDemographics(user, schoolWhere);
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
