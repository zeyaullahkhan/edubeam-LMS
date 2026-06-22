import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
}
