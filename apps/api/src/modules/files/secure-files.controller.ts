import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { streamFileWithOptionalRange } from '../../common/http/byte-range';
import { JwtPayload } from '../auth/auth.service';
import { MaterialAccessCheckService } from '../materials/material-access-check.service';
import {
  ChunkedUploadService,
  MATERIALS_UPLOAD_CHUNK_BYTES,
  getUploadTempRoot,
} from './chunked-upload.service';
import {
  AbortChunkedUploadDto,
  CompleteChunkedUploadDto,
  InitChunkedUploadDto,
} from './dto/chunked-upload.dto';
import { getMaterialsMaxUploadBytes } from './material-upload.limits';
import { SecureFilesService } from './secure-files.service';
import { UploadedFilePayload } from './uploaded-file.types';

function ensureUploadTempDir(): string {
  const root = getUploadTempRoot();
  mkdirSync(root, { recursive: true });
  return root;
}

const materialUploadInterceptor = FileInterceptor('file', {
  // Disk storage: large textbooks/videos must not fill Node heap.
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureUploadTempDir());
      } catch (err) {
        cb(err as Error, getUploadTempRoot());
      }
    },
    filename: (_req, file, cb) => {
      const extension = extname(file.originalname || '').toLowerCase();
      cb(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: getMaterialsMaxUploadBytes() },
});

/** Chunk parts stay under Cloudflare edge body limits (~100 MB). */
const materialChunkInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureUploadTempDir());
      } catch (err) {
        cb(err as Error, getUploadTempRoot());
      }
    },
    filename: (_req, _file, cb) => {
      cb(null, `${randomUUID()}.part`);
    },
  }),
  limits: { fileSize: MATERIALS_UPLOAD_CHUNK_BYTES + 1024 * 1024 },
});

@Controller('files')
export class SecureFilesController {
  constructor(
    private readonly secureFiles: SecureFilesService,
    private readonly materialAccess: MaterialAccessCheckService,
    private readonly chunkedUpload: ChunkedUploadService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'teacher', 'tutor')
  @UseInterceptors(materialUploadInterceptor)
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

  /**
   * Start a chunked upload session. Required when a single POST would exceed
   * Cloudflare's proxied request-body limit (~100 MB on Free/Pro).
   */
  @Post('upload/init')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'teacher', 'tutor')
  initChunkedUpload(
    @CurrentUser() user: JwtPayload,
    @Body() body: InitChunkedUploadDto,
  ) {
    const session = this.chunkedUpload.initSession({
      userId: user.sub,
      originalName: body.originalName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });
    return {
      upload_id: session.uploadId,
      chunk_size_bytes: session.chunkSizeBytes,
      total_chunks: session.totalChunks,
      max_upload_bytes: getMaterialsMaxUploadBytes(),
    };
  }

  @Post('upload/chunk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'teacher', 'tutor')
  @UseInterceptors(materialChunkInterceptor)
  uploadChunk(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: UploadedFilePayload,
    @Body('uploadId') uploadId: string,
    @Body('chunkIndex') chunkIndexRaw: string,
  ) {
    const chunkIndex = Number.parseInt(String(chunkIndexRaw), 10);
    const result = this.chunkedUpload.saveChunk({
      userId: user.sub,
      uploadId: String(uploadId || ''),
      chunkIndex,
      file,
    });
    return {
      received_chunks: result.receivedChunks,
      total_chunks: result.totalChunks,
    };
  }

  @Post('upload/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'teacher', 'tutor')
  async completeChunkedUpload(
    @CurrentUser() user: JwtPayload,
    @Body() body: CompleteChunkedUploadDto,
  ) {
    const saved = await this.chunkedUpload.complete({
      userId: user.sub,
      uploadId: body.uploadId,
    });
    return {
      url: saved.url,
      mime_type: saved.mimeType,
      size_bytes: saved.sizeBytes,
      original_name: saved.originalName,
      stored_name: saved.storedName,
      file_type: saved.fileType,
    };
  }

  @Delete('upload/:uploadId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'teacher', 'tutor')
  abortChunkedUpload(
    @CurrentUser() user: JwtPayload,
    @Param('uploadId', new ParseUUIDPipe({ version: '4' })) uploadId: string,
  ) {
    this.chunkedUpload.abort(uploadId, user.sub);
    return { ok: true };
  }

  @Post('upload/abort')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'teacher', 'tutor')
  abortChunkedUploadPost(
    @CurrentUser() user: JwtPayload,
    @Body() body: AbortChunkedUploadDto,
  ) {
    this.chunkedUpload.abort(body.uploadId, user.sub);
    return { ok: true };
  }

  /**
   * Stream a material file via HMAC-signed token (issued after ACL at /url).
   * Supports Range / 206 so HTML5 <audio>/<video> can open and seek — same
   * contract as chat attachment downloads.
   */
  @SkipThrottle()
  @Get('signed/:token')
  async streamSigned(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.secureFiles.resolveSignedMaterialFile(token);
    streamFileWithOptionalRange(
      response,
      {
        absolutePath: file.absolutePath,
        size: file.size,
        contentType: file.contentType,
        contentDisposition: file.contentDisposition,
        rangeHeader: request.headers.range,
      },
      request.headers as Record<string, string | string[] | undefined>,
    );
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
    const url = await this.secureFiles.createSignedFileUrl(
      user.sub,
      materialId,
      user.role,
    );
    return { url };
  }
}
