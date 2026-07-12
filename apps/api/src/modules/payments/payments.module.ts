import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../../entities/payment.entity';
import { StudentEntity } from '../../entities/student.entity';
import { CourseEntity } from '../../entities/course.entity';
import { PaymentService } from './payment.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, StudentEntity, CourseEntity])],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentsModule {}
