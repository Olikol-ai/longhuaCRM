import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @Roles('admin', 'teacher', 'tutor')
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
  async streamSigned(@Param('token') token: string) {
    return this.secureFiles.streamSignedFile(token);
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
    // Throws NotFoundException when the DB row exists but the blob is gone —
    // same ACL as list, honest disk check (no signed URL for orphans).
    const url = await this.secureFiles.createSignedFileUrl(
      user.sub,
      materialId,
      user.role,
    );
    return { url };
  }
}
