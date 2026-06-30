import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonMaterialEntity } from '../../entities/LessonMaterial.entity';
import { MaterialAccessEntity } from '../../entities/MaterialAccess.entity';
import { MaterialAccessCheckService } from '../entities/material-access-check.service';
import { SecureFilesController } from './secure-files.controller';
import { SecureFilesService } from './secure-files.service';
import { SignedFileUrlService } from './signed-file-url.service';

@Module({
  imports: [TypeOrmModule.forFeature([LessonMaterialEntity, MaterialAccessEntity])],
  controllers: [SecureFilesController],
  providers: [
    SignedFileUrlService,
    MaterialAccessCheckService,
    SecureFilesService,
  ],
  exports: [SignedFileUrlService, SecureFilesService],
})
export class SecureFilesModule {}
