import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlannerService } from './planner.service';

@Controller('planner')
@UseGuards(JwtGuard)
export class PlannerController {
  constructor(private readonly svc: PlannerService) {}

  @Get('scope-options')
  getScopeOptions(@CurrentUser() user: AuthUser) {
    return this.svc.getScopeOptions(user);
  }

  @Get('holidays')
  getHolidays(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.svc.getHolidays(user, month);
  }

  @Get('holidays/upcoming')
  getUpcoming(@CurrentUser() user: AuthUser) {
    return this.svc.getUpcoming(user);
  }

  @Post('holidays')
  createHoliday(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createHoliday(user, dto);
  }

  @Delete('holidays/:id')
  deleteHoliday(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteHoliday(user, id);
  }

  @Get('events')
  getEvents(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.svc.getEvents(user, month);
  }

  @Post('events')
  createEvent(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createEvent(user, dto);
  }

  @Delete('events/:id')
  deleteEvent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteEvent(user, id);
  }

  // ── Notices ──────────────────────────────────────────────────────────────────

  @Get('notices')
  getNotices(@CurrentUser() user: AuthUser, @Query('schoolId') schoolId?: string) {
    return this.svc.getAllNotices(user, schoolId);
  }

  @Post('notices')
  createNotice(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createNotice(user, dto);
  }

  @Patch('notices/:id')
  updateNotice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateNotice(user, id, dto);
  }

  @Delete('notices/:id')
  deleteNotice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteNotice(user, id);
  }
}
