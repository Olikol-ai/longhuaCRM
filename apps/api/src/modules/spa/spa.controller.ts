import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';

@Controller()
export class SpaController {
  @Get('*path')
  fallback(@Req() req: Request, @Res() res: Response) {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.sendFile(join(__dirname, '../../../dist/index.html'));
  }
}
