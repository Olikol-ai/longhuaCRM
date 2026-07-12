import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from '../../entities/lesson.entity';
import { StudentEntity } from '../../entities/student.entity';
import { StudentBalanceService } from './student-balance.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudentEntity, LessonEntity])],
  providers: [StudentBalanceService],
  exports: [StudentBalanceService],
})
export class StudentsModule {}
