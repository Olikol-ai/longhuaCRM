import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CRM_ENTITY_CLASSES } from '../../common/constants/entity-registry';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditModule } from '../audit/audit.module';
import { PaymentsModule } from '../payments/payments.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { StudentsModule } from '../students/students.module';
import { SecureFilesModule } from '../files/secure-files.module';
import { UsersModule } from '../users/users.module';
import { EntitiesController } from './entities.controller';
import { MaterialAccessController } from './material-access.controller';
import { EntityAccessService } from './entity-access.service';
import { EntityMutationOrchestratorService } from './entity-mutation-orchestrator.service';
import { EntityRepositoryService } from './entity-repository.service';
import { MaterialAccessCheckService } from './material-access-check.service';
import { MaterialAccessGrantService } from './material-access-grant.service';

@Module({
  imports: [AuditModule, UsersModule, PaymentsModule, StudentsModule, ScheduleModule, SecureFilesModule, TypeOrmModule.forFeature(CRM_ENTITY_CLASSES)],
  controllers: [EntitiesController, MaterialAccessController],
  providers: [
    EntityRepositoryService,
    EntityMutationOrchestratorService,
    EntityAccessService,
    MaterialAccessCheckService,
    MaterialAccessGrantService,
    RolesGuard,
  ],
  exports: [
    EntityRepositoryService,
    EntityMutationOrchestratorService,
    EntityAccessService,
    MaterialAccessCheckService,
    MaterialAccessGrantService,
    RolesGuard,
  ],
})
export class EntitiesModule {}
