import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface BucketEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, BucketEntry>();

  /** Returns true if allowed; throws 429 if limit exceeded. */
  assertAllowed(key: string, maxAttempts: number, windowMs: number): void {
    const now = Date.now();
    const entry = this.buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (entry.count >= maxAttempts) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      throw new HttpException(
        `Too many attempts. Retry in ${retryAfterSec}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
