import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { CRM_ENTITY_CLASSES } from '../../common/constants/entity-registry';

import { RolesGuard } from '../../common/guards/roles.guard';

import { PaymentsModule } from '../payments/payments.module';
import { StudentsModule } from '../students/students.module';

import { UsersModule } from '../users/users.module';

import { EntitiesController } from './entities.controller';

import { EntityAccessService } from './entity-access.service';

import { EntityRepositoryService } from './entity-repository.service';



@Module({

  imports: [UsersModule, PaymentsModule, StudentsModule, TypeOrmModule.forFeature(CRM_ENTITY_CLASSES)],

  controllers: [EntitiesController],

  providers: [EntityRepositoryService, EntityAccessService, RolesGuard],

  exports: [EntityRepositoryService, EntityAccessService, RolesGuard],

})

export class EntitiesModule {}


