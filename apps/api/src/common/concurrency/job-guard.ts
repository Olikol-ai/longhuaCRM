import { Logger } from '@nestjs/common';

/**
 * Prevents overlapping cron/job invocations in a single process.
 * If a previous run is still awaiting I/O, subsequent ticks are skipped.
 */
export class JobGuard {
  private running = false;

  constructor(
    private readonly logger: Logger,
    private readonly name: string,
  ) {}

  async run(fn: () => Promise<void>): Promise<boolean> {
    if (this.running) {
      this.logger.warn(`Skip ${this.name}: previous run still in progress`);
      return false;
    }
    this.running = true;
    try {
      await fn();
      return true;
    } finally {
      this.running = false;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }
}
