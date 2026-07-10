import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Workflow } from '../workflows/entities/workflow.entity';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { PlatformAuditLog } from './entities/platform-audit-log.entity';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, PlatformAuditLog, Workflow])],
  providers: [AuditService, PlatformAuditService],
  exports: [AuditService, PlatformAuditService],
})
export class AuditModule {}
