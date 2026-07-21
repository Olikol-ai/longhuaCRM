import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(`${req.method} ${req.url} ${ms}ms`);
        },
        error: (err: unknown) => {
          const ms = Date.now() - started;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`${req.method} ${req.url} ${ms}ms failed: ${message}`);
        },
      }),
    );
  }
}
