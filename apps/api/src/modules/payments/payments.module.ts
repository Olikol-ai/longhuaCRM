import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { ShopItemEntity } from './entities/shop-item.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { StudentBalancesModule } from '../student-balances/student-balances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, ShopItemEntity]),
    StudentBalancesModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService],
  exports: [PaymentsRepository, PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
