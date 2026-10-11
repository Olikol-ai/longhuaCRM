import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentBalanceLedgerEntity } from './entities/student-balance-ledger.entity';
import { StudentLessonBalanceAdjustmentEntity } from './entities/student-lesson-balance-adjustment.entity';
import { StudentBalanceLedgerService } from './student-balance-ledger.service';
import { StudentBalancesController } from './student-balances.controller';
import { StudentBalancesService } from './student-balances.service';
import { StudentBalanceReconciliationService } from './student-balance-reconciliation.service';
import { StudentBalanceLegacyMigrationService } from './student-balance-legacy-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentBalanceLedgerEntity,
      StudentLessonBalanceAdjustmentEntity,
    ]),
  ],
  controllers: [StudentBalancesController],
  providers: [
    StudentBalancesService,
    StudentBalanceLedgerService,
    StudentBalanceReconciliationService,
    StudentBalanceLegacyMigrationService,
  ],
  exports: [
    StudentBalancesService,
    StudentBalanceLedgerService,
    StudentBalanceReconciliationService,
    StudentBalanceLegacyMigrationService,
    TypeOrmModule,
  ],
})
export class StudentBalancesModule {}
