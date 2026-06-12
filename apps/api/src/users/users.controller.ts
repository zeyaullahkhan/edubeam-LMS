import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser, Role } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtGuard, AdminGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() admin: AuthUser, @Query('q') q?: string, @Query('role') role?: string) {
    return this.users.list(admin, { q, role });
  }

  @Post()
  create(
    @CurrentUser() admin: AuthUser,
    @Body() body: { email: string; name: string; password: string; role: Role; districtId?: string; schoolId?: string },
  ) {
    return this.users.create(admin, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; role?: Role; active?: boolean; districtId?: string | null; schoolId?: string | null; password?: string },
  ) {
    return this.users.update(admin, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    return this.users.remove(admin, id);
  }
}
