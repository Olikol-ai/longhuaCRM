import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonMaterialEntity } from '../../entities/lesson-material.entity';
import { MaterialAccessEntity } from '../../entities/material-access.entity';
import { EntitiesModule } from '../entities/entities.module';
import { SecureFilesController } from './secure-files.controller';
import { SecureFilesService } from './secure-files.service';
import { SignedFileUrlService } from './signed-file-url.service';

@Module({
  imports: [
    forwardRef(() => EntitiesModule),
    TypeOrmModule.forFeature([LessonMaterialEntity, MaterialAccessEntity]),
  ],
  controllers: [SecureFilesController],
  providers: [SignedFileUrlService, SecureFilesService],
  exports: [SignedFileUrlService, SecureFilesService],
})
export class SecureFilesModule {}
