import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialAccessEntity } from './entities/material-access.entity';
import { MaterialEntity } from './entities/material.entity';
import { MaterialFolderEntity } from './entities/material-folder.entity';
import { MaterialLinkEntity } from './entities/material-link.entity';
import { MaterialsController } from './materials.controller';
import { MaterialsRepository } from './materials.repository';
import { MaterialsService } from './materials.service';
import { MaterialAccessCheckService } from './material-access-check.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaterialEntity,
      MaterialFolderEntity,
      MaterialAccessEntity,
      MaterialLinkEntity,
    ]),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsRepository, MaterialsService, MaterialAccessCheckService],
  exports: [MaterialsRepository, MaterialsService, MaterialAccessCheckService, TypeOrmModule],
})
export class MaterialsModule {}
