import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import type { AuthedRequest } from './jwt.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
