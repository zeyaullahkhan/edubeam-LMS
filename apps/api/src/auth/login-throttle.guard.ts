import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Lightweight in-memory rate limiter for the login endpoint.
 *
 * Limits attempts per client IP within a sliding window. This guards against
 * brute-force / credential-stuffing — important because default passwords are
 * derived from usernames during rollout.
 *
 * In-memory is sufficient for the single Render instance. If we scale to
 * multiple instances, move this to a shared store (Redis) so the counter is
 * global rather than per-process.
 */
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // per IP per window

type Bucket = { count: number; resetAt: number };

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = this.clientIp(req);
    const now = Date.now();

    let bucket = this.buckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      this.buckets.set(ip, bucket);
    }

    bucket.count += 1;

    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (this.buckets.size > 10_000) {
      for (const [key, b] of this.buckets) {
        if (now > b.resetAt) this.buckets.delete(key);
      }
    }

    if (bucket.count > MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private clientIp(req: Request): string {
    // Render terminates TLS at a proxy, so the real client IP is in
    // X-Forwarded-For (first hop). Fall back to the socket address locally.
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
    if (Array.isArray(fwd) && fwd.length) return fwd[0];
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
