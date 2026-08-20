import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  formatMaterialsMaxUploadLabel,
  getMaterialsMaxUploadBytes,
} from '../../modules/files/material-upload.limits';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'object' && body !== null
          ? { ...(body as Record<string, unknown>), status }
          : { error: body, status };

      if (status >= 400 && status < 500) {
        const detail =
          typeof body === 'object' && body !== null && 'message' in body
            ? (body as { message?: unknown }).message
            : body;
        this.logger.warn(
          `HTTP ${status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
        );
      }

      response.status(status).json(payload);
      return;
    }

    this.logger.error((exception as Error)?.message, (exception as Error)?.stack);

    const multerCode = (exception as { code?: string })?.code;
    if (multerCode === 'LIMIT_FILE_SIZE') {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        message: `Размер файла не должен превышать ${formatMaterialsMaxUploadLabel(getMaterialsMaxUploadBytes())}`,
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
