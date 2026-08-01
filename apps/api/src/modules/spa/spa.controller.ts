import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';
import { isStaticAssetRequestPath } from './spa-static-path';

const INDEX_HTML = join(__dirname, '../../../dist/index.html');

/**
 * SPA fallback for client-side routes.
 * Must never send index.html for missing JS/CSS assets (MIME type errors).
 */
@Controller()
export class SpaController {
  @Get('*path')
  fallback(@Req() req: Request, @Res() res: Response) {
    const pathname = req.path || '/';

    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/uploads') ||
      pathname.startsWith('/socket.io')
    ) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (isStaticAssetRequestPath(pathname)) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(404).type('text/plain').send('Not found');
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(INDEX_HTML);
  }
}
