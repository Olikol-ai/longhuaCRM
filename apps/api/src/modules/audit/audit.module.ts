import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimitService } from '../../common/security/rate-limit.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditRepository, AuditService, RateLimitService],
  exports: [AuditRepository, AuditService, RateLimitService],
})
export class AuditModule {}
