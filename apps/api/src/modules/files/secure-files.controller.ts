import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { MaterialAccessCheckService } from '../entities/material-access-check.service';
import { SecureFilesService } from './secure-files.service';

@Controller('files')
export class SecureFilesController {
  constructor(
    private readonly secureFiles: SecureFilesService,
    private readonly materialAccess: MaterialAccessCheckService,
  ) {}

  @Get('signed/:token')
  async streamSigned(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.secureFiles.streamSignedFile(token);
    return file;
  }

  @Get('material/:materialId/url')
  @UseGuards(JwtAuthGuard)
  async getMaterialFileUrl(
    @CurrentUser() user: JwtPayload,
    @Param('materialId') materialId: string,
  ) {
    const allowed = await this.materialAccess.canAccessMaterial(
      user.sub,
      materialId,
      user.role,
    );
    if (!allowed) {
      return { url: null };
    }
    return {
      url: this.secureFiles.createSignedFileUrl(user.sub, materialId, user.role),
    };
  }
}
