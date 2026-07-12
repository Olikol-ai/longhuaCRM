import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeacherPaymentEntity } from './entities/teacher-payment.entity';
import { TeacherPaymentsController } from './teacher-payments.controller';
import { TeacherPaymentsRepository } from './teacher-payments.repository';
import { TeacherPaymentsService } from './teacher-payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherPaymentEntity, TeacherEntity])],
  controllers: [TeacherPaymentsController],
  providers: [TeacherPaymentsRepository, TeacherPaymentsService],
  exports: [TeacherPaymentsRepository, TeacherPaymentsService, TypeOrmModule],
})
export class TeacherPaymentsModule {}
