import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
@UseGuards(JwtGuard)
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  // ── Student attendance ──────────────────────────────────────────────────

  @Post('students/mark')
  markStudents(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.markStudents(user, dto);
  }

  @Get('students/date')
  getByDate(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId: string,
    @Query('date') date: string,
    @Query('grade') grade?: string,
  ) {
    return this.svc.getByDate(user, schoolId, date, grade ? Number(grade) : undefined);
  }

  @Get('students/calendar')
  getCalendar(@Query('studentId') studentId: string, @Query('month') month: string) {
    return this.svc.getStudentCalendar(studentId, month);
  }

  @Get('students/monthly')
  getMonthly(
    @Query('schoolId') schoolId: string,
    @Query('month') month: string,
    @Query('grade') grade?: string,
  ) {
    return this.svc.getMonthlyReport(schoolId, month, grade ? Number(grade) : undefined);
  }

  @Get('students/report')
  getDateReport(
    @Query('schoolId') schoolId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getSchoolDateReport(schoolId, from, to);
  }

  // ── Staff attendance ────────────────────────────────────────────────────

  @Post('staff/mark')
  markStaff(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.markStaff(user, dto);
  }

  @Get('staff/date')
  getStaffByDate(@Query('schoolId') schoolId: string, @Query('date') date: string) {
    return this.svc.getStaffByDate(schoolId, date);
  }

  @Get('staff/monthly')
  getStaffMonthly(@Query('schoolId') schoolId: string, @Query('month') month: string) {
    return this.svc.getStaffMonthlyReport(schoolId, month);
  }

  // ── Exam results ────────────────────────────────────────────────────────

  @Post('results/save')
  saveResults(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.saveResults(user, dto);
  }

  @Get('results/reportcard')
  getReportCard(@Query('studentId') studentId: string, @Query('year') year: string) {
    return this.svc.getReportCard(studentId, year);
  }

  @Get('results/class')
  getClassResults(
    @Query('schoolId') schoolId: string,
    @Query('grade') grade: string,
    @Query('examType') examType: string,
    @Query('year') year: string,
    @Query('section') section?: string,
  ) {
    return this.svc.getClassResults(schoolId, Number(grade), examType, year, section);
  }

  // ── Student self-service ────────────────────────────────────────────────

  @Get('students/me')
  getStudentProfile(@CurrentUser() user: AuthUser) {
    return this.svc.getStudentProfile(user);
  }

  // ── Parent portal ────────────────────────────────────────────────────────

  @Get('children')
  getChildren(@CurrentUser() user: AuthUser) {
    return this.svc.getChildren(user);
  }

  // ── Dashboard today summary ─────────────────────────────────────────────

  @Get('today')
  today(@CurrentUser() user: AuthUser, @Query('schoolId') schoolId?: string) {
    return this.svc.todaySummary(user, schoolId);
  }
}
