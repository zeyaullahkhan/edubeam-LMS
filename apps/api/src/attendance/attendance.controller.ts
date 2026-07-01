import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Patch } from '@nestjs/common';
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

  @Post('students/clear')
  clearStudents(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.clearStudents(user, dto);
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

  @Get('students/matrix')
  getStudentMatrix(
    @Query('schoolId') schoolId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('grade') grade?: string,
  ) {
    return this.svc.getStudentMatrix(schoolId, from, to, grade ? Number(grade) : undefined);
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

  @Get('staff/matrix')
  getStaffMatrix(
    @Query('schoolId') schoolId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getStaffMatrix(schoolId, from, to);
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

  @Get('today-drilldown')
  todayDrilldown(@CurrentUser() user: AuthUser) {
    return this.svc.todayDrilldown(user);
  }

  // ── Holidays ────────────────────────────────────────────────────────────

  @Post('holidays')
  createHoliday(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createHoliday(user, dto);
  }

  @Get('holidays')
  getHolidays(@Query('schoolId') schoolId: string, @Query('month') month?: string) {
    return this.svc.getHolidays(schoolId, month);
  }

  @Delete('holidays/:id')
  deleteHoliday(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteHoliday(user, id);
  }

  // ── Leave requests ──────────────────────────────────────────────────────

  @Post('leave/apply')
  applyLeave(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.applyLeave(user, dto);
  }

  @Get('leave/my')
  myLeaves(@CurrentUser() user: AuthUser) {
    return this.svc.getMyLeaves(user);
  }

  @Get('leave/school')
  schoolLeaves(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.getSchoolLeaves(user, schoolId, status);
  }

  @Put('leave/:id/approve')
  approveLeave(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateLeaveStatus(user, id, 'APPROVED', dto.remarks);
  }

  @Put('leave/:id/reject')
  rejectLeave(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateLeaveStatus(user, id, 'REJECTED', dto.remarks);
  }
}
