import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SchoolsService } from './schools.service';

@Controller('schools')
@UseGuards(JwtGuard)
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('q') q?: string,
  ) {
    return this.schools.list(user, { districtId, blockId, q });
  }

  @Get('meta/districts')
  districts(@CurrentUser() user: AuthUser) {
    return this.schools.listDistricts(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.detail(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.schools.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.update(user, id, body);
  }
}
