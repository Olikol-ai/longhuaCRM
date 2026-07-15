import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

interface BucketEntry {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000;
const PRUNE_INTERVAL_MS = 60_000;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly buckets = new Map<string, BucketEntry>();
  private readonly pruneTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.pruneTimer = setInterval(() => this.pruneExpired(), PRUNE_INTERVAL_MS);
    // Do not keep the process alive solely for pruning.
    this.pruneTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.pruneTimer);
  }

  /** Returns true if allowed; throws 429 if limit exceeded. */
  assertAllowed(
    key: string,
    maxAttempts: number,
    windowMs: number,
    message = 'Too many attempts',
  ): void {
    const now = Date.now();
    if (this.buckets.size > MAX_BUCKETS) {
      this.pruneExpired(now);
    }

    const entry = this.buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.enforceCap();
      return;
    }

    if (entry.count >= maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new HttpException(
        {
          success: false,
          message,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private pruneExpired(now = Date.now()): void {
    for (const [key, entry] of this.buckets) {
      if (entry.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private enforceCap(): void {
    if (this.buckets.size <= MAX_BUCKETS) {
      return;
    }
    this.pruneExpired();
    // Drop oldest remaining entries if still over cap (pathological unique keys).
    while (this.buckets.size > MAX_BUCKETS) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.buckets.delete(oldest);
    }
  }
}
