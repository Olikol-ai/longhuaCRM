import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { CRM_ENTITY_CLASSES } from '../../common/constants/entity-registry';

import { RolesGuard } from '../../common/guards/roles.guard';

import { PaymentsModule } from '../payments/payments.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { StudentsModule } from '../students/students.module';

import { UsersModule } from '../users/users.module';

import { EntitiesController } from './entities.controller';
import { MaterialAccessController } from './material-access.controller';

import { EntityAccessService } from './entity-access.service';

import { EntityRepositoryService } from './entity-repository.service';
import { MaterialAccessCheckService } from './material-access-check.service';



@Module({

  imports: [UsersModule, PaymentsModule, StudentsModule, ScheduleModule, TypeOrmModule.forFeature(CRM_ENTITY_CLASSES)],

  controllers: [EntitiesController, MaterialAccessController],

  providers: [EntityRepositoryService, EntityAccessService, MaterialAccessCheckService, RolesGuard],

  exports: [EntityRepositoryService, EntityAccessService, MaterialAccessCheckService, RolesGuard],

})

export class EntitiesModule {}


