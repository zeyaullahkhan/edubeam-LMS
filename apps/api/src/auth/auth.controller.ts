import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { LoginThrottleGuard } from './login-throttle.guard';
import { CurrentUser } from './current-user.decorator';
import { prisma } from '@edubeam/db';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @UseGuards(LoginThrottleGuard)
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('tenants')
  @UseGuards(JwtGuard)
  tenants() {
    return prisma.tenant.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } });
  }
}
