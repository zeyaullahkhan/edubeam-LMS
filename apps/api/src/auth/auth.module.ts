import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LoginThrottleGuard } from './login-throttle.guard';

@Module({
  providers: [AuthService, LoginThrottleGuard],
  controllers: [AuthController],
})
export class AuthModule {}
