import { Module } from '@nestjs/common';
import { StudentBalancesController } from './student-balances.controller';
import { StudentBalancesService } from './student-balances.service';

@Module({
  controllers: [StudentBalancesController],
  providers: [StudentBalancesService],
  exports: [StudentBalancesService],
})
export class StudentBalancesModule {}
