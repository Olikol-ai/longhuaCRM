import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../entities/Payment.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { CourseEntity } from '../../entities/Course.entity';
import { PaymentService } from './payment.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, StudentEntity, CourseEntity])],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentsModule {}
