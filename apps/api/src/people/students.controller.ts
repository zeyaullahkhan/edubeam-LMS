import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StudentsService } from './students.service';

const bool = (v?: string) => (v === undefined ? undefined : v === 'true' || v === '1');
const num = (v?: string) => (v ? Number(v) : undefined);

@Controller('students')
@UseGuards(JwtGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
    @Query('grade') grade?: string,
    @Query('gender') gender?: string,
    @Query('q') q?: string,
    @Query('rte') rte?: string,
    @Query('dropout') dropout?: string,
  ) {
    return this.students.list(user, { districtId, blockId, schoolId, grade: num(grade), gender, q, rte: bool(rte), dropout: bool(dropout) });
  }

  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.students.summary(user, { districtId, blockId, schoolId });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.students.create(user, body);
  }

  @Post('bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() body: { schoolId?: string; rows: any[] }) {
    return this.students.bulkCreate(user, body.schoolId, body.rows);
  }

  @Post('promote')
  promote(@CurrentUser() user: AuthUser, @Body() body: { schoolId?: string; grade?: number }) {
    return this.students.promote(user, body?.schoolId, body?.grade);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.students.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.remove(user, id);
  }
}
