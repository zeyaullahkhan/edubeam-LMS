import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
    @Query('staffType') staffType?: string,
    @Query('q') q?: string,
  ) {
    return this.staff.list(user, { districtId, blockId, schoolId, staffType, q });
  }

  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.staff.summary(user, { districtId, blockId, schoolId });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.staff.create(user, body);
  }

  @Post('bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() body: { schoolId?: string; rows: any[] }) {
    return this.staff.bulkCreate(user, body.schoolId, body.rows);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.staff.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staff.remove(user, id);
  }
}
