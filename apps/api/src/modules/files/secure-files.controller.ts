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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { MaterialAccessCheckService } from '../materials/material-access-check.service';
import { getMaterialsMaxUploadBytes } from './material-upload.limits';
import { SecureFilesService } from './secure-files.service';
import { UploadedFilePayload } from './uploaded-file.types';

const UPLOAD_TEMP_DIR = join(tmpdir(), 'longhua-material-uploads');

function ensureUploadTempDir(): string {
  mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
  return UPLOAD_TEMP_DIR;
}

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
      // Disk storage: large textbooks/videos must not fill Node heap.
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          try {
            cb(null, ensureUploadTempDir());
          } catch (err) {
            cb(err as Error, UPLOAD_TEMP_DIR);
          }
        },
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: getMaterialsMaxUploadBytes() },
    }),
  )
  uploadMaterialFile(@UploadedFile() file: UploadedFilePayload) {
    const saved = this.secureFiles.saveUploadedFile(file);
    return {
      url: saved.url,
      mime_type: saved.mimeType,
      size_bytes: saved.sizeBytes,
      original_name: saved.originalName,
      stored_name: saved.storedName,
      file_type: saved.fileType,
    };
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
      this.secureFiles.logDeniedOpen(user.sub, materialId, user.role);
      return { url: null };
    }
    // Local uploads: signed URL after disk check. External http(s) (Canva): stored URL as-is.
    const url = await this.secureFiles.createSignedFileUrl(
      user.sub,
      materialId,
      user.role,
    );
    return { url };
  }
}
