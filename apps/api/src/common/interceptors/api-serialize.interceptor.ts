import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { entityToApiRecord } from '../utils/api-record.util';

/**
 * Maps entity responses to the snake_case API contract.
 * Must NOT touch StreamableFile / Buffer — Object.entries would turn them into
 * JSON like `{ options, stream: { path } }` instead of a binary download.
 */
@Injectable()
export class ApiSerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }
        if (Buffer.isBuffer(data)) {
          return data;
        }
        return entityToApiRecord(data);
      }),
    );
  }
}
