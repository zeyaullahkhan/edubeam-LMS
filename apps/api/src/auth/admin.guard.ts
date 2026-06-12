import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthedRequest } from './jwt.guard';

/** Allows only ADMIN users. Use after JwtGuard so req.user is populated. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    return true;
  }
}
