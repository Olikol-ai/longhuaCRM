import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { UploadedFilePayload } from '../../files/uploaded-file.types';
import { AVATAR_MAX_BYTES } from './avatar-storage';
import { AvatarService } from './avatar.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Get(':id/avatar')
  async getAvatar(
    @Param('id') id: string,
    @Query('thumb') thumb: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.avatarService.stream(
      id,
      thumb === '1' || thumb === 'true',
      ifNoneMatch,
    );

    res.setHeader('ETag', result.etag);
    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, must-revalidate',
    );

    if (result.notModified) {
      res.status(304);
      return;
    }

    res.setHeader('Content-Type', result.contentType);
    return result.file;
  }

  @Post('me/avatar')
  @Roles('admin', 'teacher', 'tutor', 'student', 'tutor_student')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_MAX_BYTES },
    }),
  )
  uploadMine(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: UploadedFilePayload & { mimetype?: string },
  ) {
    return this.avatarService.upload(user, user.sub, file);
  }

  @Post(':id/avatar')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_MAX_BYTES },
    }),
  )
  uploadForUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: UploadedFilePayload & { mimetype?: string },
  ) {
    return this.avatarService.upload(user, id, file);
  }

  @Delete('me/avatar')
  @Roles('admin', 'teacher', 'tutor', 'student', 'tutor_student')
  @HttpCode(200)
  removeMine(@CurrentUser() user: JwtPayload) {
    return this.avatarService.remove(user, user.sub);
  }

  @Delete(':id/avatar')
  @Roles('admin')
  @HttpCode(200)
  removeForUser(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.avatarService.remove(user, id);
  }
}
