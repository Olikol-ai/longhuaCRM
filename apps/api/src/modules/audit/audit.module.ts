import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimitService } from '../../common/security/rate-limit.service';
import { AuditLogEntity } from '../../entities/AuditLog.entity';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService, RateLimitService],
  exports: [AuditService, RateLimitService],
})
export class AuditModule {}
