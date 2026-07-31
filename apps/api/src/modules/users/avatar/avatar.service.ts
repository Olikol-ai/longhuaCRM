import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../../common/constants/roles';
import { JwtPayload } from '../../auth/auth.service';
import { UploadedFilePayload } from '../../files/uploaded-file.types';
import { TutorEntity } from '../../tutors/entities/tutor.entity';
import { UserEntity } from '../entities/user.entity';
import {
  AVATAR_ALLOWED_EXT,
  AVATAR_ALLOWED_MIME,
  AVATAR_MAX_BYTES,
  AVATAR_OPTIMIZED_SIZE,
  AVATAR_THUMB_SIZE,
  avatarAbsoluteFromRelative,
  avatarOptimizedRelativePath,
  avatarThumbRelativePath,
  ensureAvatarUserDir,
} from './avatar-storage';
import { getUploadsRoot } from '../../../common/storage/uploads-root';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(String(value || '').trim());
}

export type AvatarUploadResult = {
  id: string;
  has_avatar: true;
  avatar_updated_at: string;
};

export type AvatarStreamResult =
  | { notModified: true; etag: string }
  | {
      notModified: false;
      etag: string;
      file: StreamableFile;
      contentType: string;
    };

@Injectable()
export class AvatarService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
  ) {}

  assertCanManageAvatar(actor: JwtPayload, targetUserId: string): void {
    if (normalizeRole(actor.role) === 'admin') {
      return;
    }
    if (actor.sub !== targetUserId) {
      throw new ForbiddenException('Можно менять только свою фотографию');
    }
  }

  async upload(
    actor: JwtPayload,
    targetUserId: string,
    file: UploadedFilePayload & { mimetype?: string },
  ): Promise<AvatarUploadResult> {
    this.assertCanManageAvatar(actor, targetUserId);
    this.validateUpload(file);

    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const pipeline = sharp(file.buffer).rotate();
    const optimized = await pipeline
      .clone()
      .resize(AVATAR_OPTIMIZED_SIZE, AVATAR_OPTIMIZED_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 82 })
      .toBuffer();

    const thumb = await sharp(file.buffer)
      .rotate()
      .resize(AVATAR_THUMB_SIZE, AVATAR_THUMB_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 80 })
      .toBuffer();

    ensureAvatarUserDir(targetUserId);
    const optimizedRel = avatarOptimizedRelativePath(targetUserId);
    const thumbRel = avatarThumbRelativePath(targetUserId);

    this.safeUnlink(user.avatarFilePath);
    this.safeUnlink(user.avatarThumbPath);

    writeFileSync(avatarAbsoluteFromRelative(optimizedRel), optimized);
    writeFileSync(avatarAbsoluteFromRelative(thumbRel), thumb);

    const updatedAt = new Date();
    user.avatarFilePath = optimizedRel;
    user.avatarThumbPath = thumbRel;
    user.avatarUpdatedAt = updatedAt;
    await this.userRepo.save(user);

    return {
      id: user.id,
      has_avatar: true,
      avatar_updated_at: updatedAt.toISOString(),
    };
  }

  async remove(
    actor: JwtPayload,
    targetUserId: string,
  ): Promise<{ id: string; has_avatar: false }> {
    this.assertCanManageAvatar(actor, targetUserId);
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.safeUnlink(user.avatarFilePath);
    this.safeUnlink(user.avatarThumbPath);
    user.avatarFilePath = null;
    user.avatarThumbPath = null;
    user.avatarUpdatedAt = null;
    await this.userRepo.save(user);

    return { id: user.id, has_avatar: false };
  }

  async stream(
    targetUserId: string,
    thumb: boolean,
    ifNoneMatch?: string,
  ): Promise<AvatarStreamResult> {
    if (!isUuid(targetUserId)) {
      throw new NotFoundException('User not found');
    }

    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let relative = thumb
      ? user.avatarThumbPath || user.avatarFilePath
      : user.avatarFilePath || user.avatarThumbPath;

    if (!relative) {
      relative = await this.tryMigrateTutorPhotoFallback(user, thumb);
    }

    if (!relative) {
      throw new NotFoundException('Avatar not found');
    }

    const absolute = this.resolveReadablePath(relative);
    if (!absolute || !existsSync(absolute)) {
      throw new NotFoundException('Avatar file missing');
    }

    const stats = statSync(absolute);
    const etag = `"${stats.mtimeMs}-${stats.size}"`;
    if (ifNoneMatch && ifNoneMatch === etag) {
      return { notModified: true, etag };
    }

    const stream = createReadStream(absolute);
    return {
      notModified: false,
      etag,
      contentType: 'image/webp',
      file: new StreamableFile(stream, {
        type: 'image/webp',
        disposition: 'inline',
        length: stats.size,
      }),
    };
  }

  private async tryMigrateTutorPhotoFallback(
    user: UserEntity,
    preferThumb: boolean,
  ): Promise<string | null> {
    const tutor = await this.tutorRepo.findOne({ where: { userId: user.id } });
    const photoUrl = tutor?.photoUrl?.trim();
    if (!photoUrl) {
      return null;
    }

    const found = this.findExistingUpload(photoUrl);
    if (!found) {
      return null;
    }

    try {
      const source = readFileSync(found);
      const optimized = await sharp(source)
        .rotate()
        .resize(AVATAR_OPTIMIZED_SIZE, AVATAR_OPTIMIZED_SIZE, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality: 82 })
        .toBuffer();
      const thumbBuf = await sharp(source)
        .rotate()
        .resize(AVATAR_THUMB_SIZE, AVATAR_THUMB_SIZE, {
          fit: 'cover',
          position: 'centre',
        })
        .webp({ quality: 80 })
        .toBuffer();

      ensureAvatarUserDir(user.id);
      const optimizedRel = avatarOptimizedRelativePath(user.id);
      const thumbRel = avatarThumbRelativePath(user.id);
      writeFileSync(avatarAbsoluteFromRelative(optimizedRel), optimized);
      writeFileSync(avatarAbsoluteFromRelative(thumbRel), thumbBuf);

      user.avatarFilePath = optimizedRel;
      user.avatarThumbPath = thumbRel;
      user.avatarUpdatedAt = new Date();
      await this.userRepo.save(user);
      return preferThumb ? thumbRel : optimizedRel;
    } catch {
      return null;
    }
  }

  private findExistingUpload(photoUrl: string): string | null {
    const cleaned = photoUrl
      .replace(/^\/uploads\//, '')
      .replace(/^uploads\//, '')
      .replace(/^\/+/, '');
    const candidates = [
      this.resolveReadablePath(cleaned),
      join(getUploadsRoot(), cleaned),
      join(process.cwd(), photoUrl.replace(/^\//, '')),
      join(process.cwd(), 'uploads', cleaned),
    ];
    return candidates.find((p): p is string => Boolean(p && existsSync(p))) ?? null;
  }

  private validateUpload(file: UploadedFilePayload & { mimetype?: string }): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл обязателен');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Размер файла не должен превышать 5 МБ');
    }
    const extension = extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (!AVATAR_ALLOWED_EXT.has(extension) && !AVATAR_ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('Допустимы только JPG, PNG или WebP');
    }
  }

  private resolveReadablePath(relativeOrUrl: string): string | null {
    const cleaned = relativeOrUrl
      .replace(/^\/uploads\//, '')
      .replace(/^uploads\//, '')
      .replace(/^\/+/, '');
    if (!cleaned || cleaned.includes('..')) {
      return null;
    }
    return avatarAbsoluteFromRelative(cleaned);
  }

  private safeUnlink(relativePath: string | null | undefined): void {
    if (!relativePath) return;
    const abs = this.resolveReadablePath(relativePath);
    if (abs && existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        // ignore
      }
    }
  }
}
