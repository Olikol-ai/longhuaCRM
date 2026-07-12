import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { MaterialEntity } from '../materials/entities/material.entity';
import { MaterialsModule } from '../materials/materials.module';
import { SecureFilesController } from './secure-files.controller';
import { SecureFilesService } from './secure-files.service';
import { SignedFileUrlService } from './signed-file-url.service';

@Module({
  imports: [
    forwardRef(() => MaterialsModule),
    TypeOrmModule.forFeature([MaterialEntity, MaterialAccessEntity]),
  ],
  controllers: [SecureFilesController],
  providers: [SignedFileUrlService, SecureFilesService],
  exports: [SignedFileUrlService, SecureFilesService],
})
export class SecureFilesModule {}
