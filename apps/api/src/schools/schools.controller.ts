import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.detail(user, id);
  }
}
