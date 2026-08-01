import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { isStaticAssetRequestPath } from './spa-static-path';

/**
 * After Nest ServeStatic: missing `/assets/*.js` (etc.) must 404 as plain text,
 * never fall through to a later HTML handler.
 *
 * Paired with ServeStatic `exclude: ['/assets{*path}', ...]` so the built-in
 * `{*any}` → index.html catch-all skips hashed Vite chunks.
 */
@Injectable()
export class SpaFallbackRegistrar implements OnModuleInit {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onModuleInit(): void {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    if (!httpAdapter) {
      return;
    }
    const app = httpAdapter.getInstance();
    if (!app || typeof app.use !== 'function') {
      return;
    }

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      const pathname = req.path || '/';
      if (!isStaticAssetRequestPath(pathname)) {
        return next();
      }

      // express.static already tried; file is missing.
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(404).type('text/plain').send('Not found');
    });
  }
}
