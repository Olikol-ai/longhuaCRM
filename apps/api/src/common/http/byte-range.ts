import { createReadStream } from 'fs';
import type { Response } from 'express';

export type ParsedByteRange =
  | { ok: true; start: number; end: number }
  | { ok: false; reason: 'unsatisfiable' | 'invalid' };

/**
 * Parse a single HTTP Range bytes unit for file streaming (audio/video seek).
 * Supports `bytes=start-end`, `bytes=start-`, and suffix `bytes=-N`.
 */
export function parseBytesRangeHeader(
  rangeHeader: string | undefined,
  size: number,
): ParsedByteRange | null {
  if (!rangeHeader || !/^bytes=/i.test(rangeHeader)) {
    return null;
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'unsatisfiable' };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return { ok: false, reason: 'invalid' };
  }

  let start: number;
  let end: number;

  if (match[1] === '' && match[2] !== '') {
    const suffix = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return { ok: false, reason: 'invalid' };
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = match[1] ? Number.parseInt(match[1], 10) : 0;
    end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
  }

  if (
    !Number.isFinite(start)
    || !Number.isFinite(end)
    || start < 0
    || end < start
    || start >= size
  ) {
    return { ok: false, reason: 'unsatisfiable' };
  }

  end = Math.min(end, size - 1);
  return { ok: true, start, end };
}

export type StreamFileWithOptionalRangeOptions = {
  absolutePath: string;
  size: number;
  contentType: string;
  contentDisposition: string;
  rangeHeader?: string;
  /** When true, mark request so express-compression skips this response. */
  disableCompression?: boolean;
  cacheControl?: string;
};

/**
 * Stream a local file with optional HTTP Range / 206 support.
 * Used by chat attachments and signed material downloads (HTML5 audio/video).
 */
export function streamFileWithOptionalRange(
  response: Response,
  options: StreamFileWithOptionalRangeOptions,
  requestHeaders?: Record<string, string | string[] | undefined>,
): void {
  const {
    absolutePath,
    size,
    contentType,
    contentDisposition,
    rangeHeader,
    disableCompression = true,
    cacheControl = 'private, no-store',
  } = options;

  if (disableCompression && requestHeaders) {
    requestHeaders['x-no-compression'] = '1';
  }

  response.setHeader('Content-Type', contentType);
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Cache-Control', cacheControl);
  response.setHeader('Content-Disposition', contentDisposition);

  const parsed = parseBytesRangeHeader(rangeHeader, size);
  if (parsed) {
    if (!parsed.ok) {
      response.status(416);
      response.setHeader('Content-Range', `bytes */${size}`);
      response.end();
      return;
    }

    const { start, end } = parsed;
    response.status(206);
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    response.setHeader('Content-Length', String(end - start + 1));
    createReadStream(absolutePath, { start, end }).pipe(response);
    return;
  }

  response.setHeader('Content-Length', String(size));
  createReadStream(absolutePath).pipe(response);
}
