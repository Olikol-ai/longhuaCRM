import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { MaterialAccessCheckService } from '../materials/material-access-check.service';
import { SecureFilesService } from './secure-files.service';
import { UploadedFilePayload } from './uploaded-file.types';

@Controller('files')
export class SecureFilesController {
  constructor(
    private readonly secureFiles: SecureFilesService,
    private readonly materialAccess: MaterialAccessCheckService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadMaterialFile(@UploadedFile() file: UploadedFilePayload) {
    const url = this.secureFiles.saveUploadedFile(file);
    return { url };
  }

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
